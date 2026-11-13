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

/** Valida e distribui o estado efêmero de jogadores de uma partida pronta. */
export class MatchAgent {
    #unsubscribe;

    constructor(broker, lobbyAgent) {
        this.broker = broker;
        this.lobbyAgent = lobbyAgent;
    }

    start() {
        this.#unsubscribe = this.broker.subscribe('client.message', (event) => {
            if (event.message.type === 'player.state') this.relayState(event.clientId, event.message);
            if (event.message.type === 'match.event') this.relayEvent(event.clientId, event.message.event);
        });
    }

    stop() {
        this.#unsubscribe?.();
    }

    relayState(clientId, message) {
        const room = this.lobbyAgent.getRoomForClient(clientId);
        if (!room?.ready) return;
        const state = this.sanitizeState(message);
        if (!state) {
            this.broker.publish('transport.send', {
                clientId,
                message: { type: 'error', code: 'INVALID_PLAYER_STATE' }
            });
            return;
        }

        for (const playerId of room.players) {
            if (playerId === clientId) continue;
            this.broker.publish('transport.send', {
                clientId: playerId,
                message: { type: 'player.state', playerId: clientId, ...state }
            });
        }
    }

    /** Os eventos de jogo são decididos pelos clientes; aqui só limitamos o que circula. */
    relayEvent(clientId, event) {
        const room = this.lobbyAgent.getRoomForClient(clientId);
        if (!room?.ready) return;
        if (!EVENT_KINDS.has(event?.kind) || JSON.stringify(event).length > MAX_EVENT_BYTES) {
            this.broker.publish('transport.send', {
                clientId,
                message: { type: 'error', code: 'INVALID_MATCH_EVENT' }
            });
            return;
        }

        for (const playerId of room.players) {
            if (playerId === clientId) continue;
            this.broker.publish('transport.send', {
                clientId: playerId,
                message: { type: 'match.event', playerId: clientId, event }
            });
        }
    }

    sanitizeState(message) {
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
            || worn > 255
        ) return undefined;

        return { sequence, x, y, facing, health, maxHealth, reviveProgress, revivesLeft, character, orbitCount, orbitRadius, companion, worn };
    }
}
