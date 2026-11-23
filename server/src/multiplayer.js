/**
 * Regras do multiplayer, sem transporte: o servidor local (ws + memória) e as Lambdas do
 * API Gateway WebSocket (DynamoDB) chamam as mesmas funções com outro `store` e outro `send`.
 */
export const MAX_PLAYERS = 2;
const PUBLIC_ROOM = 'publica';
const MAX_LISTED_ROOMS = 20;
const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const CHARACTERS = new Set(['padrao', 'gaucho']);
const EVENT_KINDS = new Set([
    'enemy.spawn', 'enemy.snapshot', 'enemy.shot', 'enemy.hit', 'enemy.killed',
    'player.shot', 'player.damage', 'world.ready', 'wave.intermission', 'combat.complete',
    'cards.chosen', 'cards.released', 'room.request', 'room.transition',
    'player.swing', 'enemy.strike', 'item.drop', 'item.collected', 'player.effect',
    // Sala V: catraca de um em um e o golem decidido pelo anfitrião.
    'ticen.gate', 'boss.wake', 'boss.action',
    // Disputa pela última vaga do 763.2.
    'escape.vote', 'escape.duel', 'chest.spawn', 'chest.claim', 'chest.opened', 'duel.lost',
    // Menus que congelam a dupla e a pergunta dos esconderijos, respondida pelos dois.
    'game.pause', 'gateway.vote'
]);
const MAX_EVENT_BYTES = 16_384;

/** Sem origem configurada, tudo é aceito: é o caso de rodar localmente. Várias origens vão separadas por vírgula. */
export function isOriginAllowed(origin, allowedOrigin) {
    return !allowedOrigin || allowedOrigin.split(',').includes(origin);
}

export function normalizeRoomId(value) {
    if (typeof value !== 'string') return PUBLIC_ROOM;
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
    return normalized || PUBLIC_ROOM;
}

async function broadcast(send, players, message) {
    await Promise.all(players.map((playerId) => send(playerId, message)));
}

export async function join({ store, send }, clientId, requestedRoomId) {
    if (await store.getRoom(clientId)) return;
    let roomId = normalizeRoomId(requestedRoomId);
    let players;
    if (roomId === PUBLIC_ROOM) {
        // Sem código de sala, cada dupla nova ganha a próxima sala livre em vez de ser recusada.
        for (let index = 1; !players; index += 1) {
            roomId = index === 1 ? PUBLIC_ROOM : `${PUBLIC_ROOM}-${index}`;
            players = await store.tryJoin(roomId, clientId);
        }
    } else {
        players = await store.tryJoin(roomId, clientId);
    }

    // Quem chega depois não teria inimigos: a partida em andamento segue só com quem ficou.
    if (!players) {
        await send(clientId, { type: 'lobby.rejected', code: 'ROOM_FULL', roomId });
        return;
    }
    // O API Gateway não deixa responder no $connect, então o id do jogador vai na entrada da sala.
    await send(clientId, { type: 'session.welcome', playerId: clientId });
    await send(clientId, { type: 'lobby.joined', roomId, playerId: clientId, players });
    await broadcast(send, players, { type: 'lobby.players', roomId, players });
    if (players.length === MAX_PLAYERS) {
        await store.start(roomId, players);
        await broadcast(send, players, { type: 'match.ready', roomId, players });
    }
}

export async function leave({ store, send }, clientId) {
    const left = await store.leave(clientId);
    if (!left?.players.length) return;
    await broadcast(send, left.players, {
        type: 'player.left', roomId: left.roomId, playerId: clientId, players: left.players
    });
}

export async function listRooms({ store, send }, clientId) {
    await send(clientId, { type: 'lobby.rooms', rooms: await store.openRooms(MAX_LISTED_ROOMS) });
}

export async function relayState({ store, send }, clientId, message) {
    const peer = await store.getPeer(clientId);
    if (!peer) return;
    const state = sanitizeState(message);
    if (!state) {
        await send(clientId, { type: 'error', code: 'INVALID_PLAYER_STATE' });
        return;
    }
    await send(peer, { type: 'player.state', playerId: clientId, ...state });
}

/** Os eventos de jogo são decididos pelos clientes; aqui só limitamos o que circula. */
export async function relayEvent({ store, send }, clientId, event) {
    const peer = await store.getPeer(clientId);
    if (!peer) return;
    if (!EVENT_KINDS.has(event?.kind) || JSON.stringify(event).length > MAX_EVENT_BYTES) {
        await send(clientId, { type: 'error', code: 'INVALID_MATCH_EVENT' });
        return;
    }
    await send(peer, { type: 'match.event', playerId: clientId, event });
}

/** Faz localmente o que o API Gateway faz com `$request.body.type`; tipos desconhecidos são ignorados. */
export async function dispatch(context, clientId, message) {
    if (!message || typeof message.type !== 'string') {
        await context.send(clientId, { type: 'error', code: 'INVALID_MESSAGE' });
        return;
    }
    if (message.type === 'lobby.join') await join(context, clientId, message.roomId);
    if (message.type === 'lobby.list') await listRooms(context, clientId);
    if (message.type === 'player.state') await relayState(context, clientId, message);
    if (message.type === 'match.event') await relayEvent(context, clientId, message.event);
}

export function sanitizeState(message) {
    const { sequence, x, y, facing, health, maxHealth, reviveProgress, revivesLeft, character = 'padrao' } = message;
    // Faíscas orbitais e drone companheiro vão no estado; sem eles o parceiro não vê essas cartas.
    const { orbitCount = 0, orbitRadius = 0, companion = false } = message;
    // Itens vestidos (chapéu, capacete, galochas): um bit por item, para o parceiro ver no personagem.
    const { worn = 0 } = message;
    if (
        !Number.isSafeInteger(sequence)
        || sequence < 0
        || !Number.isFinite(x)
        || !Number.isFinite(y)
        || Math.abs(x) > 10000
        || Math.abs(y) > 10000
        || !DIRECTIONS.has(facing)
        || !Number.isFinite(health)
        || !Number.isFinite(maxHealth)
        || health < 0
        || maxHealth <= 0
        || health > maxHealth
        || !Number.isFinite(reviveProgress)
        || reviveProgress < 0
        || reviveProgress > 1
        || !Number.isSafeInteger(revivesLeft)
        || revivesLeft < 0
        || !CHARACTERS.has(character)
        || !Number.isSafeInteger(orbitCount)
        || orbitCount < 0
        || orbitCount > 32
        || !Number.isFinite(orbitRadius)
        || orbitRadius < 0
        || orbitRadius > 1000
        || typeof companion !== 'boolean'
        || !Number.isSafeInteger(worn)
        || worn < 0
        || worn > 0xffff
    ) return undefined;

    return { sequence, x, y, facing, health, maxHealth, reviveProgress, revivesLeft, character, orbitCount, orbitRadius, companion, worn };
}
