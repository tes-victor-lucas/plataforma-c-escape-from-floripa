import type { Health } from '../combat/Health';
import type { Player } from '../entities/Player';
import type { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeProgress } from '../upgrades/types';
import type { ItemId } from '../config/items';

/** Estado permanente transportado entre salas da mesma partida. */
export type PlayerProgress = Readonly<{
    currentHealth: number;
    maxHealth: number;
    movementSpeedMultiplier: number;
    upgrades: UpgradeProgress;
    /** Chimarrões pegos na partida; opcional porque checkpoints antigos não têm. */
    chimarraos?: number;
    /** Itens de equipar já pegos (chapéu de gaúcho...); opcional pelo mesmo motivo. */
    items?: readonly ItemId[];
}>;

export function capturePlayerProgress(
    player: Pick<Player, 'health' | 'getMovementSpeedMultiplier'>,
    upgrades: Pick<PlayerUpgradeState, 'exportProgress'>,
    chimarraos = 0,
    items: readonly ItemId[] = []
): PlayerProgress {
    return {
        currentHealth: player.health.current,
        maxHealth: player.health.max,
        movementSpeedMultiplier: player.getMovementSpeedMultiplier(),
        upgrades: upgrades.exportProgress(),
        chimarraos,
        items: [...items]
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
