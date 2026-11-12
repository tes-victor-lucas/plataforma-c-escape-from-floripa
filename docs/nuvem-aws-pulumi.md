# Nuvem, AWS e Pulumi

A infraestrutura está definida em `pulumi/__main__.py` e usa a região `sa-east-1` na stack de desenvolvimento.

O projeto possui os seguintes recursos:

- API Gateway HTTP API com as rotas de início de run, registro de vitória, descarte de run e consulta do ranking.
- Lambda em Python 3.12 responsável pelas regras da API e pelo cálculo da pontuação.
- DynamoDB para armazenar runs e o melhor resultado de cada jogador.
- TTL de 24 horas para remover runs ativas abandonadas.
- Criptografia e recuperação point-in-time na tabela DynamoDB.
- Role e políticas IAM para a Lambda acessar a tabela e escrever logs.
- Logs da Lambda no CloudWatch.
- CORS habilitado na API.
- Limite de 25 requisições por segundo, com burst de 50.
- Login com Google opcional (`requireAuthentication`): autorizador JWT do API Gateway que valida o ID token do Google nas rotas de escrita.
- Rota pública para consulta do ranking.
- Zona pública Route 53 para `escape-from-floripa.negoci.online` somente na stack `prod`.

O Pulumi exporta a URL da API, o nome da tabela e o nome do stage. Na stack `prod`, exporta os nameservers da zona Route 53.

GameLift, IoT Core, EventBridge, SQS, SES e SNS aparecem no diagrama de arquitetura, mas não estão implementados no Pulumi atual. No stack `prod`, o site usa S3 e CloudFront e o servidor multiplayer roda em uma EC2. O passo a passo está em [deploy-aws.md](deploy-aws.md).
