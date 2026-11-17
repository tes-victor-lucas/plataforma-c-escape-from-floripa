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
- Login com Google obrigatório nas escritas do placar na stack `prod` (`requireAuthentication: "true"` em `Pulumi.prod.yaml`).
- Log de acesso do API Gateway no CloudWatch (`score-api-access-logs`, 90 dias), com IP, rota, status, jogador e erro de autenticação de cada chamada.
- Log de auditoria da Lambda em JSON, uma linha por operação: `run_started`, `run_start_rejected`, `run_won`, `run_discarded`, `run_discard_ignored`, `invalid_request`, `victory_email_sent`, `victory_email_failure` e `score_api_failure`.
- SES (stack `prod`): domínio verificado por DKIM na zona Route 53 e e-mail de vitória para o jogador logado com e-mail verificado.
- Role `github-infra` (stack `prod`) para o GitHub Actions rodar `pulumi up` a cada merge na `main`.
- Zona pública Route 53 para `escape-from-floripa.negoci.online` somente na stack `prod`.

O Pulumi exporta a URL da API, o nome da tabela e o nome do stage. Na stack `prod`, exporta os nameservers da zona Route 53.

GameLift, IoT Core, EventBridge, SQS e SNS aparecem no diagrama de arquitetura, mas não estão implementados no Pulumi atual. No stack `prod`, o site usa S3 e CloudFront e o servidor multiplayer roda em uma EC2. O passo a passo está em [deploy-aws.md](deploy-aws.md).
