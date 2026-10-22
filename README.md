# Terminal C: escape from Floripa

**Estilo: Roguelike**

>Referências gameplay: Endless Wander, Soul Knight, Vampire Survivors

>Referências arte: Akira, NieR: Automata

**Premissa curta**:
No ano de 2067, uma IA (Floria) assumiu o controle do Centro de Florianópolis para otimizar a decadente mobilidade urbana manézinha. Agora drones de fiscalização, patinetes elétricos e a Guarda Municipal com implantes cibernéticos perseguem qualquer pessoa que tente atravessar a cidade. Seu objetivo? Chegar até a plataforma C do Ticen, e pegar um 763.2 via Kobrasol, fugindo de Florianópolis.

## Como rodar

O guia completo, incluindo instalação, jogo, servidor multiplayer, build e testes, está em [`docs/como-rodar.md`](docs/como-rodar.md).

1. É necessário ter node instalado no computador
2. Clone o repositório e entre no repositório
3. Entre na pasta 'game' -> cd game
4. Dê o comando "npm install" ou "npm i"
5. Dê o comando "npm run dev"
6. Entre em http://localhost:1234/

## Multiplayer (dois jogadores)

O servidor fica separado em `server/` e usa agentes de conexão, lobby e partida coordenados por um broker de mensagens em memória. Em outro terminal:

```bash
cd server
npm install
npm start
```

Abra o jogo em duas abas e escolha **MULTIPLAYER**. Cada sala aceita no máximo dois jogadores. Consulte `server/README.md` para configurar sala, endereço do servidor e porta.

## Pontuação e placar

A pontuação da run é acompanhada no frontend e recalculada pelo backend serverless em Python. O relógio competitivo usa os horários registrados pela API, e somente vitórias entram no ranking. Consulte `backend/README.md`, `docs/api-placar.yaml` e `docs/modelo-dados-placar.md` para executar e implantar a API Gateway + Lambda + DynamoDB definida em `pulumi/`.

O inventário completo da infraestrutura implementada e planejada, com instruções de deploy e verificação, está em [`docs/nuvem-aws-pulumi.md`](docs/nuvem-aws-pulumi.md).
