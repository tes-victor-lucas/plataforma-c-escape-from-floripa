import { listRooms } from '../multiplayer.js';
import { connectionId, context, ok } from './aws.js';

/** Rota `lobby.list`. */
export const handler = async (event) => {
    await listRooms(context, connectionId(event));
    return ok;
};
