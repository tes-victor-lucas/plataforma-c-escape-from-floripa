import { isOriginAllowed } from '../multiplayer.js';

/** $connect: só o site oficial (e a Feira de Jogos) abre conexão. */
export const handler = async (event) => {
    const origin = event.headers?.Origin ?? event.headers?.origin;
    return { statusCode: isOriginAllowed(origin, process.env.ALLOWED_ORIGIN) ? 200 : 403 };
};
