import type { Health } from '../combat/Health';
import type { EnemyKind } from '../config/combat';
import type { Player } from './Player';

export type EnemySpawn = Readonly<{
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
    health?: number;
}>;

/** Interface comum usada por ondas, projéteis e persistência de sala. */
export interface CombatEnemy {
    readonly id: string;
    readonly kind: EnemyKind;
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health: Health;

    update(player?: Player, delta?: number): void;
    takeDamage(amount: number, impactDirection?: Readonly<{ x: number; y: number }>): number;
    drawHealthBar(): void;
}
