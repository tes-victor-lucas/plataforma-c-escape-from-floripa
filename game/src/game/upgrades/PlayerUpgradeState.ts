import { COMBAT_CONFIG } from '../config/combat';
import type { Health } from '../combat/Health';
import { UPGRADE_CARDS } from './catalog';
import type { StatName, UpgradeCardDefinition, UpgradeId, UpgradeProgress } from './types';

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
    companionStatRatio = 0;
    companionDamageRatio = 0;
    emergencyRepairAmount = 0;
    pulseRadius = 0;
    pulseInterval = 0;
    blastRadius = 0;
    blastDamageRatio = 0;
    orbitCount = 0;
    orbitRadius = 0;
    orbitDamageRatio = 0;
    orbitHitInterval = 0;
    chainJumps = 0;
    chainInterval = 0;
    chainRange = 0;
    chainDamageRatio = 0;
    deathBlastRadius = 0;
    deathBlastDamageRatio = 0;
    pulseDamageRatio = 0;
    beamCount = 0;
    beamLength = 0;
    beamInterval = 0;
    beamDamageRatio = 0;
    spinRadius = 0;
    spinInterval = 0;
    spinDamageRatio = 0;
    bombardTargets = 0;
    bombardRadius = 0;
    bombardRange = 0;
    bombardInterval = 0;
    bombardDamageRatio = 0;
    burnRadius = 0;
    burnInterval = 0;
    burnDuration = 0;
    burnDamageRatio = 0;

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
        this.companionStatRatio = 0;
        this.companionDamageRatio = 0;
        this.emergencyRepairAmount = 0;
        this.pulseRadius = 0;
        this.pulseInterval = 0;
        this.blastRadius = 0;
        this.blastDamageRatio = 0;
        this.orbitCount = 0;
        this.orbitRadius = 0;
        this.orbitDamageRatio = 0;
        this.orbitHitInterval = 0;
        this.chainJumps = 0;
        this.chainInterval = 0;
        this.chainRange = 0;
        this.chainDamageRatio = 0;
        this.deathBlastRadius = 0;
        this.deathBlastDamageRatio = 0;
        this.pulseDamageRatio = 0;
        this.beamCount = 0;
        this.beamLength = 0;
        this.beamInterval = 0;
        this.beamDamageRatio = 0;
        this.spinRadius = 0;
        this.spinInterval = 0;
        this.spinDamageRatio = 0;
        this.bombardTargets = 0;
        this.bombardRadius = 0;
        this.bombardRange = 0;
        this.bombardInterval = 0;
        this.bombardDamageRatio = 0;
        this.burnRadius = 0;
        this.burnInterval = 0;
        this.burnDuration = 0;
        this.burnDamageRatio = 0;
    }

    exportProgress(): UpgradeProgress {
        return Array.from(this.levels.entries(), ([id, level]) => [id, level] as const);
    }

    importProgress(progress: UpgradeProgress) {
        this.reset();
        for (const [id, level] of progress) {
            const card = UPGRADE_CARDS.find((candidate) => candidate.id === id);
            if (!card) continue;
            for (let acquired = 0; acquired < level; acquired++) {
                if (!this.acquire(card)) break;
            }
        }
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
            case 'add-stat':
                this.damage += effect.amount;
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
                this.companionStatRatio = Math.max(
                    this.companionStatRatio,
                    effect.statRatio
                );
                this.companionDamageRatio = Math.max(
                    this.companionDamageRatio,
                    effect.damageRatio
                );
                break;
            case 'increase-max-health':
                this.maxHealth += effect.amount;
                break;
            case 'heal-on-room-complete':
                this.emergencyRepairAmount = Math.max(
                    this.emergencyRepairAmount,
                    effect.amount
                );
                break;
            case 'shock-pulse':
                this.pulseRadius = this.pulseRadius === 0
                    ? effect.radius
                    : Math.max(this.pulseRadius + effect.radiusPerLevel, effect.radius);
                // A Nova de choque e o Pulso dividem o efeito: o mais forte de cada valor prevalece.
                this.pulseInterval = this.pulseInterval ? Math.min(this.pulseInterval, effect.interval) : effect.interval;
                this.pulseDamageRatio = Math.max(this.pulseDamageRatio, effect.damageRatio);
                break;
            case 'blast-shot':
                this.blastRadius = this.blastRadius === 0 ? effect.radius : this.blastRadius + effect.radiusPerLevel;
                this.blastDamageRatio = effect.damageRatio;
                break;
            case 'spark-orbit':
                this.orbitCount = this.orbitCount === 0
                    ? effect.count
                    : Math.max(this.orbitCount + effect.countPerLevel, effect.count);
                // As Serras e as Faíscas dividem o efeito: o mais forte de cada valor prevalece.
                this.orbitRadius = Math.max(this.orbitRadius, effect.radius);
                this.orbitDamageRatio = Math.max(this.orbitDamageRatio, effect.damageRatio);
                this.orbitHitInterval = this.orbitHitInterval
                    ? Math.min(this.orbitHitInterval, effect.hitInterval)
                    : effect.hitInterval;
                break;
            case 'chain-lightning':
                this.chainJumps = this.chainJumps === 0
                    ? effect.jumps
                    : Math.max(this.chainJumps + effect.jumpsPerLevel, effect.jumps);
                // A Tempestade e o Raio dividem o efeito: o mais forte de cada valor prevalece.
                this.chainInterval = this.chainInterval ? Math.min(this.chainInterval, effect.interval) : effect.interval;
                this.chainRange = Math.max(this.chainRange, effect.jumpRange);
                this.chainDamageRatio = Math.max(this.chainDamageRatio, effect.damageRatio);
                break;
            case 'death-blast':
                this.deathBlastRadius = this.deathBlastRadius === 0
                    ? effect.radius
                    : this.deathBlastRadius + effect.radiusPerLevel;
                this.deathBlastDamageRatio = effect.damageRatio;
                break;
            case 'light-beams':
                this.beamCount = this.beamCount === 0 ? effect.beams : this.beamCount + effect.beamsPerLevel;
                this.beamLength = effect.length;
                this.beamInterval = effect.interval;
                this.beamDamageRatio = effect.damageRatio;
                break;
            case 'spin-slash':
                this.spinRadius = this.spinRadius === 0 ? effect.radius : this.spinRadius + effect.radiusPerLevel;
                this.spinInterval = effect.interval;
                this.spinDamageRatio = effect.damageRatio;
                break;
            case 'burn-pulse':
                this.burnRadius = this.burnRadius === 0 ? effect.radius : this.burnRadius + effect.radiusPerLevel;
                this.burnInterval = effect.interval;
                this.burnDuration = effect.duration;
                this.burnDamageRatio = effect.damageRatio;
                break;
            case 'bombard':
                this.bombardTargets = this.bombardTargets === 0
                    ? effect.targets
                    : this.bombardTargets + effect.targetsPerLevel;
                this.bombardRadius = effect.radius;
                this.bombardRange = effect.range;
                this.bombardInterval = effect.interval;
                this.bombardDamageRatio = effect.damageRatio;
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
        health.heal(this.emergencyRepairAmount);
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
