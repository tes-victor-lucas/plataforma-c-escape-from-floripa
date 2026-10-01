import { COMBAT_CONFIG } from '../config/combat';
import type { Health } from '../combat/Health';
import { UPGRADE_CARDS } from './catalog';
import type { StatName, UpgradeCardDefinition, UpgradeId } from './types';

export class PlayerUpgradeState {
    private readonly levels = new Map<UpgradeId, number>();

    range = COMBAT_CONFIG.player.range;
    projectileSpeed = COMBAT_CONFIG.player.projectileSpeed;
    damage = COMBAT_CONFIG.player.damage;
    maxHealth = COMBAT_CONFIG.player.maxHealth;
    fireInterval = COMBAT_CONFIG.player.fireInterval;
    projectileCount = 1;
    piercingTargets = 0;
    companionCount = 0;
    emergencyRepairRatio = 0;

    reset() {
        this.levels.clear();
        this.range = COMBAT_CONFIG.player.range;
        this.projectileSpeed = COMBAT_CONFIG.player.projectileSpeed;
        this.damage = COMBAT_CONFIG.player.damage;
        this.maxHealth = COMBAT_CONFIG.player.maxHealth;
        this.fireInterval = COMBAT_CONFIG.player.fireInterval;
        this.projectileCount = 1;
        this.piercingTargets = 0;
        this.companionCount = 0;
        this.emergencyRepairRatio = 0;
    }

    acquire(card: UpgradeCardDefinition) {
        const currentLevel = this.levels.get(card.id) ?? 0;
        if (card.maxLevel !== null && currentLevel >= card.maxLevel) return false;

        this.levels.set(card.id, currentLevel + 1);
        const effect = card.effect;
        switch (effect.type) {
            case 'multiply-stat':
                this.multiplyStat(effect.stat, effect.multiplier);
                break;
            case 'parallel-projectiles':
                this.projectileCount = Math.max(this.projectileCount, effect.projectileCount);
                break;
            case 'piercing':
                this.piercingTargets = Math.min(
                    effect.maxTargets,
                    this.piercingTargets + effect.targetsPerLevel
                );
                break;
            case 'companion-drone':
                this.companionCount = Math.min(
                    effect.maxCompanions,
                    this.companionCount + 1
                );
                break;
            case 'increase-max-health':
                this.maxHealth += effect.amount;
                break;
            case 'heal-on-room-complete':
                this.emergencyRepairRatio = Math.max(
                    this.emergencyRepairRatio,
                    effect.maxHealthRatio
                );
                break;
        }
        return true;
    }

    availableCards() {
        return UPGRADE_CARDS.filter((card) => {
            const level = this.levels.get(card.id) ?? 0;
            return card.maxLevel === null || level < card.maxLevel;
        });
    }

    repairAfterRoom(health: Health) {
        if (this.emergencyRepairRatio === 0) return;
        health.heal(Math.ceil(health.max * this.emergencyRepairRatio));
    }

    private multiplyStat(stat: StatName, multiplier: number) {
        switch (stat) {
            case 'attackRange':
                this.range *= multiplier;
                break;
            case 'projectileSpeed':
                this.projectileSpeed *= multiplier;
                break;
            case 'damage':
                this.damage *= multiplier;
                break;
            case 'fireInterval':
                this.fireInterval *= multiplier;
                break;
        }
    }
}
