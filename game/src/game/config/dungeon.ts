import type { RoomKey } from './rooms';
import type { EnemyKind } from './combat';

export const DUNGEON_WAVE_ENEMY_COUNT = 10;

export type DungeonEnemyState = Readonly<{
    kind: EnemyKind;
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
    /** Inimigos da horda em andamento que ainda não tinham nascido. */
    hordeRemaining?: number;
    /** A sala já foi vencida: reabre a saída sem repetir combate nem recompensa. */
    cleared: boolean;
}>;

/** Estado carregado entre a dungeon e a fase 2 durante a mesma partida. */
export type DungeonSessionState = {
    seed: number;
    rewardClaimed: boolean;
    swordCollected: boolean;
    piranhasItemConsumed: boolean;
    /** Partidas jogadas no fliperama do Mercado Público e se alguma foi vencida. */
    arcadeAttempts: number;
    arcadeWon: boolean;
    savedCombat: Partial<Record<RoomKey, SavedRoomCombat>>;
};

export function createDungeonSessionState(
    seed = Math.floor(Math.random() * 0xffffffff)
): DungeonSessionState {
    return {
        seed: seed >>> 0,
        rewardClaimed: false,
        swordCollected: false,
        piranhasItemConsumed: false,
        arcadeAttempts: 0,
        arcadeWon: false,
        savedCombat: {}
    };
}
