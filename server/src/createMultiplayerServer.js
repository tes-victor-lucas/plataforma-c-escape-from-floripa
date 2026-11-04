import { WebSocketServer } from 'ws';
import { ConnectionAgent, isOriginAllowed } from './agents/ConnectionAgent.js';
import { LobbyAgent } from './agents/LobbyAgent.js';
import { MatchAgent } from './agents/MatchAgent.js';
import { MessageBroker } from './broker/MessageBroker.js';

// Maior que o limite de eventos do MatchAgent, que responde com um erro claro.
const MAX_MESSAGE_BYTES = 32 * 1024;

export function createMultiplayerServer({ port, allowedOrigin }) {
    const broker = new MessageBroker();
    const webSocketServer = new WebSocketServer({
        port,
        maxPayload: MAX_MESSAGE_BYTES,
        verifyClient: ({ origin }) => isOriginAllowed(origin, allowedOrigin)
    });
    const connectionAgent = new ConnectionAgent(broker, webSocketServer);
    const lobbyAgent = new LobbyAgent(broker);
    const matchAgent = new MatchAgent(broker, lobbyAgent);

    lobbyAgent.start();
    matchAgent.start();
    connectionAgent.start();

    return {
        close() {
            connectionAgent.stop();
            lobbyAgent.stop();
            matchAgent.stop();
            return new Promise((resolve) => webSocketServer.close(resolve));
        }
    };
}
