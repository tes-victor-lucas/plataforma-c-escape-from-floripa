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
