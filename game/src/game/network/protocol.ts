import type { EnemyKind } from '../config/combat';
import type { RoomKey } from '../config/rooms';
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
    health: number;
    maxHealth: number;
    /** Entre 0 e 1 enquanto o jogador caído recebe ajuda. */
    reviveProgress: number;
    revivesLeft: number;
};

export type EnemySpawnRow = Readonly<{
    kind: EnemyKind;
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
    health: number;
    maxHealth: number;
}>;

/** Estado visual de um inimigo; `null` quando ele já morreu no cliente anfitrião. */
export type EnemySnapshotRow = readonly [x: number, y: number, health: number, frame: string | number, flipX: 0 | 1] | null;

export type CoopEvent =
    | { kind: 'enemy.spawn'; enemies: readonly EnemySpawnRow[] }
    | { kind: 'enemy.snapshot'; rows: readonly EnemySnapshotRow[] }
    | { kind: 'enemy.shot'; x: number; y: number; angle: number }
    | { kind: 'enemy.hit'; index: number; damage: number; dx: number; dy: number }
    | { kind: 'enemy.killed'; index: number }
    | { kind: 'player.shot'; x: number; y: number; angle: number; speed: number; color: number }
    | { kind: 'player.damage'; amount: number }
    /** `hitPeer` diz se o golpe do gaúcho acertou quem recebe o evento. */
    | { kind: 'enemy.strike'; x: number; y: number; hitPeer: boolean }
    | { kind: 'world.ready'; epoch: number }
    | { kind: 'wave.intermission' }
    | { kind: 'combat.complete'; rewardClaimed: boolean }
    | { kind: 'cards.chosen' }
    | { kind: 'cards.released' }
    | { kind: 'room.request'; roomKey: RoomKey; spawn?: Readonly<{ x: number; y: number }> }
    | { kind: 'room.transition'; roomKey: RoomKey; spawn?: Readonly<{ x: number; y: number }>; seed?: number };

export type ServerMessage =
    | { type: 'session.welcome'; playerId: string }
    | { type: 'lobby.joined'; roomId: string; playerId: string; players: string[] }
    | { type: 'lobby.players'; roomId: string; players: string[] }
    | { type: 'lobby.rejected'; code: string; roomId: string }
    | MatchReadyMessage
    | RemotePlayerState
    | { type: 'match.event'; playerId: string; event: CoopEvent }
    | { type: 'player.left'; roomId: string; playerId: string; players: string[] }
    | { type: 'error'; code: string };
