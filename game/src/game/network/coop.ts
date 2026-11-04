import { COMBAT_CONFIG } from '../config/combat';
import type { CombatEnemy } from '../entities/CombatEnemy';
import type { EnemySnapshotRow } from './protocol';

type Point = Readonly<{ x: number; y: number }>;

/** O que um inimigo precisa saber de um jogador, seja ele local ou do parceiro. */
export type CoopTarget = {
    health: { isAlive: boolean };
    sprite: { body: { center: Point } | null };
    takeDamage(amount: number): void;
};

/** Inimigos perseguem quem está mais perto, ignorando jogadores caídos. */
export function nearestLivingTarget<Target extends CoopTarget>(origin: Point, targets: readonly Target[]) {
    let nearest: Target | undefined;
    let nearestDistance = Infinity;
    for (const target of targets) {
        const center = target.sprite.body?.center;
        if (!target.health.isAlive || !center) continue;
        const distance = Math.hypot(center.x - origin.x, center.y - origin.y);
        if (distance < nearestDistance) {
            nearest = target;
            nearestDistance = distance;
        }
    }
    return nearest;
}

/** Avança a ajuda ao caído; sair de perto recomeça a contagem. */
export function advanceRevive(elapsed: number, delta: number, isPartnerClose: boolean) {
    return isPartnerClose ? elapsed + delta : 0;
}

export function isWithinReviveRadius(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y) <= COMBAT_CONFIG.multiplayer.reviveRadius;
}

/** O anfitrião só libera o jogo depois das duas escolhas, em qualquer ordem. */
export class CardBarrier {
    private localChosen = false;
    private peerChosen = false;
    private release?: () => void;

    open() {
        this.localChosen = false;
        this.peerChosen = false;
        this.release = undefined;
    }

    chooseLocal(release: () => void) {
        this.localChosen = true;
        this.release = release;
        this.settle();
    }

    choosePeer() {
        this.peerChosen = true;
        this.settle();
    }

    get isWaitingForPeer() {
        return this.localChosen && !this.peerChosen && this.release !== undefined;
    }

    private settle() {
        if (!this.localChosen || !this.peerChosen || !this.release) return;
        const release = this.release;
        this.release = undefined;
        release();
    }
}

export function createEnemySnapshotRow(enemy: CombatEnemy): EnemySnapshotRow {
    if (!enemy.health.isAlive) return null;
    return [
        Math.round(enemy.sprite.x * 10) / 10,
        Math.round(enemy.sprite.y * 10) / 10,
        enemy.health.current,
        enemy.sprite.frame.name,
        enemy.sprite.flipX ? 1 : 0
    ];
}

/**
 * Aplica a vida decidida pelo anfitrião. Retorna o dano novo para exibir o número.
 * A vida só desce: um pacote atrasado nunca ressuscita o inimigo.
 */
export function applyEnemySnapshotHealth(enemy: CombatEnemy, row: EnemySnapshotRow) {
    if (!enemy.health.isAlive) return 0;
    const health = row ? row[2] : 0;
    const damage = enemy.health.current - health;
    if (damage <= 0) return 0;
    return enemy.takeDamage(damage);
}
