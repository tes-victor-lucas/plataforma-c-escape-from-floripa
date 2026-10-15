import { createMultiplayerServer } from './createMultiplayerServer.js';

const parsedPort = Number.parseInt(process.env.PORT ?? '8080', 10);
const port = Number.isSafeInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8080;

createMultiplayerServer({ port });
console.log(`Servidor multiplayer ouvindo em ws://localhost:${port}`);
