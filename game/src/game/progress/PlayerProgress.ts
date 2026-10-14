import type { Health } from '../combat/Health';
import type { Player } from '../entities/Player';
import type { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeProgress } from '../upgrades/types';

/** Estado permanente transportado entre salas da mesma partida. */
export type PlayerProgress = Readonly<{
    currentHealth: number;
    maxHealth: number;
    movementSpeedMultiplier: number;
    upgrades: UpgradeProgress;
}>;

export function capturePlayerProgress(
    player: Pick<Player, 'health' | 'getMovementSpeedMultiplier'>,
    upgrades: Pick<PlayerUpgradeState, 'exportProgress'>
): PlayerProgress {
    return {
        currentHealth: player.health.current,
        maxHealth: player.health.max,
        movementSpeedMultiplier: player.getMovementSpeedMultiplier(),
        upgrades: upgrades.exportProgress()
    };
}

export function restorePlayerProgress(
    progress: PlayerProgress,
    health: Health,
    setMovementSpeedMultiplier: (multiplier: number) => void,
    upgrades: Pick<PlayerUpgradeState, 'importProgress'>
) {
    upgrades.importProgress(progress.upgrades);
    health.restore(progress.currentHealth, progress.maxHealth);
    setMovementSpeedMultiplier(progress.movementSpeedMultiplier);
}
