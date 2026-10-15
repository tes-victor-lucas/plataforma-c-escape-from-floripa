import type { Direction } from '../entities/Player';
import type { MatchReadyMessage, ServerMessage } from './protocol';

type MessageHandler = (message: ServerMessage) => void;

/** Cliente persistente entre as cenas do menu e do mundo. */
export class MultiplayerClient {
    private socket?: WebSocket;
    private handlers = new Set<MessageHandler>();
    private sequence = 0;
    playerId?: string;
    match?: MatchReadyMessage;

    connect(onStatus?: (status: string) => void) {
        this.disconnect();
        const parameters = new URLSearchParams(window.location.search);
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const url = parameters.get('server') ?? `${protocol}://${window.location.hostname}:8080`;
        const roomId = parameters.get('room') ?? 'publica';

        return new Promise<MatchReadyMessage>((resolve, reject) => {
            const socket = new WebSocket(url);
            this.socket = socket;
            let settled = false;

            socket.addEventListener('open', () => {
                onStatus?.('AGUARDANDO OUTRO JOGADOR...');
                socket.send(JSON.stringify({ type: 'lobby.join', roomId }));
            });
            socket.addEventListener('message', (event) => {
                const message = this.parse(event.data);
                if (!message) return;
                if (message.type === 'session.welcome') this.playerId = message.playerId;
                if (message.type === 'match.ready') {
                    this.match = message;
                    settled = true;
                    resolve(message);
                }
                if (message.type === 'lobby.rejected') {
                    settled = true;
                    reject(new Error('A sala já possui dois jogadores.'));
                }
                for (const handler of this.handlers) handler(message);
            });
            socket.addEventListener('error', () => {
                if (!settled) reject(new Error('Não foi possível conectar ao servidor multiplayer.'));
            });
            socket.addEventListener('close', () => {
                if (!settled) reject(new Error('A conexão multiplayer foi encerrada.'));
            });
        });
    }

    subscribe(handler: MessageHandler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    sendPlayerState(x: number, y: number, facing: Direction) {
        if (this.socket?.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({
            type: 'player.state',
            sequence: this.sequence++,
            x,
            y,
            facing
        }));
    }

    disconnect() {
        this.socket?.close();
        this.socket = undefined;
        this.playerId = undefined;
        this.match = undefined;
        this.sequence = 0;
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
