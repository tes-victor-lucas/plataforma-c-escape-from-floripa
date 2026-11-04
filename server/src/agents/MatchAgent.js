const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const EVENT_KINDS = new Set([
    'enemy.spawn', 'enemy.snapshot', 'enemy.shot', 'enemy.hit', 'enemy.killed',
    'player.shot', 'player.damage', 'world.ready', 'wave.intermission', 'combat.complete',
    'cards.chosen', 'cards.released', 'room.request', 'room.transition'
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
        const { sequence, x, y, facing, health, maxHealth, reviveProgress } = message;
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
        ) return undefined;

        return { sequence, x, y, facing, health, maxHealth, reviveProgress };
    }
}
