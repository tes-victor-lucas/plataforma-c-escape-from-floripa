# Servidor multiplayer

Servidor WebSocket para partidas de até dois jogadores. O código é dividido em agentes que não se conhecem pelo transporte: eles trocam eventos pelo `MessageBroker`.

- `ConnectionAgent`: conexões e serialização WebSocket.
- `LobbyAgent`: salas, entrada/saída e limite de dois participantes.
- `MatchAgent`: validação e distribuição do estado em tempo real.

## Executar

```bash
cd server
npm install
npm start
```

Por padrão o servidor usa `ws://localhost:8080`. A porta pode ser alterada com `PORT`.

Abra o jogo em duas abas e selecione **MULTIPLAYER** nas duas. O parâmetro `room` separa partidas, e `server` permite indicar outro broker WebSocket:

```text
http://localhost:1234/?room=minha-sala&server=ws://localhost:8080
```
