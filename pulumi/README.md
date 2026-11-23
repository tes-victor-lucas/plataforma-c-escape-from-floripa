# Infraestrutura AWS — Escape from Floripa

Provisiona o placar (API Gateway HTTP, uma Lambda Python por rota, DynamoDB com TTL, criptografia e recuperação point-in-time, logs no CloudWatch e login com Google opcional nas escritas) e o multiplayer (API Gateway WebSocket, uma Lambda Node.js por rota e DynamoDB para salas e conexões). Os dois existem nas stacks `dev` e `prod`.

## Implantação

```bash
cd pulumi
pulumi stack select dev
pulumi up
```

O output `score_api_url` deve ser fornecido ao frontend em `ESCAPE_FROM_FLORIPA_CONFIG.scoreApiUrl`.

Para exigir o login com Google nas escritas (o API Gateway valida o ID token do Google):

```bash
pulumi config set requireAuthentication true
pulumi up
```

Com autenticação ativa, só quem escolhe ENTRAR COM GOOGLE no menu do jogo registra runs, com o nome da conta no placar; quem joga sem entrar não aparece nele. O Client ID aceito é o da Feira de Jogos e pode ser trocado com `pulumi config set googleClientId <id>`. O endpoint público de consulta ao placar permanece sem autenticação.

## Site do jogo (stack `prod`)

No stack `prod`, o jogo é servido em `https://escape-from-floripa.negoci.online` por CloudFront, a partir de um bucket S3 privado. O CloudFront também encaminha `/api/*` para a API de pontuação, que é o endereço padrão do frontend, então não é preciso configurar `scoreApiUrl`.

```bash
pulumi stack select prod
pulumi preview   # gera o build do jogo e lista cada arquivo que muda
pulumi up
```

O próprio programa roda `npm ci` e `npm run build-nolog` em `game/` e cria um objeto S3 por arquivo do build. Assim jogo, placar e multiplayer saem do mesmo commit, o `pulumi preview` mostra o que muda, um `pulumi up` interrompido termina ao rodar de novo e o `pulumi destroy` apaga os arquivos junto com o bucket. Não há `aws s3 sync` nem invalidação do CloudFront: arquivos com hash no nome são imutáveis e o resto vai com `Cache-Control: no-cache`.

A delegação de `escape-from-floripa.negoci.online` é feita fora desta conta, na zona `negoci.online`, com os valores de `pulumi stack output ns_escape`. A zona está com `protect` para não ser recriada. Se for recriada mesmo assim, os NS mudam e a delegação precisa ser refeita antes do `pulumi up`, senão a validação do certificado ACM fica presa.

No `prod`, o CloudFront também encaminha `/ws` para o API Gateway WebSocket do multiplayer (estágio `ws`), e as Lambdas só aceitam conexões vindas do site e da Feira de Jogos. O passo a passo completo está em [docs/deploy-aws.md](../docs/deploy-aws.md).

## Testes

```bash
cd pulumi
uv run python -m unittest discover -s tests
```

O teste roda o programa com recursos falsos (`pulumi.runtime.set_mocks`), sem AWS, e confere que cada rota tem a própria Lambda e que não há EC2.

Por enquanto o `prod` não exige autenticação: qualquer cliente consegue registrar runs, todas com o nome "Jogador". Para o placar passar a usar a conta Google de quem entrou, use `pulumi config set requireAuthentication true` e `pulumi up` depois que o jogo com o login estiver no ar.
