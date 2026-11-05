# Como subir o jogo na AWS

Passo a passo para publicar o jogo em **https://escape-from-floripa.negoci.online**, com site, placar e multiplayer. O domínio já está delegado pelo professor, então **ninguém precisa mexer no domínio `negoci.online`**.

## O que será criado

| Parte | Serviço | Onde ver no console da AWS |
|---|---|---|
| Domínio | Route 53 (a zona já existe) | Route 53 → Hosted zones |
| Certificado HTTPS | ACM | Certificate Manager, região **N. Virginia (us-east-1)** |
| Arquivos do jogo | S3 | S3 |
| Entrega e HTTPS | CloudFront | CloudFront |
| Placar | API Gateway, Lambda e DynamoDB | Mesmos nomes, região **São Paulo (sa-east-1)** |
| Multiplayer | EC2 `t4g.micro` com IP fixo | EC2, região **São Paulo (sa-east-1)** |

Os jogadores acessam tudo pelo mesmo endereço: o CloudFront entrega o jogo, envia `/api/*` para o placar e `/ws` para o servidor multiplayer.

## Passo 1: preparar o código

Publique a partir da `main`, com o PR do multiplayer já mesclado:

```bash
git checkout main
git pull
```

## Passo 2: conferir as ferramentas

```bash
node -v && pulumi version && aws --version && uv --version
```

Se faltar alguma, instale só ela. **Não rode o `Makefile` da raiz**: ele sobrescreve o `~/.bashrc`.

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

**Recomendado:** crie um alerta de gastos em **Billing and Cost Management → Budgets → Create budget**, com um valor baixo, como US$ 15.

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

## Passo 5: conferir a rede padrão

A EC2 usa a VPC padrão de São Paulo. Este comando deve mostrar um ID:

```bash
aws ec2 describe-vpcs --region sa-east-1 --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId'
```

Se responder `null`, crie a VPC com `aws ec2 create-default-vpc --region sa-east-1`.

## Passo 6: gerar o jogo

Na raiz do repositório:

```bash
cd game
npm install
npm test
npm run build-nolog   # gera game/dist
cd ..
```

Não é preciso criar o `multiplayer-config.json`: em HTTPS, o jogo já se conecta a `wss://<domínio>/ws`.

## Passo 7: criar a infraestrutura

```bash
cd pulumi
pulumi stack select prod
pulumi preview
```

Revise a lista. **O preview não deve mostrar a zona sendo substituída ou apagada.** Se mostrar, pare e confira o passo 4. Estando certo:

```bash
pulumi up
```

Leva uns 5 a 15 minutos, por causa do certificado e do CloudFront.

## Passo 8: enviar o jogo

Este envio manual só é necessário antes de configurar a publicação automática, descrita mais abaixo.

Ainda em `pulumi/`:

```bash
aws s3 sync ../game/dist "s3://$(pulumi stack output site_bucket)" --delete
aws cloudfront create-invalidation --distribution-id "$(pulumi stack output site_distribution_id)" --paths '/*'
```

## Passo 9: testar

Espere uns 2 minutos, porque a EC2 ainda está instalando o servidor.

- [ ] https://escape-from-floripa.negoci.online abre o menu do jogo.
- [ ] O endereço com `http://` redireciona para `https://`.
- [ ] O placar abre no menu (vazio é normal).
- [ ] Uma vitória aparece no placar, sem erro 401 no console do navegador (F12).
- [ ] Em **JOGAR → MULTIPLAYER**, um jogador cria uma sala e o outro a vê na lista e clica em **ENTRAR**: a partida inicia nos dois.
- [ ] Outra dupla, em outra sala, joga separada.
- [ ] A sala some da lista quando a partida começa ou quando quem a criou cancela.

Um link com `?room=minha-sala` entra direto nessa sala, sem perguntar o nome.

## Publicação automática

Depois de configurada, cada merge na `main` roda os testes e, se passarem, publica o jogo no S3 e limpa o cache do CloudFront. Em PRs, só os testes rodam. O acompanhamento fica na aba **Actions** do GitHub.

**Tudo que entra na `main` vai direto para os jogadores.**

### Configurar uma única vez

Com a mudança que adiciona o workflow já na `main` e os passos 3 e 4 feitos:

```bash
cd pulumi
pulumi stack select prod
pulumi preview
```

O preview deve mostrar a **criação** de `github-actions`, `github-deploy` e `github-deploy-site`. Se `server/` mudou desde o último `pulumi up`, também mostra a **substituição da EC2 `multiplayer`**, que é esperada e derruba as partidas em andamento. Nenhum outro recurso deve ser substituído, principalmente a zona. Estando certo:

```bash
pulumi up
gh variable set AWS_DEPLOY_ROLE_ARN --body "$(pulumi stack output deploy_role_arn)"
gh variable set SITE_BUCKET --body "$(pulumi stack output site_bucket)"
gh variable set SITE_DISTRIBUTION_ID --body "$(pulumi stack output site_distribution_id)"
gh workflow run deploy.yml --ref main
gh run watch
```

Sem essas variáveis, o workflow roda só os testes e pula a publicação. Os valores não são segredos, porque a role só pode ser usada por este repositório, na `main`.

Se o `pulumi up` responder `EntityAlreadyExists` para `github-actions`, a conta já tem esse provedor. Importe-o com `pulumi import aws:iam/openIdConnectProvider:OpenIdConnectProvider github-actions arn:aws:iam::<CONTA>:oidc-provider/token.actions.githubusercontent.com` e rode `pulumi up` de novo.

Para voltar a uma versão anterior, reverta o commit na `main`. O merge da reversão publica o jogo de novo.

## Como atualizar

| O que mudou | O que fazer |
|---|---|
| Jogo (`game/`) | Merge na `main`, e o resto é automático |
| Servidor multiplayer (`server/`) | `pulumi up`: **recria a EC2 e derruba as partidas em andamento** |
| Placar (`backend/`) ou infraestrutura (`pulumi/`) | `pulumi up` |

**Cuidado:** o jogo sai no merge, mas o servidor só muda com o `pulumi up`. Se o protocolo do multiplayer mudar, rode o `pulumi up` logo após o merge, porque o coop pode falhar nesse intervalo.

## Se algo der errado

| Sintoma | O que verificar |
|---|---|
| `pulumi up` parado no certificado por mais de 30 minutos | Os NS do passo 4 não batem com a delegação. Passe os valores de `ns_escape` ao professor |
| Erro `no matching EC2 VPC found` | Passo 5 |
| Erro de capacidade da `t4g.micro` | `pulumi config set multiplayerInstanceType t4g.small` e `pulumi up` |
| Site abre, mas o multiplayer não conecta | Veja os logs abaixo. Confira também se a aba Network (F12) mostra `/ws` |
| Erro 502 em `/ws` | O servidor não está rodando. Veja os logs abaixo |
| Erro 401 em `/ws` | O site foi aberto por outro endereço, e só o domínio oficial é aceito |
| Jogo antigo depois de publicar | Rode de novo a invalidação do passo 8 |
| Publicação falha com `Not authorized to perform sts:AssumeRoleWithWebIdentity` | Confira a variável `AWS_DEPLOY_ROLE_ARN` e se o workflow rodou na `main`. Se estiver certo, confira o `sub` com `gh api repos/tes-victor-lucas/plataforma-c-escape-from-floripa/actions/oidc/customization/sub`: o `sub_claim_prefix` precisa ser igual a `github_repository` em `pulumi/__main__.py`, com `repo:` na frente. Depois de corrigir, rode `pulumi up` |
| Publicação pulada na aba Actions | As variáveis de "Publicação automática" não foram configuradas |
| Placar com erro | **CloudWatch → Log groups**, grupo da Lambda `score-api` |

### Ver os logs do servidor multiplayer

Vá em **EC2 → Instances** (região São Paulo), selecione `escape-from-floripa-multiplayer` e clique em **Connect → Session Manager → Connect**. No terminal que abrir:

```bash
sudo systemctl status escape-multiplayer       # está rodando?
sudo journalctl -u escape-multiplayer -n 50    # erros do servidor
sudo tail -n 50 /var/log/cloud-init-output.log # erros da instalação
```

## Custos

A estimativa é de **cerca de US$ 10 a 15 por mês** para pouco uso, quase tudo da EC2 e do IP fixo, que são cobrados mesmo sem jogadores. Placar, S3 e CloudFront tendem a custar centavos com pouco tráfego. São valores aproximados: confira na [calculadora da AWS](https://calculator.aws).

Para encerrar tudo ao fim da disciplina:

```bash
cd pulumi
pulumi destroy --exclude-protected
```

Isso apaga tudo menos a zona do domínio, que tem proteção contra exclusão. Mantenha a zona se o domínio ainda for usado, porque recriá-la muda os NS e exigiria falar de novo com o professor.

## Limitações conhecidas

- **Placar sem login:** qualquer pessoa consegue registrar uma run direto na API.
- **Combate decidido no cliente:** o computador do anfitrião simula os inimigos, então uma trapaça é possível.
- **Servidor único:** um reinício derruba as partidas em andamento, e não há limite de mensagens por jogador.
- **Trecho interno sem HTTPS:** do jogador ao CloudFront é criptografado, mas do CloudFront à EC2 não. O tráfego contém só o estado da partida, e a EC2 aceita conexões apenas do CloudFront.
- **Servidor e infraestrutura manuais:** só o jogo é publicado automaticamente; o resto depende de `pulumi up`.
