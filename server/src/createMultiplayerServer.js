import { WebSocketServer } from 'ws';
import { attachMultiplayer } from './attachMultiplayer.js';
import { isOriginAllowed } from './multiplayer.js';

// Maior que o limite de eventos de multiplayer.js, que responde com um erro claro.
const MAX_MESSAGE_BYTES = 32 * 1024;

/** Servidor para desenvolvimento local; em produção o API Gateway WebSocket chama as Lambdas de src/lambda. */
export function createMultiplayerServer({ port, allowedOrigin }) {
    const webSocketServer = new WebSocketServer({
        port,
        maxPayload: MAX_MESSAGE_BYTES,
        verifyClient: ({ origin }) => isOriginAllowed(origin, allowedOrigin)
    });
    const closeSockets = attachMultiplayer(webSocketServer);

    return {
        close() {
            closeSockets();
            return new Promise((resolve) => webSocketServer.close(resolve));
        }
    };
}
