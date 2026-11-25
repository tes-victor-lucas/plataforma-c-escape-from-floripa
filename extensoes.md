# Multiplayer e extensões

Este documento descreve o multiplayer do jogo e as duas extensões do trabalho: a dungeon procedural (Extensão 1) e o suporte a controle (Extensão 2).

## Multiplayer

O jogo tem um modo **cooperativo para dois jogadores**. No menu, um jogador cria uma sala em **JOGAR → MULTIPLAYER**, e o outro a vê na lista e clica em **ENTRAR**. A partida começa quando a sala tem dois jogadores.

### Tecnologias

| Parte | Tecnologia | Onde está |
|---|---|---|
| Cliente | WebSocket nativo do navegador | `game/src/game/network/MultiplayerClient.ts` |
| Regras do servidor | JavaScript (Node.js), sem dependência de transporte | `server/src/multiplayer.js` |
| Produção | API Gateway WebSocket + uma Lambda (Node.js 22) por rota + DynamoDB | `server/src/lambda/`, `pulumi/__main__.py` |
| Local e rede local | Servidor `ws` com as salas em memória | `server/src/index.js`, `server/src/memoryStore.js`, `game/lan-server.mjs` |
| Infraestrutura | Pulumi (Python) | `pulumi/__main__.py` |

### Divisão

As regras do multiplayer ficam em `server/src/multiplayer.js` e não sabem como as mensagens chegam nem onde as salas são guardadas. Cada função recebe um `store` (onde ficam as salas) e um `send` (como responder a um jogador). Assim, o mesmo código roda de dois jeitos:

- **Produção (sem servidor ligado):** o API Gateway mantém as conexões WebSocket abertas e chama uma Lambda para cada mensagem. Como cada chamada pode cair numa instância diferente da Lambda, as salas e conexões ficam no **DynamoDB** (`server/src/lambda/aws.js`), e as respostas saem pela API `PostToConnection` do API Gateway.
- **Local:** `server/src/index.js` sobe um servidor `ws` com as salas em memória (`memoryStore.js`). `game/lan-server.mjs` usa o mesmo código para partidas na rede local.

Os dados no DynamoDB usam duas chaves:

- `ROOM#<sala>`: os jogadores da sala e se a partida já começou.
- `CONN#<conexão>`: em que sala o jogador está e quem é o parceiro dele.

A entrada na sala é uma escrita **condicional** no DynamoDB: só passa se a sala tiver menos de dois jogadores e ainda não tiver começado. Assim, dois jogadores entrando ao mesmo tempo nunca viram três. Um TTL de 3 horas apaga salas e conexões abandonadas.

### Rotas

O API Gateway escolhe a rota pelo campo `type` da mensagem (`$request.body.type`), e cada rota tem a sua Lambda:

| Rota | Lambda | O que faz |
|---|---|---|
| `$connect` | `connect.js` | Aceita a conexão só se vier do site oficial ou da Feira de Jogos (`ALLOWED_ORIGIN`) |
| `$disconnect` | `disconnect.js` | Tira o jogador da sala e avisa o parceiro com `player.left` |
| `lobby.join` | `join.js` | Entra numa sala. Sem código, cai na próxima sala pública livre (`publica`, `publica-2`…) |
| `lobby.list` | `list.js` | Lista até 20 salas abertas |
| `player.state` | `state.js` | Valida o estado do jogador e repassa ao parceiro |
| `match.event` | `event.js` | Valida o evento da partida e repassa ao parceiro |
| `$default` | `default.js` | Responde `INVALID_MESSAGE` a JSON inválido ou tipo desconhecido |

O servidor responde com `session.welcome`, `lobby.joined`, `lobby.players`, `lobby.rooms`, `lobby.rejected` (sala cheia), `match.ready` (a partida começa) e `player.left`.

Para o jogador, tudo fica num endereço só. O CloudFront distribui as requisições:

- `/` → o jogo, servido do S3.
- `/api/*` → o placar (API Gateway HTTP + Lambda em Python + DynamoDB).
- `/ws` → o multiplayer. Em HTTPS, o jogo conecta em `wss://<domínio>/ws`.

### Modelo de rede

O **primeiro jogador da sala é o anfitrião**: o navegador dele simula os inimigos e as ondas e avisa o parceiro por eventos. Os dois jogadores trocam:

- `player.state`: posição, direção, vida, revive, personagem, cartas visíveis (faíscas orbitais, drone companheiro) e itens vestidos. Cada jogador envia cerca de 20 por segundo.
- `match.event`: inimigo nasceu, tiro, dano, inimigo morto, carta escolhida, troca de sala, pausa, votação para entrar nos esconderijos, chefe da Sala V, entre outros.

O servidor não roda a lógica do jogo, mas também não repassa qualquer coisa:

- confere se coordenadas, vida e os outros campos do estado estão em faixas válidas;
- só aceita eventos de uma lista fixa de tipos, com no máximo 16 KB cada;
- só aceita conexões vindas do domínio oficial;
- limita a taxa de mensagens no estágio do API Gateway.

## Extensão 1: dungeon procedural

As dungeons secretas não são desenhadas à mão: o mapa é gerado por código a partir de uma **seed**. O código está em `game/src/game/map/ProceduralDungeon.ts`.

### O que é seed

Seed ("semente") é **um número que serve de ponto de partida para o gerador de números aleatórios**. O computador não gera aleatoriedade de verdade: ele usa uma fórmula que, a partir da seed, produz uma sequência de números que parecem aleatórios. Por isso, a **mesma seed sempre gera a mesma sequência e, portanto, a mesma dungeon**. Mudando a seed, muda o mapa.

No jogo:

- A cada partida, a seed é sorteada com `Math.random()` e guardada no estado da partida (`game/src/game/config/dungeon.ts`). Se o jogador sai da dungeon e volta, encontra o mesmo mapa.
- No multiplayer, o anfitrião envia a seed ao parceiro, então **os dois geram o mesmo mapa sem mandar o mapa inteiro pela rede**, só um número.
- As duas dungeons usam o mesmo gerador. O esconderijo dos gaúchos (pelo bueiro da Sala I) usa uma seed derivada da principal, então tem outro formato.

### Como o mapa é gerado

1. Começa com um grid de **50×40 tiles, todo de parede**.
2. **Escava 8 salas** em sequência, da esquerda para a direita. A altura de cada uma varia em relação à anterior, e o tamanho é sorteado (de 6 a 9 tiles).
3. **Liga as salas com corredores em "L"** de 3 tiles de largura. A seed decide se o "L" vai primeiro na horizontal ou na vertical.
4. **Abre 3 câmaras laterais** acima ou abaixo do caminho principal, para a dungeon não ficar uma linha reta.
5. **Coloca até 12 obstáculos** (móveis e props). Antes de aceitar cada um, roda uma **busca em largura (BFS)** a partir da entrada. Se o obstáculo deixar alguma parte do mapa inacessível, ele é descartado. Isso garante que a dungeon **sempre pode ser percorrida inteira**.
6. Sorteia o visual de cada tile entre 4 variações de piso e 4 de parede.

### No jogo

- A entrada da dungeon principal é uma **passagem secreta numa parede da Sala II**.
- Lá dentro há ondas de inimigos (10 por onda) e uma recompensa.
- O combate fica salvo: se o jogador sai no meio dele, continua de onde parou ao voltar.

## Extensão 2: suporte a controle

O jogo pode ser jogado inteiro com um controle (gamepad), além do teclado e do toque na tela.

### Tecnologia

- Usa a **Gamepad API** nativa do navegador (`navigator.getGamepads()`), sem biblioteca extra.
- O código está em `game/src/game/input/GamepadInput.ts`.
- Funciona com controles USB ou Bluetooth, e o controle pode ser conectado com o jogo já aberto.

### Como funciona

- **Leitura a cada frame:** o navegador não avisa quando um botão é apertado. Ele só informa o estado atual dos botões e eixos. O jogo consulta esse estado a cada frame e compara com o frame anterior. Assim sabe se o botão está **segurado** (`isDown`, usado para andar) ou se **acabou de ser apertado** (`justPressed`, usado para confirmar nos menus e para o dash, sem disparar várias vezes).
- **Movimento:** aceita o **analógico**, com zona morta de 0,35 para ignorar o controle "derivando" sozinho, e o **direcional**. O vetor é normalizado, então andar na diagonal não fica mais rápido. O movimento do controle é somado ao do teclado e ao do toque, então todos funcionam juntos.
- **Ações:** mover, confirmar, cancelar, dash, atacar, interagir e pausar.
- **Dois mapeamentos de botões:**
  - **Padrão** (Xbox/PlayStation, que o navegador reconhece como `standard`): A confirma e ataca, B cancela e dá dash, RB também dá dash e Start pausa.
  - **Controle genérico estilo SNES** (USB `0810:0001`): ele numera os botões de outro jeito, então tem um mapa próprio para que o botão de baixo continue sendo o de confirmar.
- **Menus:** funciona em todas as telas (menu principal, pausa, escolha de cartas, inventário, placar, carteira e fliperama). Quando um menu abre por cima de outro, **só a tela do topo responde ao controle**, então um botão não aciona duas telas ao mesmo tempo. E quando uma tela abre com o botão ainda apertado, ela ignora esse mesmo toque.
