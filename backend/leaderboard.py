"""GET /leaderboard: ranking da modalidade e versão de pontuação."""

from __future__ import annotations

from typing import Any

from common import ALLOWED_MODES, TABLE, api_handler, response
from score import SCORE_VERSION


@api_handler
def handler(event: dict[str, Any]) -> dict[str, Any]:
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
    return response(200, {"entries": entries})
