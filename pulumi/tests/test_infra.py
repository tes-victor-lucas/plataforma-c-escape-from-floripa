"""Roda o programa do Pulumi com recursos falsos (sem AWS) e confere a forma da infraestrutura."""
import asyncio
import importlib.util
import unittest
from pathlib import Path

import pulumi

created = []


class Mocks(pulumi.runtime.Mocks):
    def new_resource(self, args):
        created.append(args)
        outputs = dict(args.inputs)
        if args.typ == "aws:apigatewayv2/api:Api":
            scheme = "wss" if args.inputs.get("protocolType") == "WEBSOCKET" else "https"
            outputs.update(apiEndpoint=f"{scheme}://{args.name}.execute-api.sa-east-1.amazonaws.com",
                           executionArn=f"arn:aws:execute-api:sa-east-1:123:{args.name}")
        outputs.setdefault("arn", f"arn:aws:mock::123:{args.name}")
        outputs.setdefault("name", args.name)
        return [f"{args.name}-id", outputs]

    def call(self, args):
        return {}


# Stack dev: tem placar e multiplayer; o site (com build do jogo) só existe no prod.
# O Pulumi registra recursos num event loop, que o Python novo não cria sozinho.
asyncio.set_event_loop(asyncio.new_event_loop())
pulumi.runtime.set_mocks(Mocks(), project="plataforma-c-escape-from-floripa", stack="dev", preview=False)
spec = importlib.util.spec_from_file_location("infra", Path(__file__).resolve().parent.parent / "__main__.py")
infra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infra)


def of_type(typ):
    return [resource for resource in created if resource.typ == typ]


class InfraTest(unittest.TestCase):
    @pulumi.runtime.test
    def test_uma_lambda_por_rota_com_so_os_arquivos_dela(self):
        def check(_):
            functions = {resource.name: resource.inputs for resource in of_type("aws:lambda/function:Function")}
            self.assertEqual(functions["leaderboard"]["handler"], "leaderboard.handler")
            self.assertEqual(set(functions["leaderboard"]["code"].assets), {"leaderboard.py", "common.py", "score.py"})
            self.assertEqual(set(functions["multiplayer-connect"]["code"].assets), {"package.json", "multiplayer.js", "lambda/connect.js"})
            self.assertEqual(len(functions), 5 + 7)
            routes = sorted(resource.inputs["routeKey"] for resource in of_type("aws:apigatewayv2/route:Route"))
            self.assertIn("GET /leaderboard", routes)
            self.assertIn("player.state", routes)
            # Cada rota aponta para a própria integração, e não para uma Lambda com switch.
            targets = [resource.inputs["target"] for resource in of_type("aws:apigatewayv2/route:Route")]
            self.assertEqual(len(set(targets)), len(targets))
        return infra.ws_deployment.id.apply(check)

    @pulumi.runtime.test
    def test_multiplayer_sem_ec2(self):
        def check(_):
            self.assertEqual(of_type("aws:ec2/instance:Instance"), [])
            stages = {resource.name: resource.inputs["name"] for resource in of_type("aws:apigatewayv2/stage:Stage")}
            self.assertEqual(stages.get("multiplayer-ws-stage"), "ws", "o CloudFront repassa /ws direto para o estágio")
        return infra.ws_stage.id.apply(check)


if __name__ == "__main__":
    unittest.main()
