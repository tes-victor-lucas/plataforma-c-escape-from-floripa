import json
from pathlib import Path

import pulumi
import pulumi_aws as aws

config = pulumi.Config()
require_authentication = (config.get_bool("requireAuthentication") or False) or pulumi.get_stack() == "prod"
root = Path(__file__).resolve().parent.parent

score_table = aws.dynamodb.Table(
    "score-table",
    billing_mode="PAY_PER_REQUEST",
    hash_key="pk",
    range_key="sk",
    attributes=[
        aws.dynamodb.TableAttributeArgs(name="pk", type="S"),
        aws.dynamodb.TableAttributeArgs(name="sk", type="S"),
    ],
    ttl=aws.dynamodb.TableTtlArgs(attribute_name="expiresAt", enabled=True),
    point_in_time_recovery=aws.dynamodb.TablePointInTimeRecoveryArgs(enabled=True),
    server_side_encryption=aws.dynamodb.TableServerSideEncryptionArgs(enabled=True),
    tags={"Application": "escape-from-floripa", "Data": "runs-and-leaderboard"},
)

lambda_role = aws.iam.Role(
    "score-lambda-role",
    assume_role_policy=json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }],
    }),
)
aws.iam.RolePolicyAttachment(
    "score-lambda-logs",
    role=lambda_role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
)
aws.iam.RolePolicy(
    "score-lambda-dynamodb",
    role=lambda_role.id,
    policy=score_table.arn.apply(lambda arn: json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Query"],
            "Resource": arn,
        }],
    })),
)

score_lambda = aws.lambda_.Function(
    "score-api",
    role=lambda_role.arn,
    runtime="python3.12",
    handler="handler.lambda_handler",
    timeout=10,
    memory_size=256,
    code=pulumi.AssetArchive({
        "handler.py": pulumi.FileAsset(str(root / "backend" / "handler.py")),
        "score.py": pulumi.FileAsset(str(root / "backend" / "score.py")),
    }),
    environment=aws.lambda_.FunctionEnvironmentArgs(
        variables={"SCORE_TABLE_NAME": score_table.name},
    ),
)

api = aws.apigatewayv2.Api(
    "score-http-api",
    protocol_type="HTTP",
    cors_configuration=aws.apigatewayv2.ApiCorsConfigurationArgs(
        allow_origins=["*"],
        allow_headers=["authorization", "content-type"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        max_age=86400,
    ),
)
integration = aws.apigatewayv2.Integration(
    "score-lambda-integration",
    api_id=api.id,
    integration_type="AWS_PROXY",
    integration_uri=score_lambda.arn,
    integration_method="POST",
    payload_format_version="2.0",
)

route_auth: dict[str, object] = {}
if require_authentication:
    user_pool = aws.cognito.UserPool(
        "players",
        username_attributes=["email"],
        auto_verified_attributes=["email"],
    )
    user_pool_client = aws.cognito.UserPoolClient(
        "web-player",
        user_pool_id=user_pool.id,
        generate_secret=False,
        explicit_auth_flows=["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_SRP_AUTH"],
    )
    authorizer = aws.apigatewayv2.Authorizer(
        "players-jwt-authorizer",
        api_id=api.id,
        authorizer_type="JWT",
        identity_sources=["$request.header.Authorization"],
        jwt_configuration=aws.apigatewayv2.AuthorizerJwtConfigurationArgs(
            audiences=[user_pool_client.id],
            issuer=user_pool.endpoint.apply(lambda endpoint: f"https://{endpoint}"),
        ),
    )
    route_auth = {"authorization_type": "JWT", "authorizer_id": authorizer.id}
    pulumi.export("cognito_user_pool_id", user_pool.id)
    pulumi.export("cognito_web_client_id", user_pool_client.id)

for name, route_key, protected in [
    ("start-run", "POST /runs", True),
    ("finish-victory", "POST /runs/{runId}/victory", True),
    ("discard-run", "DELETE /runs/{runId}", True),
    ("leaderboard", "GET /leaderboard", False),
]:
    aws.apigatewayv2.Route(
        name,
        api_id=api.id,
        route_key=route_key,
        target=pulumi.Output.concat("integrations/", integration.id),
        **(route_auth if protected else {}),
    )

stage = aws.apigatewayv2.Stage(
    "default-stage",
    api_id=api.id,
    name="$default",
    auto_deploy=True,
    default_route_settings=aws.apigatewayv2.StageDefaultRouteSettingsArgs(
        throttling_burst_limit=50,
        throttling_rate_limit=25,
    ),
)
aws.lambda_.Permission(
    "allow-http-api",
    action="lambda:InvokeFunction",
    function=score_lambda.name,
    principal="apigateway.amazonaws.com",
    source_arn=api.execution_arn.apply(lambda arn: f"{arn}/*/*"),
)

if pulumi.get_stack() == "prod":
    zone = aws.route53.Zone(
        "escape-from-floripa",
        name="escape-from-floripa.negoci.online",
    )
    pulumi.export("ns_escape", zone.name_servers)

pulumi.export("score_api_url", api.api_endpoint)
pulumi.export("score_table_name", score_table.name)
pulumi.export("score_api_stage", stage.name)
