"""An AWS Python Pulumi program"""

import pulumi
import pulumi_aws as aws

if pulumi.get_stack() == "prod":
    aws.route53.Zone("plataforma-c", name="negoci.online")
