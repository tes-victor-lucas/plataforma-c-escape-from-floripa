import json
import mimetypes
import re
import shutil
import subprocess
from pathlib import Path

import pulumi
import pulumi_aws as aws


config = pulumi.Config()
require_authentication = config.get_bool("requireAuthentication") or False
# Client ID do Google da Feira de Jogos: o mesmo do login do jogo (game/src/game/config/fair.ts).
google_client_id = config.get("googleClientId") or "331191695151-ku8mdhd76pc2k36itas8lm722krn0u64.apps.googleusercontent.com"
root = Path(__file__).resolve().parent.parent
site_domain = "escape-from-floripa.negoci.online"
is_prod = pulumi.get_stack() == "prod"
# Só o prod tem o domínio verificado no SES; nas outras stacks a Lambda não envia e-mail.
email_sender = f"placar@{site_domain}" if is_prod else ""
# Repositórios criados depois de 15/07/2026 identificam dono e repositório por ID no `sub` do OIDC.
github_repository = "tes-victor-lucas@311227909/plataforma-c-escape-from-floripa@1317803667"
# O Parcel põe 8 caracteres de hash no nome do que ele gera (game.2f110086.js); public/assets sai sem hash.
PARCEL_HASHED_NAME = re.compile(r"\.[0-9a-f]{8}\.[a-z0-9]+$")

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

if is_prod:
    aws.iam.RolePolicy(
        "score-lambda-email",
        role=lambda_role.id,
        policy=json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Action": "ses:SendEmail",
                "Resource": "*",
                "Condition": {"StringEquals": {"ses:FromAddress": email_sender}},
            }],
        }),
    )

def lambda_route(api, name, route_key, *, runtime, handler, files, variables, role, http=True, **route_args):
    """Uma Lambda por rota, como no exemplo da disciplina: cada uma leva só os arquivos que importa."""
    function = aws.lambda_.Function(
        name,
        role=role.arn,
        runtime=runtime,
        handler=handler,
        timeout=10,
        memory_size=256,
        code=pulumi.AssetArchive(files),
        environment=aws.lambda_.FunctionEnvironmentArgs(variables=variables),
    )
    integration = aws.apigatewayv2.Integration(
        name,
        api_id=api.id,
        integration_type="AWS_PROXY",
        integration_uri=function.invoke_arn,
        integration_method="POST",
        **({"payload_format_version": "2.0"} if http else {}),
    )
    aws.lambda_.Permission(
        name,
        action="lambda:InvokeFunction",
        function=function.name,
        principal="apigateway.amazonaws.com",
        source_arn=api.execution_arn.apply(lambda arn: f"{arn}/*/*"),
    )
    return aws.apigatewayv2.Route(
        name,
        api_id=api.id,
        route_key=route_key,
        target=pulumi.Output.concat("integrations/", integration.id),
        **route_args,
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

route_auth: dict[str, object] = {}
if require_authentication:
    # O jogo entra com Google (GSI) e manda o ID token: o API Gateway confere assinatura, emissor e audiência.
    authorizer = aws.apigatewayv2.Authorizer(
        "players-jwt-authorizer",
        api_id=api.id,
        authorizer_type="JWT",
        identity_sources=["$request.header.Authorization"],
        jwt_configuration=aws.apigatewayv2.AuthorizerJwtConfigurationArgs(
            audiences=[google_client_id],
            issuer="https://accounts.google.com",
        ),
    )
    route_auth = {"authorization_type": "JWT", "authorizer_id": authorizer.id}

for name, route_key, module, protected in [
    ("start-run", "POST /runs", "start_run", True),
    ("finish-victory", "POST /runs/{runId}/victory", "finish_victory", True),
    ("discard-run", "DELETE /runs/{runId}", "discard_run", True),
    ("leaderboard", "GET /leaderboard", "leaderboard", False),
]:
    lambda_route(
        api, name, route_key,
        runtime="python3.12",
        handler=f"{module}.handler",
        files={file: pulumi.FileAsset(str(root / "backend" / file)) for file in (f"{module}.py", "common.py", "score.py")},
        variables={"SCORE_TABLE_NAME": score_table.name, "EMAIL_SENDER": email_sender},
        role=lambda_role,
        **(route_auth if protected else {}),
    )

# Toda chamada à API fica registrada, inclusive as recusadas pelo authorizer antes de chegar à Lambda.
api_access_logs = aws.cloudwatch.LogGroup("score-api-access-logs", retention_in_days=90)
stage = aws.apigatewayv2.Stage(
    "default-stage",
    api_id=api.id,
    name="$default",
    auto_deploy=True,
    default_route_settings=aws.apigatewayv2.StageDefaultRouteSettingsArgs(
        throttling_burst_limit=50,
        throttling_rate_limit=25,
    ),
    access_log_settings=aws.apigatewayv2.StageAccessLogSettingsArgs(
        destination_arn=api_access_logs.arn,
        format=json.dumps({
            "requestId": "$context.requestId",
            "time": "$context.requestTime",
            "ip": "$context.identity.sourceIp",
            "route": "$context.routeKey",
            "status": "$context.status",
            "player": "$context.authorizer.claims.sub",
            "authError": "$context.authorizer.error",
        }),
    ),
)

# Multiplayer sem servidor ligado: o API Gateway mantém as conexões WebSocket e chama uma Lambda por mensagem.
# Salas e conexões ficam no DynamoDB, porque cada chamada pode cair numa instância diferente da Lambda.
multiplayer_table = aws.dynamodb.Table(
    "multiplayer-table",
    billing_mode="PAY_PER_REQUEST",
    hash_key="pk",
    attributes=[aws.dynamodb.TableAttributeArgs(name="pk", type="S")],
    ttl=aws.dynamodb.TableTtlArgs(attribute_name="expiresAt", enabled=True),
    server_side_encryption=aws.dynamodb.TableServerSideEncryptionArgs(enabled=True),
    tags={"Application": "escape-from-floripa", "Data": "multiplayer-rooms"},
)
ws_api = aws.apigatewayv2.Api(
    "multiplayer-ws-api",
    protocol_type="WEBSOCKET",
    route_selection_expression="$request.body.type",
)
# O CloudFront repassa /ws sem reescrever o caminho, então o estágio se chama "ws".
WS_STAGE = "ws"
multiplayer_role = aws.iam.Role(
    "multiplayer-lambda-role",
    assume_role_policy=lambda_role.assume_role_policy,
)
aws.iam.RolePolicyAttachment(
    "multiplayer-lambda-logs",
    role=multiplayer_role.name,
    policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
)
aws.iam.RolePolicy(
    "multiplayer-lambda-access",
    role=multiplayer_role.id,
    policy=pulumi.Output.all(multiplayer_table.arn, ws_api.execution_arn).apply(lambda arns: json.dumps({
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:Scan"],
                "Resource": arns[0],
            },
            {"Effect": "Allow", "Action": "execute-api:ManageConnections", "Resource": f"{arns[1]}/{WS_STAGE}/POST/@connections/*"},
        ],
    })),
)
multiplayer_variables = {
    "TABLE_NAME": multiplayer_table.name,
    "CALLBACK_URL": ws_api.api_endpoint.apply(lambda url: url.replace("wss://", "https://", 1) + f"/{WS_STAGE}"),
    # Fora do prod (stack dev), qualquer origem conecta, como no servidor local.
    "ALLOWED_ORIGIN": f"https://{site_domain},https://feira-de-jogos.dev.br" if is_prod else "",
}
server_src = root / "server" / "src"
ws_routes = [
    lambda_route(
        ws_api, f"multiplayer-{name}", route_key,
        runtime="nodejs22.x",
        handler=f"lambda/{name}.handler",
        files={
            "package.json": pulumi.StringAsset('{"type": "module"}'),
            **{file: pulumi.FileAsset(str(server_src / file))
               for file in ["multiplayer.js", f"lambda/{name}.js", *([] if name == "connect" else ["lambda/aws.js"])]},
        },
        variables=multiplayer_variables,
        role=multiplayer_role,
        http=False,
    )
    for name, route_key in [
        ("connect", "$connect"),
        ("disconnect", "$disconnect"),
        ("default", "$default"),
        ("join", "lobby.join"),
        ("list", "lobby.list"),
        ("state", "player.state"),
        ("event", "match.event"),
    ]
]
# Estágio WebSocket não tem auto_deploy: uma rota nova ou trocada gera outro deployment.
ws_deployment = aws.apigatewayv2.Deployment(
    "multiplayer-ws-deployment",
    api_id=ws_api.id,
    triggers=pulumi.Output.all(*[route.target for route in ws_routes]).apply(
        lambda targets: {"routes": ",".join(targets)}
    ),
    opts=pulumi.ResourceOptions(depends_on=ws_routes),
)
ws_stage = aws.apigatewayv2.Stage(
    "multiplayer-ws-stage",
    api_id=ws_api.id,
    name=WS_STAGE,
    deployment_id=ws_deployment.id,
    # Cada jogador manda 20 estados por segundo, e o anfitrião ainda manda os inimigos.
    default_route_settings=aws.apigatewayv2.StageDefaultRouteSettingsArgs(
        throttling_burst_limit=500,
        throttling_rate_limit=1000,
    ),
)

if is_prod:
    zone = aws.route53.Zone(
        "escape-from-floripa",
        name=site_domain,
        # Recriar a zona troca os NS que estão delegados em negoci.online.
        opts=pulumi.ResourceOptions(protect=True),
    )
    pulumi.export("ns_escape", zone.name_servers)

    # CloudFront só aceita certificados emitidos em us-east-1.
    us_east_1 = aws.Provider("us-east-1", region="us-east-1")
    certificate = aws.acm.Certificate(
        "site-certificate",
        domain_name=zone.name,
        validation_method="DNS",
        opts=pulumi.ResourceOptions(provider=us_east_1),
    )
    validation_option = certificate.domain_validation_options[0]
    validation_record = aws.route53.Record(
        "site-certificate-validation",
        zone_id=zone.zone_id,
        name=validation_option.resource_record_name,
        type=validation_option.resource_record_type,
        records=[validation_option.resource_record_value],
        ttl=300,
    )
    certificate_validation = aws.acm.CertificateValidation(
        "site-certificate-validation",
        certificate_arn=certificate.arn,
        validation_record_fqdns=[validation_record.fqdn],
        opts=pulumi.ResourceOptions(provider=us_east_1),
    )

    site_bucket = aws.s3.Bucket("site", force_destroy=True)
    origin_access = aws.cloudfront.OriginAccessControl(
        "site-origin-access",
        origin_access_control_origin_type="s3",
        signing_behavior="always",
        signing_protocol="sigv4",
    )
    # O jogo chama a API em /api (ScoreApi.ts), mas as rotas do API Gateway não têm esse prefixo.
    strip_api_prefix = aws.cloudfront.Function(
        "strip-api-prefix",
        runtime="cloudfront-js-2.0",
        code="""function handler(event) {
    var request = event.request;
    request.uri = request.uri.replace(/^\\/api/, '') || '/';
    return request;
}""",
    )

    # O jogo sai no mesmo `pulumi up` que a API e o multiplayer: os dois lados vêm do mesmo commit,
    # o preview lista cada arquivo que muda, e o destroy apaga os arquivos junto com o bucket.
    game_dir = root / "game"
    dist_dir = game_dir / "dist"
    # O Parcel não limpa a pasta, e um arquivo velho viraria recurso.
    shutil.rmtree(dist_dir, ignore_errors=True)
    subprocess.run(["npm", "ci"], cwd=game_dir, check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["npm", "run", "build-nolog"], cwd=game_dir, check=True, stdout=subprocess.DEVNULL)
    for file in sorted(path for path in dist_dir.rglob("*") if path.is_file()):
        key = file.relative_to(dist_dir).as_posix()
        aws.s3.BucketObjectv2(
            f"site/{key}",
            bucket=site_bucket.id,
            key=key,
            source=pulumi.FileAsset(str(file)),
            content_type=mimetypes.guess_type(key)[0] or "application/octet-stream",
            # Nome com hash do Parcel nunca muda de conteúdo; o resto o CloudFront confere na origem,
            # então um deploy vale na hora, sem invalidar o cache.
            cache_control="public, max-age=31536000, immutable" if PARCEL_HASHED_NAME.search(key) else "no-cache",
        )

    distribution = aws.cloudfront.Distribution(
        "site",
        enabled=True,
        aliases=[zone.name],
        default_root_object="index.html",
        price_class="PriceClass_All",
        origins=[
            aws.cloudfront.DistributionOriginArgs(
                origin_id="site",
                domain_name=site_bucket.bucket_regional_domain_name,
                origin_access_control_id=origin_access.id,
            ),
            aws.cloudfront.DistributionOriginArgs(
                origin_id="score-api",
                domain_name=api.api_endpoint.apply(lambda url: url.removeprefix("https://")),
                custom_origin_config=aws.cloudfront.DistributionOriginCustomOriginConfigArgs(
                    http_port=80,
                    https_port=443,
                    origin_protocol_policy="https-only",
                    origin_ssl_protocols=["TLSv1.2"],
                ),
            ),
            aws.cloudfront.DistributionOriginArgs(
                origin_id="multiplayer",
                domain_name=ws_api.api_endpoint.apply(lambda url: url.removeprefix("wss://")),
                custom_origin_config=aws.cloudfront.DistributionOriginCustomOriginConfigArgs(
                    http_port=80,
                    https_port=443,
                    origin_protocol_policy="https-only",
                    origin_ssl_protocols=["TLSv1.2"],
                ),
            ),
        ],
        default_cache_behavior=aws.cloudfront.DistributionDefaultCacheBehaviorArgs(
            target_origin_id="site",
            viewer_protocol_policy="redirect-to-https",
            allowed_methods=["GET", "HEAD"],
            cached_methods=["GET", "HEAD"],
            compress=True,
            cache_policy_id="658327ea-f89d-4fab-a63d-7e88639e58f6",  # Managed-CachingOptimized
        ),
        ordered_cache_behaviors=[
            aws.cloudfront.DistributionOrderedCacheBehaviorArgs(
                path_pattern="/api/*",
                target_origin_id="score-api",
                viewer_protocol_policy="redirect-to-https",
                allowed_methods=["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                cached_methods=["GET", "HEAD"],
                cache_policy_id="4135ea2d-6df8-44a3-9df3-4b5a84be39ad",  # Managed-CachingDisabled
                origin_request_policy_id="b689b0a8-53d0-40ab-baf2-68738e2966ac",  # Managed-AllViewerExceptHostHeader
                function_associations=[aws.cloudfront.DistributionOrderedCacheBehaviorFunctionAssociationArgs(
                    event_type="viewer-request",
                    function_arn=strip_api_prefix.arn,
                )],
            ),
            aws.cloudfront.DistributionOrderedCacheBehaviorArgs(
                path_pattern="/ws",
                target_origin_id="multiplayer",
                viewer_protocol_policy="https-only",
                allowed_methods=["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
                cached_methods=["GET", "HEAD"],
                cache_policy_id="4135ea2d-6df8-44a3-9df3-4b5a84be39ad",  # Managed-CachingDisabled
                # Repassa os cabeçalhos do WebSocket e a origem, mas não o Host: o API Gateway exige o próprio.
                origin_request_policy_id="b689b0a8-53d0-40ab-baf2-68738e2966ac",  # Managed-AllViewerExceptHostHeader
            ),
        ],
        restrictions=aws.cloudfront.DistributionRestrictionsArgs(
            geo_restriction=aws.cloudfront.DistributionRestrictionsGeoRestrictionArgs(restriction_type="none"),
        ),
        viewer_certificate=aws.cloudfront.DistributionViewerCertificateArgs(
            acm_certificate_arn=certificate_validation.certificate_arn,
            ssl_support_method="sni-only",
            minimum_protocol_version="TLSv1.2_2021",
        ),
    )

    aws.s3.BucketPolicy(
        "site",
        bucket=site_bucket.id,
        policy=pulumi.Output.all(site_bucket.arn, distribution.arn).apply(lambda arns: json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Service": "cloudfront.amazonaws.com"},
                "Action": "s3:GetObject",
                "Resource": f"{arns[0]}/*",
                "Condition": {"StringEquals": {"AWS:SourceArn": arns[1]}},
            }],
        })),
    )
    aws.route53.Record(
        "site",
        zone_id=zone.zone_id,
        name=zone.name,
        type="A",
        aliases=[aws.route53.RecordAliasArgs(
            name=distribution.domain_name,
            zone_id=distribution.hosted_zone_id,
            evaluate_target_health=False,
        )],
    )

    # O GitHub Actions roda o `pulumi up` com credenciais temporárias, sem chave guardada no repositório.
    github_oidc = aws.iam.OpenIdConnectProvider(
        "github-actions",
        url="https://token.actions.githubusercontent.com",
        client_id_lists=["sts.amazonaws.com"],
    )

    # O `pulumi up` da main cria e apaga recursos de qualquer tipo, por isso a role é administradora.
    infra_role = aws.iam.Role(
        "github-infra",
        max_session_duration=3600,
        assume_role_policy=github_oidc.arn.apply(lambda arn: json.dumps({
            "Version": "2012-10-17",
            "Statement": [{
                "Effect": "Allow",
                "Principal": {"Federated": arn},
                "Action": "sts:AssumeRoleWithWebIdentity",
                "Condition": {"StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub": f"repo:{github_repository}:ref:refs/heads/main",
                }},
            }],
        })),
    )
    aws.iam.RolePolicyAttachment(
        "github-infra-admin",
        role=infra_role.name,
        policy_arn="arn:aws:iam::aws:policy/AdministratorAccess",
    )
    pulumi.export("infra_role_arn", infra_role.arn)

    # O DKIM nos registros da zona verifica o domínio no SES sem passo manual.
    email_identity = aws.sesv2.EmailIdentity("site-email", email_identity=site_domain)
    for index in range(3):
        token = email_identity.dkim_signing_attributes.tokens.apply(lambda tokens, i=index: tokens[i])
        aws.route53.Record(
            f"site-email-dkim-{index}",
            zone_id=zone.zone_id,
            name=pulumi.Output.concat(token, "._domainkey.", site_domain),
            type="CNAME",
            ttl=1800,
            records=[pulumi.Output.concat(token, ".dkim.amazonses.com")],
        )
    pulumi.export("email_sender", email_sender)
    pulumi.export("site_bucket", site_bucket.bucket)
    pulumi.export("site_distribution_id", distribution.id)
    pulumi.export("site_url", pulumi.Output.concat("https://", zone.name))

pulumi.export("score_api_url", api.api_endpoint)
pulumi.export("score_table_name", score_table.name)
pulumi.export("score_api_stage", stage.name)
pulumi.export("multiplayer_ws_url", pulumi.Output.concat(ws_api.api_endpoint, "/", WS_STAGE))
