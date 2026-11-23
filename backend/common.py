"""Partes compartilhadas pelas Lambdas do placar: tabela, identidade, respostas e auditoria."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Callable

import boto3

from score import SCORE_VERSION

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)
# DYNAMODB_ENDPOINT só existe no `sam local` (DynamoDB Local); na AWS fica vazio e o boto3 usa o padrão.
TABLE = boto3.resource("dynamodb", endpoint_url=os.environ.get("DYNAMODB_ENDPOINT") or None).Table(os.environ["SCORE_TABLE_NAME"])
ALLOWED_MODES = {"SINGLE_PLAYER", "MULTIPLAYER"}


def now() -> tuple[str, int]:
    current = datetime.now(timezone.utc)
    return current.isoformat(timespec="milliseconds").replace("+00:00", "Z"), int(current.timestamp() * 1_000)


def response(status: int, body: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization,content-type",
            "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body or {}, ensure_ascii=False),
    }


def read_body(event: dict[str, Any]) -> dict[str, Any]:
    try:
        value = json.loads(event.get("body") or "{}")
    except (TypeError, json.JSONDecodeError) as error:
        raise ValueError("Corpo inválido") from error
    if not isinstance(value, dict):
        raise ValueError("Corpo inválido")
    return value


def identity(event: dict[str, Any]) -> tuple[str, str]:
    context = event.get("requestContext") or {}
    claims = ((context.get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    player_id = claims.get("sub")
    # Só o primeiro nome vai para o placar público quando o token traz (login com Google).
    player_name = claims.get("given_name") or claims.get("name") or claims.get("preferred_username") or claims.get("email")
    if player_id:
        return str(player_id), str(player_name or "Jogador")[:40]

    # Ambiente acadêmico/local sem authorizer. Em produção, habilite requireAuthentication no Pulumi.
    source_ip = ((context.get("http") or {}).get("sourceIp") or "local")
    return f"anonymous:{source_ip}", "Jogador"


def audit(operation: str, **fields: Any) -> None:
    """Registra a operação em JSON numa linha, para filtrar no CloudWatch Logs Insights."""
    LOGGER.info(json.dumps({"operation": operation, **fields}, ensure_ascii=False, default=str))


def verified_email(event: dict[str, Any]) -> str | None:
    claims = (((event.get("requestContext") or {}).get("authorizer") or {}).get("jwt") or {}).get("claims") or {}
    # O authorizer HTTP repassa as claims como texto: `email_verified` chega como "true".
    if str(claims.get("email_verified")).lower() != "true":
        return None
    email = claims.get("email")
    return email if isinstance(email, str) and "@" in email else None


def validate_common(body: dict[str, Any]) -> tuple[str, int]:
    mode = body.get("mode")
    version = body.get("scoreVersion")
    if mode not in ALLOWED_MODES or version != SCORE_VERSION:
        raise ValueError("Modo ou versão de pontuação inválidos")
    return mode, version


def bounded_integer(value: Any, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError("Estatística inválida")
    return value


def api_handler(route: Callable[[dict[str, Any]], dict[str, Any]]) -> Callable[[dict[str, Any], Any], dict[str, Any]]:
    """Cada Lambda atende uma rota; erros de entrada viram 400 e o resto vira 500 sem vazar detalhes."""
    def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
        try:
            return route(event)
        except ValueError:
            audit("invalid_request", route=event.get("routeKey", ""))
            return response(400, {"message": "Os dados enviados são inválidos."})
        except Exception:
            LOGGER.exception(json.dumps({"operation": "score_api_failure", "route": event.get("routeKey", "")}))
            return response(500, {"message": "Não foi possível concluir a operação."})
    return handler
