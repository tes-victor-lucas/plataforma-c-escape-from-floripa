import { MAX_PLAYERS } from './multiplayer.js';

/** Salas em memória para o servidor local e os testes; na AWS o mesmo papel é do DynamoDB (lambda/aws.js). */
export function createMemoryStore() {
    const rooms = new Map();
    const clients = new Map();

    return {
        async getRoom(clientId) {
            return clients.get(clientId)?.roomId;
        },

        async tryJoin(roomId, clientId) {
            const room = rooms.get(roomId) ?? { players: [], started: false };
            if (room.players.length >= MAX_PLAYERS || room.started) return undefined;
            room.players.push(clientId);
            rooms.set(roomId, room);
            clients.set(clientId, { roomId });
            return [...room.players];
        },

        async start(roomId, players) {
            rooms.get(roomId).started = true;
            const [first, second] = players;
            clients.get(first).peer = second;
            clients.get(second).peer = first;
        },

        async getPeer(clientId) {
            return clients.get(clientId)?.peer;
        },

        async leave(clientId) {
            const roomId = clients.get(clientId)?.roomId;
            clients.delete(clientId);
            const room = rooms.get(roomId);
            if (!room) return undefined;
            room.players = room.players.filter((playerId) => playerId !== clientId);
            if (room.players.length === 0) rooms.delete(roomId);
            for (const playerId of room.players) delete clients.get(playerId).peer;
            return { roomId, players: [...room.players] };
        },

        async openRooms(limit) {
            return [...rooms]
                .filter(([, room]) => room.players.length < MAX_PLAYERS && !room.started)
                .slice(0, limit)
                .map(([roomId]) => roomId);
        }
    };
}
