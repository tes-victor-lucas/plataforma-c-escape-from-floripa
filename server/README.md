# Servidor multiplayer

Multiplayer para partidas de até dois jogadores. As regras ficam em `src/multiplayer.js`, sem transporte, e rodam de dois jeitos:

- **Produção:** API Gateway WebSocket com uma Lambda por rota em `src/lambda/` (`connect`, `disconnect`, `default`, `join`, `list`, `state`, `event`). `src/lambda/aws.js` guarda salas e conexões no DynamoDB e responde com `PostToConnection`.
- **Local:** `src/index.js` sobe um servidor `ws` com as salas em memória (`src/memoryStore.js`), e `game/lan-server.mjs` usa o mesmo código para partidas na rede local.

O primeiro jogador da sala é o anfitrião: o cliente dele simula inimigos e ondas, e o servidor só valida e retransmite estados e eventos para o parceiro.

## Executar

```bash
cd server
npm install
npm start
```

Por padrão o servidor usa `ws://localhost:8080`. A porta pode ser alterada com `PORT`, e `ALLOWED_ORIGIN` restringe as conexões a um ou mais sites, separados por vírgula (`https://a,https://b`). Sem o parâmetro `room`, cada dupla nova entra na próxima sala pública livre.

Abra o jogo em duas abas e selecione **MULTIPLAYER** nas duas. O parâmetro `room` separa partidas, e `server` permite indicar outro servidor WebSocket:

```text
http://localhost:1234/?room=minha-sala&server=ws://localhost:8080
```

## Testes

```bash
cd server
npm test                                            # regras, com as salas em memória
docker run -d -p 8000:8000 amazon/dynamodb-local
DYNAMODB_ENDPOINT=http://localhost:8000 npm test    # inclui a integração com o DynamoDB
```

Sem `DYNAMODB_ENDPOINT`, os testes de integração são pulados. O CI roda os dois.
