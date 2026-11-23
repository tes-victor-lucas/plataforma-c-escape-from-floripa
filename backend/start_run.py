"""POST /runs: cria o relógio autoritativo da run."""

from __future__ import annotations

import re
from typing import Any

from botocore.exceptions import ClientError

from common import TABLE, api_handler, audit, identity, now, read_body, response, validate_common


RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{8,128}$")


@api_handler
def handler(event: dict[str, Any]) -> dict[str, Any]:
    body = read_body(event)
    mode, version = validate_common(body)
    run_id = body.get("runId")
    if not isinstance(run_id, str) or not RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError("Identificador de run inválido")
    player_id, player_name = identity(event)
    started_at, started_epoch_ms = now()
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
            audit("run_start_rejected", run_id=run_id, player_id=player_id)
            return response(409, {"message": "Não foi possível iniciar a run."})
        return response(200, {"runId": run_id, "startedAt": existing["startedAt"]})
    audit("run_started", run_id=run_id, player_id=player_id, mode=mode)
    return response(201, {"runId": run_id, "startedAt": started_at})


def floor_seconds(epoch_ms: int) -> int:
    return epoch_ms // 1_000
