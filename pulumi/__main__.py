import json
from pathlib import Path

import pulumi
import pulumi_aws as aws

config = pulumi.Config()
require_authentication = config.get_bool("requireAuthentication") or False
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
    pulumi.export("site_bucket", site_bucket.bucket)
    pulumi.export("site_distribution_id", distribution.id)
    pulumi.export("site_url", pulumi.Output.concat("https://", zone.name))

pulumi.export("score_api_url", api.api_endpoint)
pulumi.export("score_table_name", score_table.name)
pulumi.export("score_api_stage", stage.name)
