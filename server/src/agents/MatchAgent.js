const DIRECTIONS = new Set(['up', 'down', 'left', 'right']);

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

    sanitizeState(message) {
        const { sequence, x, y, facing } = message;
        if (
            !Number.isSafeInteger(sequence)
            || sequence < 0
            || !Number.isFinite(x)
            || !Number.isFinite(y)
            || Math.abs(x) > 10000
            || Math.abs(y) > 10000
            || !DIRECTIONS.has(facing)
        ) return undefined;

        return { sequence, x, y, facing };
    }
}
