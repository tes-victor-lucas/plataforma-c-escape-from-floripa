"""POST /runs/{runId}/victory: calcula a pontuação, atualiza o placar e manda o e-mail."""

from __future__ import annotations

import os
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

from common import LOGGER, TABLE, api_handler, audit, bounded_integer, identity, now, read_body, response, validate_common
from score import MAX_ARCADE_PAUSE_MS, calculate_score


# Sem remetente configurado (stack dev ou local), a vitória não envia e-mail.
EMAIL_SENDER = os.environ.get("EMAIL_SENDER", "")
SES = boto3.client("sesv2") if EMAIL_SENDER else None


def _verified_email(event: dict[str, Any]) -> str | None:
    claims = (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    # O authorizer HTTP repassa as claims como texto: `email_verified` chega como "true".
    if str(claims.get("email_verified")).lower() != "true":
        return None
    email = claims.get("email")
    return email if isinstance(email, str) and "@" in email else None


def _send_victory_email(event: dict[str, Any], run_id: str, score: int, elapsed_ms: int) -> None:
    email = _verified_email(event)
    if not SES or not email:
        return
    minutes, seconds = divmod(elapsed_ms // 1_000, 60)
    try:
        SES.send_email(
            FromEmailAddress=EMAIL_SENDER,
            Destination={"ToAddresses": [email]},
            Content={"Simple": {
                "Subject": {"Data": "Sua vitória em Escape from Floripa foi registrada", "Charset": "UTF-8"},
                "Body": {"Text": {"Data": (
                    f"Você chegou à Plataforma C em {minutes} min {seconds:02d} s e fez {score} pontos.\n"
                    "Confira o placar em https://escape-from-floripa.negoci.online"
                ), "Charset": "UTF-8"}},
            }},
        )
    except Exception:
        # A vitória já está salva; um e-mail que falha não pode virar erro para o jogador.
        LOGGER.exception("victory_email_failure")
        return
    audit("victory_email_sent", run_id=run_id)


@api_handler
def handler(event: dict[str, Any]) -> dict[str, Any]:
    run_id = (event.get("pathParameters") or {}).get("runId", "")
    body = read_body(event)
    mode, version = validate_common(body)
    player_id, _ = identity(event)
    key = {"pk": f"RUN#{run_id}", "sk": "META"}
    run = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
    if not run or run.get("playerId") != player_id:
        return response(404, {"message": "Run não encontrada."})
    if run.get("mode") != mode or int(run.get("scoreVersion", 0)) != version:
        return response(409, {"message": "A run usa outra modalidade ou versão."})
    if run.get("status") == "WON":
        return response(200, _stored_result(run))
    if run.get("status") != "RUNNING":
        return response(409, {"message": "A run já foi encerrada."})

    enemies = bounded_integer(body.get("enemiesDefeated"), 0, 100_000)
    hits = bounded_integer(body.get("hitsTaken"), 0, 100_000)
    dungeons = bounded_integer(body.get("dungeonsCompleted"), 0, 2)
    raw_multi_kills = body.get("multiKills")
    if not isinstance(raw_multi_kills, list) or len(raw_multi_kills) > enemies:
        raise ValueError("Multi-kills inválidos")
    multi_kills = [bounded_integer(value, 2, 100_000) for value in raw_multi_kills]
    if sum(multi_kills) > enemies:
        raise ValueError("Multi-kills incompatíveis com as mortes")
    arcade_won = body.get("arcadeWon")
    if not isinstance(arcade_won, bool):
        raise ValueError("Resultado do fliperama inválido")
    topaz_all_collected = body.get("topazAllCollected")
    if not isinstance(topaz_all_collected, bool):
        raise ValueError("Resultado dos topázios inválido")
    paused_ms = bounded_integer(body.get("pausedMs"), 0, MAX_ARCADE_PAUSE_MS)

    completed_at, completed_epoch_ms = now()
    # shortcut: pausedMs vem do cliente, só limitado pelo teto; se virar abuso, marcar a pausa no servidor.
    elapsed_ms = max(0, completed_epoch_ms - int(run["startedAtEpochMs"]) - paused_ms)
    breakdown = calculate_score(
        won=True,
        elapsed_time_ms=elapsed_ms,
        enemies_defeated=enemies,
        hits_taken=hits,
        dungeons_completed=dungeons,
        multi_kills=multi_kills,
        arcade_won=arcade_won,
        topaz_all_collected=topaz_all_collected,
    )
    try:
        TABLE.update_item(
            Key=key,
            UpdateExpression=(
                "SET #status = :won, entityType = :type, completedAt = :completed, "
                "completedAtEpochMs = :completed_ms, elapsedTimeMs = :elapsed, "
                "enemiesDefeated = :enemies, hitsTaken = :hits, dungeonsCompleted = :dungeons, "
                "multiKills = :multi, "
                "scoreBreakdown = :breakdown, score = :score REMOVE expiresAt"
            ),
            ConditionExpression="#status = :running AND playerId = :player",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":won": "WON", ":running": "RUNNING", ":player": player_id,
                ":type": "VICTORY_RUN", ":completed": completed_at,
                ":completed_ms": completed_epoch_ms, ":elapsed": elapsed_ms,
                ":enemies": enemies, ":hits": hits, ":dungeons": dungeons, ":multi": multi_kills,
                ":breakdown": breakdown.to_dict(), ":score": breakdown.total,
            },
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        existing = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
        if existing and existing.get("status") == "WON" and existing.get("playerId") == player_id:
            return response(200, _stored_result(existing))
        return response(409, {"message": "A run já foi encerrada."})

    leaderboard_item = {
        "pk": f"LEADERBOARD#{mode}#V{version}",
        "sk": f"PLAYER#{player_id}",
        "entityType": "LEADERBOARD_ENTRY",
        "playerId": player_id,
        "playerName": run["playerName"],
        "runId": run_id,
        "mode": mode,
        "scoreVersion": version,
        "score": breakdown.total,
        "elapsedTimeMs": elapsed_ms,
        "enemiesDefeated": enemies,
        "completedAt": completed_at,
        "completedAtEpochMs": completed_epoch_ms,
    }
    try:
        TABLE.put_item(
            Item=leaderboard_item,
            ConditionExpression=(
                "attribute_not_exists(pk) OR score < :score "
                "OR (score = :score AND elapsedTimeMs > :elapsed)"
            ),
            ExpressionAttributeValues={":score": breakdown.total, ":elapsed": elapsed_ms},
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
    audit("run_won", run_id=run_id, player_id=player_id, mode=mode, score=breakdown.total, elapsed_ms=elapsed_ms)
    _send_victory_email(event, run_id, breakdown.total, elapsed_ms)
    return response(200, {"score": breakdown.total, "elapsedTimeMs": elapsed_ms, "breakdown": breakdown.to_dict()})


def _stored_result(run: dict[str, Any]) -> dict[str, Any]:
    return {
        "score": int(run["score"]),
        "elapsedTimeMs": int(run["elapsedTimeMs"]),
        "breakdown": _from_dynamo(run["scoreBreakdown"]),
    }


def _from_dynamo(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value)
    if isinstance(value, dict):
        return {key: _from_dynamo(child) for key, child in value.items()}
    if isinstance(value, list):
        return [_from_dynamo(child) for child in value]
    return value
