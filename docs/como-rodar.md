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

Mantenha o jogo e o servidor abertos. Acesse a URL abaixo em duas abas e selecione MULTIPLAYER nas duas:

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

Servidor multiplayer:

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

A API de placar não possui um servidor local. Ela é executada na AWS por meio de Lambda e API Gateway.

Sem a API configurada, o jogo funciona normalmente, mas não salva runs nem carrega o ranking remoto. A infraestrutura está descrita em `docs/nuvem-aws-pulumi.md`.
