import { relayState } from '../multiplayer.js';
import { body, connectionId, context, ok } from './aws.js';

/** Rota `player.state`, a mais frequente: 20 por segundo por jogador. */
export const handler = async (event) => {
    await relayState(context, connectionId(event), body(event));
    return ok;
};
