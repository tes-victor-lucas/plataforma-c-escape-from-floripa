"""DELETE /runs/{runId}: descarta uma run ativa abandonada ou derrotada."""

from __future__ import annotations

from typing import Any

from botocore.exceptions import ClientError

from common import TABLE, api_handler, audit, identity, response


@api_handler
def handler(event: dict[str, Any]) -> dict[str, Any]:
    run_id = (event.get("pathParameters") or {}).get("runId", "")
    player_id, _ = identity(event)
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
        audit("run_discard_ignored", run_id=run_id, player_id=player_id)
        return response(204)
    audit("run_discarded", run_id=run_id, player_id=player_id)
    return response(204)
