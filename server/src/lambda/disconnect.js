import { leave } from '../multiplayer.js';
import { audit, connectionId, context, ok } from './aws.js';

export const handler = async (event) => {
    await leave(context, connectionId(event));
    audit('player_disconnected', { connectionId: connectionId(event) });
    return ok;
};
