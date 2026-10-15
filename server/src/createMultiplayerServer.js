import { WebSocketServer } from 'ws';
import { ConnectionAgent } from './agents/ConnectionAgent.js';
import { LobbyAgent } from './agents/LobbyAgent.js';
import { MatchAgent } from './agents/MatchAgent.js';
import { MessageBroker } from './broker/MessageBroker.js';

export function createMultiplayerServer({ port }) {
    const broker = new MessageBroker();
    const webSocketServer = new WebSocketServer({ port });
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
