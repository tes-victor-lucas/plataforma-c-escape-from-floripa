export type UpgradeId =
    | 'attack-range'
    | 'projectile-speed'
    | 'projectile-damage'
    | 'fire-rate'
    | 'double-shot'
    | 'piercing-shot'
    | 'companion-drone'
    | 'emergency-repair'
    | 'max-health';

export type UpgradeKind = 'stat' | 'ability';

export type StatName = 'attackRange' | 'projectileSpeed' | 'damage' | 'fireInterval';

export type UpgradeEffect =
    | {
        type: 'multiply-stat';
        stat: StatName;
        multiplier: number;
    }
    | {
        type: 'parallel-projectiles';
        projectileCount: number;
    }
    | {
        type: 'piercing';
        targetsPerLevel: number;
        maxTargets: number;
    }
    | {
        type: 'companion-drone';
        playerStatRatio: number;
        maxCompanions: number;
    }
    | {
        type: 'increase-max-health';
        amount: number;
        healAmount: number;
    }
    | {
        type: 'heal-on-room-complete';
        maxHealthRatio: number;
    };

/** Dados permanentes usados para montar uma carta e aplicar seu efeito futuramente. */
export type UpgradeCardDefinition = Readonly<{
    id: UpgradeId;
    kind: UpgradeKind;
    title: string;
    description: string;
    maxLevel: number | null;
    effect: UpgradeEffect;
}>;
