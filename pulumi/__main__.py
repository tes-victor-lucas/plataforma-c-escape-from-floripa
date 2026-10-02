import pulumi
import pulumi_aws as aws

if pulumi.get_stack() == "prod":
    zona_escape = aws.route53.Zone(
        "escape-from-floripa",
        name="escape-from-floripa.negoci.online",
    )

    pulumi.export("ns_escape", zona_escape.name_servers)