import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import parcelCore from '@parcel/core';
import { WebSocketServer } from 'ws';
import { ConnectionAgent } from '../server/src/agents/ConnectionAgent.js';
import { LobbyAgent } from '../server/src/agents/LobbyAgent.js';
import { MatchAgent } from '../server/src/agents/MatchAgent.js';
import { MessageBroker } from '../server/src/broker/MessageBroker.js';

const { Parcel } = parcelCore;
const gameDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(gameDirectory, 'dist');
const parsedPort = Number.parseInt(process.env.PORT ?? '8080', 10);
const port = Number.isSafeInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8080;

const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.mp3', 'audio/mpeg'],
    ['.otf', 'font/otf'],
    ['.png', 'image/png'],
    ['.ttf', 'font/ttf'],
    ['.wav', 'audio/wav']
]);

async function buildGame() {
    console.log('Preparando o jogo...');
    const bundler = new Parcel({
        entries: [path.join(gameDirectory, 'index.html')],
        config: path.join(gameDirectory, 'parcel', '.parcel.prod'),
        defaultConfig: path.join(gameDirectory, 'node_modules', '@parcel', 'config-default', 'index.json'),
        mode: 'development',
        shouldPatchConsole: false,
        // Com cache, o clean-dist apaga bundles e o index.html pode continuar apontando para eles.
        shouldDisableCache: true,
        defaultTargetOptions: {
            distDir: distDirectory,
            publicUrl: '/',
            sourceMaps: false
        }
    });
    await bundler.run();
}

function sendJson(response, statusCode, value) {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    response.end(JSON.stringify(value));
}

async function serveFile(request, response) {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.pathname === '/multiplayer-config.json') {
        const host = request.headers.host;
        if (!host) return sendJson(response, 400, { error: 'Host ausente.' });
        return sendJson(response, 200, { server: `ws://${host}`, room: 'publica' });
    }

    let pathname;
    try {
        pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
        response.writeHead(400).end('Caminho inválido.');
        return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(distDirectory, relativePath);
    if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${path.sep}`)) {
        response.writeHead(403).end('Acesso negado.');
        return;
    }

    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) throw new Error('Não é um arquivo.');
        response.writeHead(200, {
            'Content-Type': MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404).end('Arquivo não encontrado.');
    }
}

function getLanAddresses() {
    const addresses = new Set();
    const virtualInterface = /^(br-|docker|lo$|vbox|veth|virbr|vmnet)/i;
    for (const [name, entries] of Object.entries(networkInterfaces())) {
        if (virtualInterface.test(name)) continue;
        for (const entry of entries ?? []) {
            if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal) {
                addresses.add(entry.address);
            }
        }
    }
    return [...addresses];
}

await buildGame();

const broker = new MessageBroker();
const httpServer = createServer((request, response) => {
    void serveFile(request, response);
});
const webSocketServer = new WebSocketServer({ server: httpServer });
const connectionAgent = new ConnectionAgent(broker, webSocketServer);
const lobbyAgent = new LobbyAgent(broker);
const matchAgent = new MatchAgent(broker, lobbyAgent);

lobbyAgent.start();
matchAgent.start();
connectionAgent.start();

broker.subscribe('client.message', ({ clientId, message }) => {
    if (message.type !== 'lobby.join') return;
    const room = lobbyAgent.getRoomForClient(clientId);
    console.log(`Sala ${room?.id ?? 'publica'}: ${room?.players.size ?? 0}/2 jogadores.`);
    if (room?.ready) console.log('Dupla encontrada. Partida iniciada!');
});

httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\nA porta ${port} já está ocupada. Feche os servidores antigos e tente novamente.`);
    } else {
        console.error(error);
    }
    process.exitCode = 1;
});

httpServer.listen(port, '0.0.0.0', () => {
    const addresses = getLanAddresses();
    console.log('\nJOGO PRONTO');
    if (addresses.length === 0) {
        console.log(`Abra nos dois computadores: http://IP-DESTE-COMPUTADOR:${port}`);
    } else {
        for (const address of addresses) console.log(`Abra nos dois computadores: http://${address}:${port}`);
    }
    console.log('\nOs dois devem clicar em JOGAR > MULTIPLAYER: um cria a sala e o outro entra pela lista.');
    console.log('Para encerrar, pressione Ctrl+C.\n');
});

function shutdown() {
    connectionAgent.stop();
    lobbyAgent.stop();
    matchAgent.stop();
    webSocketServer.close();
    httpServer.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
