export const DUNGEON_WAVE_ENEMY_COUNT = 10;

export type DungeonEnemyState = Readonly<{
    x: number;
    y: number;
    health: number;
    patrolLeft: number;
    patrolRight: number;
}>;

/** Estado carregado entre a dungeon e a fase 2 durante a mesma partida. */
export type DungeonSessionState = {
    seed: number;
    remainingEnemies: number;
    rewardClaimed: boolean;
    enemies?: DungeonEnemyState[];
};

export function createDungeonSessionState(
    seed = Math.floor(Math.random() * 0xffffffff)
): DungeonSessionState {
    return {
        seed: seed >>> 0,
        remainingEnemies: DUNGEON_WAVE_ENEMY_COUNT,
        rewardClaimed: false
    };
}
