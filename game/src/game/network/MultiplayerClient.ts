import type { Direction } from '../entities/Player';
import type { CoopEvent, MatchReadyMessage, ServerMessage } from './protocol';

type MessageHandler = (message: ServerMessage) => void;

/** Cliente persistente entre as cenas do menu e do mundo. */
export class MultiplayerClient {
    private socket?: WebSocket;
    private handlers = new Set<MessageHandler>();
    private sequence = 0;
    playerId?: string;
    match?: MatchReadyMessage;
    /** Conta as salas carregadas aqui; o parceiro avisa quando carregou a dele. */
    roomEpoch = 0;
    /** Fica no cliente porque o aviso pode chegar enquanto `World` reinicia. */
    peerReadyEpoch = 0;
    /** Vale para a partida inteira, e `World` reinicia a cada sala. */
    revivesUsed = 0;

    async connect(onStatus?: (status: string) => void) {
        this.disconnect();
        const { url, roomId } = await this.getConnectionParameters();

        return new Promise<MatchReadyMessage>((resolve, reject) => {
            const socket = new WebSocket(url);
            this.socket = socket;
            let settled = false;
            const waitTimeout = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('Outro jogador não entrou. Confiram se abriram o mesmo link.'));
            }, 60_000);

            const settle = (callback: () => void) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(waitTimeout);
                callback();
            };

            socket.addEventListener('open', () => {
                onStatus?.(`SALA ${roomId.toUpperCase()}: ENTRANDO...`);
                socket.send(JSON.stringify({ type: 'lobby.join', roomId }));
            });
            socket.addEventListener('message', (event) => {
                const message = this.parse(event.data);
                if (!message) return;
                if (message.type === 'session.welcome') this.playerId = message.playerId;
                if (message.type === 'match.event' && message.event.kind === 'world.ready') {
                    this.peerReadyEpoch = message.event.epoch;
                }
                if (message.type === 'lobby.joined' || message.type === 'lobby.players') {
                    onStatus?.(`SALA ${message.roomId.toUpperCase()}: ${message.players.length}/2 JOGADORES`);
                }
                if (message.type === 'match.ready') {
                    this.match = message;
                    settle(() => resolve(message));
                }
                if (message.type === 'lobby.rejected') {
                    settle(() => reject(new Error('A sala já possui dois jogadores.')));
                }
                for (const handler of this.handlers) handler(message);
            });
            socket.addEventListener('error', () => {
                settle(() => reject(new Error('Não foi possível conectar ao servidor multiplayer.')));
            });
            socket.addEventListener('close', () => {
                settle(() => reject(new Error('A conexão multiplayer foi encerrada.')));
                // `disconnect()` limpa os ouvintes antes, então isto só avisa de queda real.
                for (const handler of this.handlers) {
                    handler({ type: 'player.left', roomId, playerId: '', players: [] });
                }
            });
        });
    }

    private async getConnectionParameters() {
        const parameters = new URLSearchParams(window.location.search);
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        let url = parameters.get('server') ?? `${protocol}://${window.location.hostname}:8080`;
        let roomId = parameters.get('room') ?? 'publica';

        if (!parameters.has('server')) {
            try {
                const response = await fetch('/multiplayer-config.json', { cache: 'no-store' });
                if (response.ok) {
                    const config = await response.json() as { server?: unknown; room?: unknown };
                    if (typeof config.server === 'string') url = config.server;
                    if (!parameters.has('room') && typeof config.room === 'string') roomId = config.room;
                }
            } catch {
                // O servidor de desenvolvimento antigo continua usando a porta 8080.
            }
        }

        return { url, roomId };
    }

    subscribe(handler: MessageHandler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    get isHost() {
        return this.match?.players[0] === this.playerId;
    }

    sendPlayerState(state: {
        x: number;
        y: number;
        facing: Direction;
        health: number;
        maxHealth: number;
        reviveProgress: number;
    }) {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: 'player.state',
            sequence: this.sequence++,
            ...state
        }));
    }

    sendEvent(event: CoopEvent) {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({ type: 'match.event', event }));
    }

    disconnect() {
        this.socket?.close();
        this.socket = undefined;
        this.playerId = undefined;
        this.match = undefined;
        this.sequence = 0;
        this.roomEpoch = 0;
        this.peerReadyEpoch = 0;
        this.revivesUsed = 0;
        this.handlers.clear();
    }

    private parse(value: unknown): ServerMessage | undefined {
        try {
            const message = JSON.parse(String(value)) as ServerMessage;
            return typeof message?.type === 'string' ? message : undefined;
        } catch {
            return undefined;
        }
    }
}

export const multiplayerClient = new MultiplayerClient();
