import type { Direction } from '../entities/Player';

export type MatchReadyMessage = {
    type: 'match.ready';
    roomId: string;
    players: string[];
};

export type RemotePlayerState = {
    type: 'player.state';
    playerId: string;
    sequence: number;
    x: number;
    y: number;
    facing: Direction;
};

export type ServerMessage =
    | { type: 'session.welcome'; playerId: string }
    | { type: 'lobby.joined'; roomId: string; playerId: string; players: string[] }
    | { type: 'lobby.players'; roomId: string; players: string[] }
    | { type: 'lobby.rejected'; code: string; roomId: string }
    | MatchReadyMessage
    | RemotePlayerState
    | { type: 'player.left'; roomId: string; playerId: string; players: string[] }
    | { type: 'error'; code: string };
