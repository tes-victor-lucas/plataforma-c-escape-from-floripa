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

## Multiplayer (dois jogadores)

O servidor fica separado em `server/` e usa agentes de conexão, lobby e partida coordenados por um broker de mensagens em memória. Em outro terminal:

```bash
cd server
npm install
npm start
```

Abra o jogo em duas abas e escolha **MULTIPLAYER**. Cada sala aceita no máximo dois jogadores. Consulte `server/README.md` para configurar sala, endereço do servidor e porta.
