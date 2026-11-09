import type { CharacterId } from '../config/characters';
import type { Direction } from '../entities/Player';
import type { CoopEvent, MatchReadyMessage, ServerMessage } from './protocol';

type MessageHandler = (message: ServerMessage) => void;

const ROOM_LIST_INTERVAL = 2_000;

/** Publicado com HTTPS, o servidor fica no mesmo domínio em `/ws`; localmente, na porta 8080. */
export function getDefaultServerUrl(location: Pick<Location, 'protocol' | 'host' | 'hostname'>) {
    return location.protocol === 'https:'
        ? `wss://${location.host}/ws`
        : `ws://${location.hostname}:8080`;
}

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

    async connect(onStatus?: (status: string) => void, roomName?: string) {
        this.disconnect();
        const { url, roomId } = await this.getConnectionParameters(roomName);

        return new Promise<MatchReadyMessage>((resolve, reject) => {
            const socket = new WebSocket(url);
            this.socket = socket;
            let settled = false;
            const waitTimeout = window.setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error('Ninguém entrou na sala a tempo.'));
            }, 300_000);

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

    /** Conexão própria e curta: só consulta a lista, sem entrar em nenhuma sala. */
    watchRooms(onRooms: (rooms: string[]) => void, onError: () => void) {
        let stopped = false;
        let socket: WebSocket | undefined;
        let timer: number | undefined;
        void this.getConnectionParameters().then(({ url }) => {
            if (stopped) return;
            const roomSocket = new WebSocket(url);
            socket = roomSocket;
            const request = () => {
                if (roomSocket.readyState === WebSocket.OPEN) roomSocket.send(JSON.stringify({ type: 'lobby.list' }));
            };
            roomSocket.addEventListener('open', () => {
                request();
                timer = window.setInterval(request, ROOM_LIST_INTERVAL);
            });
            roomSocket.addEventListener('message', (event) => {
                const message = this.parse(event.data);
                if (message?.type === 'lobby.rooms') onRooms(message.rooms);
            });
            roomSocket.addEventListener('close', () => {
                window.clearInterval(timer);
                if (!stopped) onError();
            });
        });
        return () => {
            stopped = true;
            window.clearInterval(timer);
            socket?.close();
        };
    }

    private async getConnectionParameters(roomName?: string) {
        const parameters = new URLSearchParams(window.location.search);
        let url = parameters.get('server') ?? getDefaultServerUrl(window.location);
        let roomId = roomName ?? parameters.get('room') ?? 'publica';

        if (!parameters.has('server')) {
            try {
                const response = await fetch('/multiplayer-config.json', { cache: 'no-store' });
                if (response.ok) {
                    const config = await response.json() as { server?: unknown; room?: unknown };
                    if (typeof config.server === 'string') url = config.server;
                    if (!roomName && !parameters.has('room') && typeof config.room === 'string') roomId = config.room;
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
        revivesLeft: number;
        character: CharacterId;
        orbitCount: number;
        orbitRadius: number;
        companion: boolean;
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
