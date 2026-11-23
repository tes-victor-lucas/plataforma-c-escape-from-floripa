import { randomUUID } from 'node:crypto';
import { createMemoryStore } from './memoryStore.js';
import { dispatch, leave } from './multiplayer.js';

/**
 * Liga um WebSocketServer do `ws` às regras de multiplayer.js, com as salas em memória.
 * Não importa o `ws`: o game/lan-server.mjs passa o servidor dele, criado com o `ws` do jogo.
 */
export function attachMultiplayer(webSocketServer) {
    const sockets = new Map();
    const context = {
        store: createMemoryStore(),
        async send(clientId, message) {
            const socket = sockets.get(clientId);
            if (socket?.readyState === 1) socket.send(JSON.stringify(message));
        }
    };

    webSocketServer.on('connection', (socket) => {
        const clientId = randomUUID();
        sockets.set(clientId, socket);
        // Uma mensagem por vez por jogador, na ordem em que chegaram.
        let queue = Promise.resolve();
        socket.on('message', (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch {
                message = undefined;
            }
            queue = queue.then(() => dispatch(context, clientId, message));
        });
        const close = () => {
            if (sockets.delete(clientId)) queue = queue.then(() => leave(context, clientId));
        };
        socket.on('close', close);
        socket.on('error', close);
    });

    return () => {
        for (const socket of sockets.values()) socket.close();
    };
}
