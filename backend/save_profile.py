"""PUT /profile: cria ou atualiza o perfil de quem entrou com Google e devolve o que está salvo."""

from __future__ import annotations

from typing import Any

from common import TABLE, api_handler, audit, identity, now, response, verified_email


@api_handler
def handler(event: dict[str, Any]) -> dict[str, Any]:
    player_id, player_name = identity(event)
    # O perfil é do usuário autenticado: sem token do Google não há a quem ligar os dados.
    if player_id.startswith("anonymous:"):
        return response(401, {"message": "Entre com Google para salvar o perfil."})
    logged_at, _ = now()
    profile = TABLE.update_item(
        Key={"pk": f"USER#{player_id}", "sk": "PROFILE"},
        UpdateExpression=(
            "SET entityType = :type, playerName = :name, email = :email, lastLoginAt = :now, "
            "firstLoginAt = if_not_exists(firstLoginAt, :now), victories = if_not_exists(victories, :zero)"
        ),
        ExpressionAttributeValues={
            ":type": "USER_PROFILE", ":name": player_name, ":email": verified_email(event) or "",
            ":now": logged_at, ":zero": 0,
        },
        ReturnValues="ALL_NEW",
    )["Attributes"]
    audit("profile_saved", player_id=player_id)
    return response(200, {
        "playerName": profile["playerName"],
        "victories": int(profile["victories"]),
        "firstLoginAt": profile["firstLoginAt"],
        "lastLoginAt": profile["lastLoginAt"],
    })
