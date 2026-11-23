import { dispatch } from '../multiplayer.js';
import { connectionId, context, ok } from './aws.js';

/** $default: JSON inválido ou tipo sem rota recebe a mesma resposta do servidor local. */
export const handler = async (event) => {
    let message;
    try {
        message = JSON.parse(event.body);
    } catch {
        message = undefined;
    }
    await dispatch(context, connectionId(event), message);
    return ok;
};
