import { randomUUID } from 'node:crypto';

/** Cuida somente do transporte WebSocket; regras de negócio ficam nos outros agentes. */
export class ConnectionAgent {
    #connections = new Map();

    constructor(broker, webSocketServer) {
        this.broker = broker;
        this.webSocketServer = webSocketServer;
        this.unsubscribeSend = broker.subscribe('transport.send', (message) => this.send(message));
    }

    start() {
        this.webSocketServer.on('connection', (socket) => {
            const clientId = randomUUID();
            this.#connections.set(clientId, socket);

            socket.on('message', (data) => this.receive(clientId, data));
            socket.on('close', () => this.disconnect(clientId));
            socket.on('error', () => this.disconnect(clientId));

            this.broker.publish('connection.opened', { clientId });
        });
    }

    stop() {
        this.unsubscribeSend();
        for (const socket of this.#connections.values()) socket.close();
        this.#connections.clear();
    }

    receive(clientId, data) {
        try {
            const message = JSON.parse(data.toString());
            if (!message || typeof message.type !== 'string') throw new Error('Tipo ausente.');
            this.broker.publish('client.message', { clientId, message });
        } catch {
            this.send({ clientId, message: { type: 'error', code: 'INVALID_MESSAGE' } });
        }
    }

    disconnect(clientId) {
        if (!this.#connections.delete(clientId)) return;
        this.broker.publish('connection.closed', { clientId });
    }

    send({ clientId, message }) {
        const socket = this.#connections.get(clientId);
        if (!socket || socket.readyState !== 1) return;
        socket.send(JSON.stringify(message));
    }
}
