# Como subir o jogo na AWS

Passo a passo para publicar o jogo em **https://escape-from-floripa.negoci.online**, com site, placar e multiplayer. O domínio já está delegado pelo professor, então **ninguém precisa mexer no domínio `negoci.online`**.

Tudo sai de um único comando, o `pulumi up`: ele gera o build do jogo, envia cada arquivo ao S3 e atualiza placar e multiplayer, sempre a partir do mesmo commit.

## O que será criado

| Parte | Serviço | Onde ver no console da AWS |
|---|---|---|
| Domínio | Route 53 (a zona já existe) | Route 53 → Hosted zones |
| Certificado HTTPS | ACM | Certificate Manager, região **N. Virginia (us-east-1)** |
| Arquivos do jogo | S3, um objeto do Pulumi por arquivo | S3 |
| Entrega e HTTPS | CloudFront | CloudFront |
| Placar | API Gateway HTTP, 4 Lambdas Python (uma por rota) e DynamoDB | Mesmos nomes, região **São Paulo (sa-east-1)** |
| Multiplayer | API Gateway WebSocket, 7 Lambdas Node.js (uma por rota) e DynamoDB | Mesmos nomes, região **São Paulo (sa-east-1)** |
| E-mail de vitória | SES | SES → Identities, região **São Paulo** |

Os jogadores acessam tudo pelo mesmo endereço: o CloudFront entrega o jogo, envia `/api/*` para o placar e `/ws` para o multiplayer.

## Passo 1: preparar o código

```bash
git checkout main
git pull
```

## Passo 2: conferir as ferramentas

```bash
node -v && npm -v && pulumi version && aws --version && uv --version
```

O Node é necessário porque o `pulumi up` gera o build do jogo. Se faltar alguma ferramenta, instale só ela. **Não rode o `Makefile` da raiz**: ele sobrescreve o `~/.bashrc`.

## Passo 3: entrar na AWS

Use a conta AWS onde a zona `escape-from-floripa.negoci.online` foi criada.

1. Entre em https://console.aws.amazon.com.
2. Vá em **Route 53 → Hosted zones** e confirme que a zona aparece. Se não aparecer, você está na conta errada.
3. Vá em **IAM → Users → Create user** e crie um usuário para o deploy. Em **Permissions**, escolha **Attach policies directly** e marque `AdministratorAccess`.
4. Abra o usuário, vá em **Security credentials → Create access key → Command Line Interface** e copie as duas chaves.
5. Configure no terminal, informando `sa-east-1` como região:

```bash
aws configure
aws sts get-caller-identity   # deve mostrar o número da conta certa
```

Nunca coloque essas chaves no repositório. Terminado o trabalho na disciplina, apague o usuário.

**Recomendado:** crie um alerta de gastos em **Billing and Cost Management → Budgets → Create budget**, com um valor baixo, como US$ 5.

## Passo 4: entrar no Pulumi

1. Crie sua conta ou entre em https://app.pulumi.com. Se o stack já foi criado por um colega, entre na conta ou organização dele.
2. No terminal:

```bash
pulumi login
pulumi whoami     # deve mostrar o SEU usuário
cd pulumi
pulumi stack ls   # o stack "prod" deve aparecer
```

> **Atenção:** se o `whoami` mostrar um usuário começando com `agent-`, é uma conta temporária criada automaticamente. Não use: rode `pulumi logout` e faça `pulumi login` de novo.

### Se o `prod` aparecer

Confira se os NS do stack são os mesmos que o professor configurou:

```bash
pulumi stack select prod
pulumi stack output ns_escape
dig +short NS escape-from-floripa.negoci.online
```

As duas listas devem ter os mesmos servidores, ainda que em outra ordem. Vá para o passo 5.

### Se o `prod` não aparecer

**Não rode `pulumi up` ainda**, porque isso criaria uma zona nova, com outros NS, e o certificado ficaria preso.

1. Procure primeiro o stack na conta do Pulumi de quem criou a zona.
2. Se ele não existir mais, copie o **Hosted zone ID** em **Route 53 → Hosted zones** e importe a zona existente:

```bash
pulumi stack init prod
pulumi import aws:route53/zone:Zone escape-from-floripa <HOSTED_ZONE_ID> --protect
```

Depois confira os NS como descrito acima.

## Passo 5: publicar

```bash
cd pulumi
pulumi stack select prod
pulumi preview
```

O preview roda o build do jogo (leva 1 ou 2 minutos) e lista cada arquivo `site/...` que vai mudar. Revise a lista. **O preview não deve mostrar a zona sendo substituída ou apagada.** Se mostrar, pare e confira o passo 4. Estando certo:

```bash
pulumi up
```

Na primeira vez leva uns 5 a 15 minutos, por causa do certificado e do CloudFront. Depois, poucos minutos.

## Passo 6: testar

- [ ] https://escape-from-floripa.negoci.online abre o menu do jogo.
- [ ] O endereço com `http://` redireciona para `https://`.
- [ ] O placar abre no menu (vazio é normal).
- [ ] Uma vitória aparece no placar, sem erro 401 no console do navegador (F12).
- [ ] Em **JOGAR → MULTIPLAYER**, um jogador cria uma sala e o outro a vê na lista e clica em **ENTRAR**: a partida inicia nos dois.
- [ ] Outra dupla, em outra sala, joga separada.
- [ ] A sala some da lista quando a partida começa ou quando quem a criou cancela.

O multiplayer também pode ser testado pelo terminal, com dois jogadores falsos:

```bash
cd server && npm ci
node scripts/smoke.js wss://escape-from-floripa.negoci.online/ws https://escape-from-floripa.negoci.online
```

## Publicação automática

Configurada uma única vez, cada merge na `main` roda os testes e, se passarem, roda o `pulumi up` na stack `prod` e confere o site, o placar e o multiplayer no ar. Em PRs, só os testes rodam. O acompanhamento fica na aba **Actions** do GitHub.

**Tudo que entra na `main` vai direto para os jogadores.**

### Configurar uma única vez

Depois de um `pulumi up` feito à mão (passo 5), que cria a role `github-infra`:

1. Em [app.pulumi.com](https://app.pulumi.com) → **Settings → Access tokens**, crie um token (na conta dona da stack `prod`).
2. Cadastre o token e a role no GitHub:

```bash
cd pulumi
gh secret set PULUMI_ACCESS_TOKEN          # cole o token quando pedir
gh variable set AWS_INFRA_ROLE_ARN --body "$(pulumi stack output infra_role_arn)"
```

Sem a variável `AWS_INFRA_ROLE_ARN`, o job **Publicar jogo e infraestrutura** é pulado e a publicação continua manual. A role `github-infra` é administradora da conta, mas só a `main` deste repositório consegue usá-la, então proteja a `main` contra push direto.

Se o `pulumi up` responder `EntityAlreadyExists` para `github-actions`, a conta já tem esse provedor. Importe-o com `pulumi import aws:iam/openIdConnectProvider:OpenIdConnectProvider github-actions arn:aws:iam::<CONTA>:oidc-provider/token.actions.githubusercontent.com` e rode `pulumi up` de novo.

### E-mail de vitória

O `pulumi up` verifica o domínio no SES sozinho, pelos registros DKIM da zona, e a Lambda passa a mandar `placar@escape-from-floripa.negoci.online` para quem vence logado com Google. Confira em **SES → Identities** (São Paulo) se `escape-from-floripa.negoci.online` está **Verified**.

Toda conta nova no SES começa no *sandbox*, que só entrega e-mails para endereços verificados. Para mandar a qualquer jogador, peça a saída em **SES → Account dashboard → Request production access** (tipo *Transactional*, citando o e-mail de vitória). Enquanto a AWS não aprova, verifique o seu e-mail em **SES → Identities → Create identity** para testar.

## Como atualizar, voltar atrás e depurar

| Situação | O que fazer |
|---|---|
| Qualquer mudança (`game/`, `server/`, `backend/`, `pulumi/`) | Merge na `main` com a publicação automática configurada, senão `pulumi up` |
| Saber o que vai mudar antes | `pulumi preview` (ou `pulumi preview --diff` para ver os detalhes): lista arquivos do jogo, Lambdas e o resto |
| Voltar a uma versão anterior | Reverta o commit na `main`. O merge da reversão roda o `pulumi up` com o jogo e o backend antigos juntos |
| O `pulumi up` falhou no meio | Corrija a causa e rode `pulumi up` de novo: ele compara o que existe com o código e termina o que faltou. Se alguém mexeu à mão no console, rode `pulumi refresh` antes |
| Ver o que está no ar | `pulumi stack` lista os recursos, e `pulumi stack history` lista cada `pulumi up` com o commit |

Jogo e servidor saem sempre juntos, então o protocolo do multiplayer não fica desencontrado entre os dois.

O CloudFront não precisa de invalidação: os arquivos com hash no nome (`game.2f110086.js`) são imutáveis, e o resto (`index.html`, mapas, sprites) vai com `Cache-Control: no-cache`, então o CloudFront confere a versão no S3 a cada pedido.

## Se algo der errado

| Sintoma | O que verificar |
|---|---|
| `pulumi up` parado no certificado por mais de 30 minutos | Os NS do passo 4 não batem com a delegação. Passe os valores de `ns_escape` ao professor |
| `pulumi up` falha em `npm ci` ou no build | Rode `cd game && npm ci && npm run build-nolog` para ver o erro |
| Site abre, mas o multiplayer não conecta | Rode o `scripts/smoke.js` do passo 6 e veja os logs das Lambdas `multiplayer-*` |
| Erro 403 em `/ws` | O site foi aberto por outro endereço. Só o domínio oficial e a Feira de Jogos são aceitos (Lambda `multiplayer-connect`) |
| Jogo antigo depois de publicar | Recarregue sem cache (Ctrl+Shift+R). Se persistir, confira no preview se os arquivos `site/...` mudaram |
| Publicação falha com `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Confira a variável `AWS_INFRA_ROLE_ARN` e se o workflow rodou na `main`. Se estiver certo, confira o `sub` com `gh api repos/tes-victor-lucas/plataforma-c-escape-from-floripa/actions/oidc/customization/sub`: o `sub_claim_prefix` precisa ser igual a `github_repository` em `pulumi/__main__.py`, com `repo:` na frente. Depois de corrigir, rode `pulumi up` |
| Publicação pulada na aba Actions | A variável `AWS_INFRA_ROLE_ARN` não foi configurada |
| Placar com erro | **CloudWatch → Log groups**, grupo da Lambda da rota (`start-run`, `finish-victory`, `discard-run` ou `leaderboard`) |
| Erro 401 no placar | O token do Google expirou (dura 1 hora) ou o jogador não entrou. Os acessos recusados aparecem no grupo `score-api-access-logs`, com `authError` |
| E-mail de vitória não chega | SES ainda no sandbox ou domínio não verificado (veja "E-mail de vitória"). Procure `victory_email_failure` nos logs da Lambda `finish-victory` |

## Custos

Sem jogadores, o custo é praticamente zero: não há servidor ligado. Placar, S3, CloudFront e DynamoDB custam centavos com pouco tráfego. Uma hora de partida multiplayer fica entre US$ 0,50 e US$ 1 (a conta está em [diagrama-nuvem.md](diagrama-nuvem.md)). São valores aproximados: confira na [calculadora da AWS](https://calculator.aws).

Para encerrar tudo ao fim da disciplina:

```bash
cd pulumi
pulumi destroy --exclude-protected
```

Isso apaga tudo, inclusive os arquivos do jogo (que são recursos do Pulumi) e o bucket, menos a zona do domínio, que tem proteção contra exclusão. Mantenha a zona se o domínio ainda for usado, porque recriá-la muda os NS e exigiria falar de novo com o professor. Para apagar também a zona: `pulumi state unprotect 'urn:pulumi:prod::plataforma-c-escape-from-floripa::aws:route53/zone:Zone::escape-from-floripa'` e depois `pulumi destroy`.

## Limitações conhecidas

- **Placar só com login:** quem joga sem entrar com Google não aparece no placar, e uma run com mais de 1 hora perde o registro, porque o ID token do Google expira.
- **Combate decidido no cliente:** o computador do anfitrião simula os inimigos, então uma trapaça é possível.
- **Partida de até 2 horas:** é o limite de uma conexão WebSocket no API Gateway.
- **Infraestrutura automática opcional:** sem o token do Pulumi e a role `github-infra` cadastrados no GitHub, a publicação depende de `pulumi up` manual.
