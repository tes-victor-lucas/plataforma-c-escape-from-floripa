import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

// Teste de fumaça depois do deploy: uma dupla entra numa sala nova e a partida precisa começar nos dois.
// Uso: node scripts/smoke.js wss://escape-from-floripa.negoci.online/ws https://escape-from-floripa.negoci.online
const [url, origin] = process.argv.slice(2);
const roomId = `smoke-${randomUUID().slice(0, 8)}`;
const timeout = setTimeout(() => {
    console.error(`Partida não começou em 15 s (${url}).`);
    process.exit(1);
}, 15_000);

const players = ['a', 'b'].map(() => new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    socket.on('open', () => socket.send(JSON.stringify({ type: 'lobby.join', roomId })));
    socket.on('message', (data) => {
        if (JSON.parse(data.toString()).type === 'match.ready') resolve(socket);
    });
    socket.on('error', reject);
}));

const sockets = await Promise.all(players);
clearTimeout(timeout);
for (const socket of sockets) socket.close();
console.log(`Multiplayer ok: sala ${roomId} iniciou com dois jogadores.`);
