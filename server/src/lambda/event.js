import { relayEvent } from '../multiplayer.js';
import { body, connectionId, context, ok } from './aws.js';

/** Rota `match.event`. */
export const handler = async (event) => {
    await relayEvent(context, connectionId(event), body(event).event);
    return ok;
};
