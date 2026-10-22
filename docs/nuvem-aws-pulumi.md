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
- Cognito opcional nas stacks comuns e obrigatório na stack `prod`.
- User Pool e cliente web do Cognito quando a autenticação está ativa.
- Autenticação JWT nas rotas de escrita quando o Cognito está ativo.
- Rota pública para consulta do ranking.
- Zona pública Route 53 para `escape-from-floripa.negoci.online` somente na stack `prod`.

O Pulumi exporta a URL da API, o nome da tabela e o nome do stage. Quando Cognito está ativo, também exporta os identificadores do User Pool e do cliente web. Na stack `prod`, exporta os nameservers da zona Route 53.

S3, CloudFront, GameLift, IoT Core, EventBridge, SQS, SES e SNS aparecem no diagrama de arquitetura, mas não estão implementados no Pulumi atual. O servidor multiplayer também não possui infraestrutura AWS.
