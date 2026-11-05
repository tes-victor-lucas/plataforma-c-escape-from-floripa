# Terminal C: escape from Floripa

**Estilo: Roguelike**

>Referências gameplay: Endless Wander, Soul Knight, Vampire Survivors

>Referências arte: Akira, NieR: Automata

**Premissa curta**:
No ano de 2067, uma IA (Floria) assumiu o controle do Centro de Florianópolis para otimizar a decadente mobilidade urbana manézinha. Agora drones de fiscalização, patinetes elétricos e a Guarda Municipal com implantes cibernéticos perseguem qualquer pessoa que tente atravessar a cidade. Seu objetivo? Chegar até a plataforma C do Ticen, e pegar um 763.2 via Kobrasol, fugindo de Florianópolis.

## Como rodar

1. É necessário ter node instalado no computador
2. Clone o repositório e entre no repositório
3. Entre na pasta 'game' -> cd game
4. Dê o comando "npm install" ou "npm i"
5. Dê o comando "npm run dev"
6. Entre em http://localhost:1234/

## Multiplayer na mesma rede (dois jogadores)

No computador que hospedará a partida, execute na raiz do projeto:

```bash
npm run lan
```

O terminal mostrará um único endereço, como `http://192.168.1.42:8080`. Abra exatamente esse endereço nos dois computadores e escolha **JOGAR > MULTIPLAYER** com o mesmo nome de sala. O segundo computador precisa apenas do navegador; não precisa clonar nem iniciar o projeto.

Jogo e WebSocket usam a mesma porta para evitar divergência de servidor ou bloqueio de uma segunda porta. Cada sala aceita no máximo dois jogadores.

## Pontuação e placar

A pontuação da run é acompanhada no frontend e recalculada pelo backend serverless em Python. O relógio competitivo usa os horários registrados pela API, e somente vitórias entram no ranking. Consulte `backend/README.md`, `docs/api-placar.yaml` e `docs/modelo-dados-placar.md` para executar e implantar a API Gateway + Lambda + DynamoDB definida em `pulumi/`.
