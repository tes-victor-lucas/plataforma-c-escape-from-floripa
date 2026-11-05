const MAX_PLAYERS = 2;
const PUBLIC_ROOM = 'publica';
const MAX_LISTED_ROOMS = 20;

/** Mantém salas e aplica o limite de dois jogadores por partida. */
export class LobbyAgent {
    #rooms = new Map();
    #clientRooms = new Map();
    #subscriptions = [];

    constructor(broker) {
        this.broker = broker;
    }

    start() {
        this.#subscriptions.push(
            this.broker.subscribe('connection.opened', ({ clientId }) => {
                this.send(clientId, { type: 'session.welcome', playerId: clientId });
            }),
            this.broker.subscribe('client.message', (event) => {
                if (event.message.type === 'lobby.join') this.join(event.clientId, event.message.roomId);
                if (event.message.type === 'lobby.list') this.sendOpenRooms(event.clientId);
            }),
            this.broker.subscribe('connection.closed', ({ clientId }) => this.leave(clientId))
        );
    }

    stop() {
        for (const unsubscribe of this.#subscriptions) unsubscribe();
        this.#subscriptions = [];
    }

    getRoomForClient(clientId) {
        const roomId = this.#clientRooms.get(clientId);
        return roomId ? this.#rooms.get(roomId) : undefined;
    }

    sendOpenRooms(clientId) {
        const rooms = [...this.#rooms.values()]
            .filter((room) => room.players.size < MAX_PLAYERS && !room.started)
            .slice(0, MAX_LISTED_ROOMS)
            .map((room) => room.id);
        this.send(clientId, { type: 'lobby.rooms', rooms });
    }

    join(clientId, requestedRoomId) {
        if (this.#clientRooms.has(clientId)) return;
        const normalizedRoomId = this.normalizeRoomId(requestedRoomId);
        const roomId = normalizedRoomId === PUBLIC_ROOM ? this.findPublicRoomId() : normalizedRoomId;
        const room = this.#rooms.get(roomId) ?? { id: roomId, players: new Set(), ready: false, started: false };

        // Quem chega depois não teria inimigos: a partida em andamento segue só com quem ficou.
        if (room.players.size >= MAX_PLAYERS || room.started) {
            this.send(clientId, { type: 'lobby.rejected', code: 'ROOM_FULL', roomId });
            return;
        }

        this.#rooms.set(roomId, room);
        room.players.add(clientId);
        this.#clientRooms.set(clientId, roomId);
        const players = [...room.players];
        this.send(clientId, { type: 'lobby.joined', roomId, playerId: clientId, players });
        this.broadcast(room, { type: 'lobby.players', roomId, players });

        if (players.length === MAX_PLAYERS) {
            room.ready = true;
            room.started = true;
            this.broadcast(room, { type: 'match.ready', roomId, players });
        }
    }

    leave(clientId) {
        const roomId = this.#clientRooms.get(clientId);
        if (!roomId) return;
        const room = this.#rooms.get(roomId);
        this.#clientRooms.delete(clientId);
        if (!room) return;

        room.players.delete(clientId);
        room.ready = false;
        if (room.players.size === 0) {
            this.#rooms.delete(roomId);
            return;
        }

        this.broadcast(room, {
            type: 'player.left',
            roomId,
            playerId: clientId,
            players: [...room.players]
        });
    }

    /** Sem código de sala, cada dupla nova ganha a próxima sala livre em vez de ser recusada. */
    findPublicRoomId() {
        for (let index = 1; ; index += 1) {
            const roomId = index === 1 ? PUBLIC_ROOM : `${PUBLIC_ROOM}-${index}`;
            const room = this.#rooms.get(roomId);
            if (!room || (room.players.size < MAX_PLAYERS && !room.started)) return roomId;
        }
    }

    normalizeRoomId(value) {
        if (typeof value !== 'string') return PUBLIC_ROOM;
        const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
        return normalized || PUBLIC_ROOM;
    }

    broadcast(room, message, exceptClientId) {
        for (const playerId of room.players) {
            if (playerId !== exceptClientId) this.send(playerId, message);
        }
    }

    send(clientId, message) {
        this.broker.publish('transport.send', { clientId, message });
    }
}
