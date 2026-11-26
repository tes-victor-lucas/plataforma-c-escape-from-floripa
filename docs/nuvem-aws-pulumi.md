# Nuvem, AWS e Pulumi

A infraestrutura está definida em `pulumi/__main__.py` e usa a região `sa-east-1` nas stacks `dev` e `prod`. O desenho está em [diagrama-nuvem.md](diagrama-nuvem.md).

As duas stacks têm a mesma infraestrutura; o `prod` só acrescenta o domínio e o e-mail:

| | `dev` | `prod` |
|---|---|---|
| S3 + CloudFront com `/api/*` e `/ws` | sim | sim |
| API Gateway HTTP + Lambdas do placar e perfil, DynamoDB | sim | sim |
| API Gateway WebSocket + Lambdas do multiplayer, DynamoDB | sim | sim |
| Endereço | `https://<id>.cloudfront.net` (certificado do CloudFront) | `https://escape-from-floripa.negoci.online` (Route 53 + ACM) |
| E-mail de vitória (SES) | não | sim |
| Login obrigatório nas escritas do placar | não | sim (`requireAuthentication`) |

No `dev`, o jogo é servido pelo endereço do CloudFront e chama o placar e o multiplayer do próprio ambiente (`/api` e `/ws` do mesmo endereço), nunca os de produção.

O projeto possui os seguintes recursos:

- API Gateway HTTP API com as rotas de início de run, registro de vitória, descarte de run e consulta do ranking.
- Uma Lambda em Python 3.12 por rota (`start_run`, `finish_victory`, `discard_run`, `leaderboard`, `save_profile`), cada uma com só o próprio arquivo, `common.py` e `score.py`.
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
- Log de auditoria das Lambdas em JSON, uma linha por operação: `run_started`, `run_start_rejected`, `run_won`, `run_discarded`, `run_discard_ignored`, `invalid_request`, `victory_email_sent`, `victory_email_failure` e `score_api_failure`.
- SES (stack `prod`): domínio verificado por DKIM na zona Route 53 e e-mail de vitória para o jogador logado com e-mail verificado.
- Role `github-infra` (stack `prod`) para o GitHub Actions rodar `pulumi up` a cada merge na `main`.
- Zona pública Route 53 para `escape-from-floripa.negoci.online` somente na stack `prod`.
- Multiplayer: API Gateway WebSocket com seleção de rota por `$request.body.type` e uma Lambda Node.js 22 por rota (`$connect`, `$disconnect`, `$default`, `lobby.join`, `lobby.list`, `player.state`, `match.event`). Cada pacote leva só `multiplayer.js`, o handler da rota e o adaptador `lambda/aws.js`; o AWS SDK já vem no runtime.
- DynamoDB `multiplayer-table` com salas e conexões, TTL de 3 horas e entrada na sala por escrita condicional (dois jogadores no máximo, mesmo com entradas simultâneas).
- Site (stacks `dev` e `prod`): bucket S3 privado com um objeto do Pulumi por arquivo do build, CloudFront com HTTPS, `/api/*` para o placar e `/ws` para o multiplayer. Só o `prod` tem domínio próprio e certificado ACM.

O Pulumi exporta a URL do site (`site_url`), a URL da API, o nome da tabela, o nome do stage e a URL do WebSocket (`multiplayer_ws_url`). Na stack `prod`, exporta os nameservers da zona Route 53.

Tudo o que aparece no diagrama está implementado, e nada fica ligado sem jogadores. O passo a passo está em [deploy-aws.md](deploy-aws.md).
