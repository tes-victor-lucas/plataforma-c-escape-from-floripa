import type { RoomKey } from './rooms';

export const DUNGEON_WAVE_ENEMY_COUNT = 10;

export type DungeonEnemyState = Readonly<{
    x: number;
    y: number;
    health: number;
    patrolLeft: number;
    patrolRight: number;
}>;

/** Combate interrompido ao sair de uma sala; é retomado na próxima visita. */
export type SavedRoomCombat = Readonly<{
    enemies: readonly DungeonEnemyState[];
    pendingWaves: readonly number[];
}>;

/** Estado carregado entre a dungeon e a fase 2 durante a mesma partida. */
export type DungeonSessionState = {
    seed: number;
    rewardClaimed: boolean;
    piranhasItemConsumed: boolean;
    savedCombat: Partial<Record<RoomKey, SavedRoomCombat>>;
};

export function createDungeonSessionState(
    seed = Math.floor(Math.random() * 0xffffffff)
): DungeonSessionState {
    return {
        seed: seed >>> 0,
        rewardClaimed: false,
        piranhasItemConsumed: false,
        savedCombat: {}
    };
}
