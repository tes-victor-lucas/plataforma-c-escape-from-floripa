import { join } from '../multiplayer.js';
import { audit, body, connectionId, context, ok } from './aws.js';

/** Rota `lobby.join`. */
export const handler = async (event) => {
    const { roomId } = body(event);
    audit('room_join_requested', { connectionId: connectionId(event), roomId });
    await join(context, connectionId(event), roomId);
    return ok;
};
