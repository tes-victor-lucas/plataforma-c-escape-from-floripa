import importlib
import json
import os
import sys
import types
import unittest


class FakeTable:
    def __init__(self):
        self.items = {}

    def put_item(self, Item, **_):
        self.items[(Item["pk"], Item["sk"])] = dict(Item)

    def get_item(self, Key, **_):
        item = self.items.get((Key["pk"], Key["sk"]))
        return {"Item": dict(item)} if item else {}

    def update_item(self, Key, ExpressionAttributeValues, **_):
        item = self.items[(Key["pk"], Key["sk"])]
        item.update(status="WON", score=ExpressionAttributeValues[":score"])

    def delete_item(self, Key, **_):
        self.items.pop((Key["pk"], Key["sk"]), None)


class FakeSes:
    def __init__(self):
        self.sent = []

    def send_email(self, **kwargs):
        self.sent.append(kwargs)


def load_handler(sender):
    table, ses = FakeTable(), FakeSes()
    boto3 = types.ModuleType("boto3")
    boto3.resource = lambda _name: types.SimpleNamespace(Table=lambda _table: table)
    boto3.client = lambda _name: ses
    exceptions = types.ModuleType("botocore.exceptions")
    exceptions.ClientError = type("ClientError", (Exception,), {})
    sys.modules.update({"boto3": boto3, "botocore": types.ModuleType("botocore"), "botocore.exceptions": exceptions})
    os.environ["SCORE_TABLE_NAME"] = "tabela"
    os.environ["EMAIL_SENDER"] = sender
    sys.modules.pop("handler", None)
    return importlib.import_module("handler"), table, ses


def event(route, body=None, claims=None, run_id=None):
    return {
        "routeKey": route,
        "pathParameters": {"runId": run_id} if run_id else None,
        "body": json.dumps(body) if body is not None else None,
        "requestContext": {"authorizer": {"jwt": {"claims": claims}}} if claims else {"http": {"sourceIp": "1.2.3.4"}},
    }


VICTORY = {
    "mode": "SINGLE_PLAYER", "enemiesDefeated": 3, "hitsTaken": 0, "dungeonsCompleted": 0,
    "multiKills": [], "arcadeWon": False, "topazAllCollected": False, "pausedMs": 0,
}
CLAIMS = {"sub": "123", "given_name": "Ana", "email": "ana@example.com", "email_verified": "true"}


class HandlerTests(unittest.TestCase):
    def play(self, handler, claims):
        version = handler.SCORE_VERSION
        handler.lambda_handler(event("POST /runs", {"runId": "run-12345", "mode": "SINGLE_PLAYER", "scoreVersion": version}, claims), None)
        return handler.lambda_handler(
            event("POST /runs/{runId}/victory", {**VICTORY, "scoreVersion": version}, claims, "run-12345"), None
        )

    def test_vitoria_envia_email_ao_jogador_com_email_verificado(self):
        handler, _, ses = load_handler("placar@exemplo.com")
        with self.assertLogs(handler.LOGGER, "INFO") as logs:
            response = self.play(handler, CLAIMS)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(ses.sent[0]["Destination"], {"ToAddresses": ["ana@example.com"]})
        self.assertEqual(ses.sent[0]["FromEmailAddress"], "placar@exemplo.com")
        operations = [json.loads(line.split(":", 2)[2])["operation"] for line in logs.output]
        self.assertEqual(operations, ["run_started", "run_won", "victory_email_sent"])

    def test_vitoria_sem_email_verificado_ou_sem_remetente_nao_envia(self):
        handler, _, ses = load_handler("placar@exemplo.com")
        self.play(handler, {**CLAIMS, "email_verified": "false"})
        self.assertEqual(ses.sent, [])
        handler, _, ses = load_handler("")
        self.assertEqual(self.play(handler, CLAIMS)["statusCode"], 200)
        self.assertEqual(ses.sent, [])

    def test_falha_no_email_nao_derruba_a_vitoria(self):
        handler, _, ses = load_handler("placar@exemplo.com")
        ses.send_email = lambda **_: (_ for _ in ()).throw(RuntimeError("SES fora"))
        with self.assertLogs(handler.LOGGER, "INFO"):
            self.assertEqual(self.play(handler, CLAIMS)["statusCode"], 200)

    def test_descarte_fica_registrado_no_log(self):
        handler, table, _ = load_handler("")
        with self.assertLogs(handler.LOGGER, "INFO") as logs:
            handler.lambda_handler(event("DELETE /runs/{runId}", claims=CLAIMS, run_id="run-12345"), None)
        self.assertEqual(json.loads(logs.output[0].split(":", 2)[2]),
                         {"operation": "run_discarded", "run_id": "run-12345", "player_id": "123"})


if __name__ == "__main__":
    unittest.main()
