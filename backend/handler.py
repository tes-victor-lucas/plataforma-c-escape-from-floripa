"""Lambda HTTP API para iniciar/finalizar runs e consultar o placar."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

from score import SCORE_VERSION, calculate_score

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
TABLE_NAME = os.environ["SCORE_TABLE_NAME"]
TABLE = boto3.resource("dynamodb").Table(TABLE_NAME)
ALLOWED_MODES = {"SINGLE_PLAYER", "MULTIPLAYER"}
RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,128}$")


def _now() -> tuple[str, int]:
    current = datetime.now(timezone.utc)
    return current.isoformat(timespec="milliseconds").replace("+00:00", "Z"), int(current.timestamp() * 1_000)


def _response(status: int, body: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization,content-type",
            "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        },
        "body": json.dumps(body or {}, ensure_ascii=False),
    }


def _body(event: dict[str, Any]) -> dict[str, Any]:
    try:
        value = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError) as error:
        raise ValueError("Corpo inválido") from error
    if not isinstance(value, dict):
        raise ValueError("Corpo inválido")
    return value


def _identity(event: dict[str, Any]) -> tuple[str, str]:
    context = event.get("requestContext") or {}
    claims = ((context.get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    player_id = claims.get("sub")
    player_name = claims.get("name") or claims.get("preferred_username") or claims.get("email")
    if player_id:
        return str(player_id), str(player_name or "Jogador")[:40]

    # Ambiente acadêmico/local sem authorizer. Em produção, habilite requireAuthentication no Pulumi.
    source_ip = ((context.get("http") or {}).get("sourceIp") or "local")
    return f"anonymous:{source_ip}", "Jogador"


def _validate_common(body: dict[str, Any]) -> tuple[str, int]:
    mode = body.get("mode")
    version = body.get("scoreVersion")
    if mode not in ALLOWED_MODES or version != SCORE_VERSION:
        raise ValueError("Modo ou versão de pontuação inválidos")
    return mode, version


def _start_run(event: dict[str, Any]) -> dict[str, Any]:
    body = _body(event)
    mode, version = _validate_common(body)
    run_id = body.get("runId")
    if not isinstance(run_id, str) or not RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError("Identificador de run inválido")
    player_id, player_name = _identity(event)
    started_at, started_epoch_ms = _now()
    item = {
        "pk": f"RUN#{run_id}",
        "sk": "META",
        "entityType": "ACTIVE_RUN",
        "runId": run_id,
        "playerId": player_id,
        "playerName": player_name,
        "mode": mode,
        "scoreVersion": version,
        "status": "RUNNING",
        "startedAt": started_at,
        "startedAtEpochMs": started_epoch_ms,
        "expiresAt": floor_seconds(started_epoch_ms) + 86_400,
    }
    try:
        TABLE.put_item(Item=item, ConditionExpression="attribute_not_exists(pk)")
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        existing = TABLE.get_item(Key={"pk": item["pk"], "sk": "META"}, ConsistentRead=True).get("Item")
        if not existing or existing.get("playerId") != player_id:
            return _response(409, {"message": "Não foi possível iniciar a run."})
        return _response(200, {"runId": run_id, "startedAt": existing["startedAt"]})
    LOGGER.info("run_started", extra={"run_id": run_id, "player_id": player_id, "mode": mode})
    return _response(201, {"runId": run_id, "startedAt": started_at})


def _finish_victory(event: dict[str, Any], run_id: str) -> dict[str, Any]:
    body = _body(event)
    mode, version = _validate_common(body)
    player_id, _ = _identity(event)
    key = {"pk": f"RUN#{run_id}", "sk": "META"}
    run = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
    if not run or run.get("playerId") != player_id:
        return _response(404, {"message": "Run não encontrada."})
    if run.get("mode") != mode or int(run.get("scoreVersion", 0)) != version:
        return _response(409, {"message": "A run usa outra modalidade ou versão."})
    if run.get("status") == "WON":
        return _response(200, _stored_result(run))
    if run.get("status") != "RUNNING":
        return _response(409, {"message": "A run já foi encerrada."})

    enemies = _bounded_integer(body.get("enemiesDefeated"), 0, 100_000)
    hits = _bounded_integer(body.get("hitsTaken"), 0, 100_000)
    raw_multi_kills = body.get("multiKills")
    if not isinstance(raw_multi_kills, list) or len(raw_multi_kills) > enemies:
        raise ValueError("Multi-kills inválidos")
    multi_kills = [_bounded_integer(value, 2, 100_000) for value in raw_multi_kills]
    if sum(multi_kills) > enemies:
        raise ValueError("Multi-kills incompatíveis com as mortes")

    completed_at, completed_epoch_ms = _now()
    elapsed_ms = max(0, completed_epoch_ms - int(run["startedAtEpochMs"]))
    breakdown = calculate_score(
        won=True,
        elapsed_time_ms=elapsed_ms,
        enemies_defeated=enemies,
        hits_taken=hits,
        multi_kills=multi_kills,
    )
    try:
        TABLE.update_item(
            Key=key,
            UpdateExpression=(
                "SET #status = :won, entityType = :type, completedAt = :completed, "
                "completedAtEpochMs = :completed_ms, elapsedTimeMs = :elapsed, "
                "enemiesDefeated = :enemies, hitsTaken = :hits, multiKills = :multi, "
                "scoreBreakdown = :breakdown, score = :score REMOVE expiresAt"
            ),
            ConditionExpression="#status = :running AND playerId = :player",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":won": "WON", ":running": "RUNNING", ":player": player_id,
                ":type": "VICTORY_RUN", ":completed": completed_at,
                ":completed_ms": completed_epoch_ms, ":elapsed": elapsed_ms,
                ":enemies": enemies, ":hits": hits, ":multi": multi_kills,
                ":breakdown": breakdown.to_dict(), ":score": breakdown.total,
            },
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        existing = TABLE.get_item(Key=key, ConsistentRead=True).get("Item")
        if existing and existing.get("status") == "WON" and existing.get("playerId") == player_id:
            return _response(200, _stored_result(existing))
        return _response(409, {"message": "A run já foi encerrada."})

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
    LOGGER.info("run_won", extra={"run_id": run_id, "player_id": player_id, "score": breakdown.total})
    return _response(200, {"score": breakdown.total, "elapsedTimeMs": elapsed_ms, "breakdown": breakdown.to_dict()})


def _discard_run(event: dict[str, Any], run_id: str) -> dict[str, Any]:
    player_id, _ = _identity(event)
    try:
        TABLE.delete_item(
            Key={"pk": f"RUN#{run_id}", "sk": "META"},
            ConditionExpression="#status = :running AND playerId = :player",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={":running": "RUNNING", ":player": player_id},
        )
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
    return _response(204)


def _leaderboard(event: dict[str, Any]) -> dict[str, Any]:
    query = event.get("queryStringParameters") or {}
    mode = query.get("mode", "SINGLE_PLAYER")
    try:
        version = int(query.get("scoreVersion", SCORE_VERSION))
    except (TypeError, ValueError) as error:
        raise ValueError("Versão inválida") from error
    if mode not in ALLOWED_MODES or version != SCORE_VERSION:
        raise ValueError("Modo ou versão de pontuação inválidos")
    query_args = {
        "KeyConditionExpression": "pk = :pk",
        "ExpressionAttributeValues": {":pk": f"LEADERBOARD#{mode}#V{version}"},
        "ConsistentRead": True,
    }
    result = TABLE.query(**query_args)
    items = list(result.get("Items", []))
    while result.get("LastEvaluatedKey"):
        result = TABLE.query(**query_args, ExclusiveStartKey=result["LastEvaluatedKey"])
        items.extend(result.get("Items", []))
    items = sorted(
        items,
        key=lambda item: (-int(item["score"]), int(item["elapsedTimeMs"]), int(item["completedAtEpochMs"])),
    )[:100]
    entries = [
        {
            "rank": rank,
            "playerName": item["playerName"],
            "score": int(item["score"]),
            "elapsedTimeMs": int(item["elapsedTimeMs"]),
            "enemiesDefeated": int(item["enemiesDefeated"]),
            "completedAt": item["completedAt"],
            "scoreVersion": int(item["scoreVersion"]),
            "mode": item["mode"],
        }
        for rank, item in enumerate(items, 1)
    ]
    return _response(200, {"entries": entries})


def _bounded_integer(value: Any, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError("Estatística inválida")
    return value


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


def floor_seconds(epoch_ms: int) -> int:
    return epoch_ms // 1_000


def lambda_handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    route = event.get("routeKey", "")
    run_id = (event.get("pathParameters") or {}).get("runId", "")
    try:
        if route == "OPTIONS /{proxy+}":
            return _response(204)
        if route == "POST /runs":
            return _start_run(event)
        if route == "POST /runs/{runId}/victory":
            return _finish_victory(event, run_id)
        if route == "DELETE /runs/{runId}":
            return _discard_run(event, run_id)
        if route == "GET /leaderboard":
            return _leaderboard(event)
        return _response(404, {"message": "Recurso não encontrado."})
    except ValueError:
        return _response(400, {"message": "Os dados enviados são inválidos."})
    except Exception:
        LOGGER.exception("score_api_failure", extra={"route": route})
        return _response(500, {"message": "Não foi possível concluir a operação."})
