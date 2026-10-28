# Infraestrutura AWS — Escape from Floripa

Provisiona a API serverless de pontuação: API Gateway HTTP API, Lambda Python, tabela DynamoDB com TTL, criptografia e recuperação point-in-time, logs no CloudWatch e Cognito opcional.

## Implantação

```bash
cd pulumi
pulumi stack select dev
pulumi up
```

O output `score_api_url` deve ser fornecido ao frontend em `ESCAPE_FROM_FLORIPA_CONFIG.scoreApiUrl`.

Para proteger as escritas com Cognito/JWT:

```bash
pulumi config set requireAuthentication true
pulumi up
```

Com autenticação ativa, configure também `ESCAPE_FROM_FLORIPA_CONFIG.accessToken` com o JWT da sessão. O endpoint público de consulta ao placar permanece sem autenticação.

## Site do jogo (stack `prod`)

No stack `prod`, o jogo é servido em `https://escape-from-floripa.negoci.online` por CloudFront, a partir de um bucket S3 privado. O CloudFront também encaminha `/api/*` para a API de pontuação, que é o endereço padrão do frontend, então não é preciso configurar `scoreApiUrl`.

```bash
cd game && npm run build-nolog && cd ../pulumi
pulumi stack select prod
pulumi up
aws s3 sync ../game/dist "s3://$(pulumi stack output site_bucket)" --delete
aws cloudfront create-invalidation --distribution-id "$(pulumi stack output site_distribution_id)" --paths '/*'
```

Para publicar uma nova versão do jogo, repita o build, o `sync` e a invalidação. O `pulumi up` só é necessário quando a infraestrutura muda.

A delegação de `escape-from-floripa.negoci.online` é feita fora desta conta, na zona `negoci.online`, com os valores de `pulumi stack output ns_escape`. A zona está com `protect` para não ser recriada. Se for recriada mesmo assim, os NS mudam e a delegação precisa ser refeita antes do `pulumi up`, senão a validação do certificado ACM fica presa.

No MVP, o `prod` não exige autenticação: o jogo ainda não tem login no Cognito, então qualquer cliente consegue registrar runs. Para exigir JWT, use `pulumi config set requireAuthentication true` depois que o frontend enviar `accessToken`.
