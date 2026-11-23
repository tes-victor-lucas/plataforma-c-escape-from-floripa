# Como rodar o projeto

## Requisitos

- Node.js e npm
- Python 3, caso queira executar os testes do backend

## Rodar o jogo

Na raiz do projeto, execute:

```bash
cd game
npm install
npm run dev-nolog
```

Depois, acesse http://localhost:1234.

O comando `npm run dev` também funciona, mas envia uma métrica anônima do template Phaser.

## Rodar o servidor multiplayer

Abra outro terminal na raiz do projeto e execute:

```bash
cd server
npm install
npm start
```

O servidor será iniciado em ws://localhost:8080.

Para reiniciar automaticamente após mudanças no código, use:

```bash
npm run dev
```

Para trocar a porta:

```bash
PORT=9090 npm start
```

## Testar o multiplayer

Mantenha o jogo e o servidor abertos. Selecione MULTIPLAYER em duas abas: uma cria a sala e a outra escolhe na lista. Sem o servidor rodando, o menu mostra "SERVIDOR MULTIPLAYER INDISPONÍVEL". Para pular essa etapa, use a URL abaixo:

http://localhost:1234/?room=minha-sala&server=ws://localhost:8080

Cada sala aceita até dois jogadores. O parâmetro `room` escolhe a sala e o parâmetro `server` informa o endereço do servidor WebSocket.

## Gerar o build

```bash
cd game
npm run build-nolog
```

Os arquivos serão gerados em `game/dist`.

Para conferir o build localmente:

```bash
python3 -m http.server 4173 --directory dist
```

Acesse http://localhost:4173.

## Rodar os testes

Jogo:

```bash
cd game
npm test
npx tsc --noEmit
```

Multiplayer (a integração com o DynamoDB Local roda só com `DYNAMODB_ENDPOINT`, veja `server/README.md`):

```bash
cd server
npm test
```

Backend de pontuação:

```bash
cd backend
python3 -m unittest discover -s tests
```

## API de placar

Com Docker e o [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) instalados, o placar roda localmente com as mesmas Lambdas da AWS e um DynamoDB Local:

```bash
cd backend
make api     # API em http://127.0.0.1:3000; Ctrl+C para parar
make stop    # desliga o DynamoDB Local (os dados ficam só em memória)
```

Com `npm run dev` (ou `dev-nolog`) rodando no jogo, o `/api` de http://localhost:1234 é repassado para o SAM (`game/.proxyrc.json`), como o CloudFront faz em produção. Localmente não há login: as runs entram no placar como "Jogador".

Sem o SAM rodando, o jogo funciona normalmente, mas não salva runs nem carrega o ranking. A infraestrutura da AWS está descrita em `docs/nuvem-aws-pulumi.md`.
