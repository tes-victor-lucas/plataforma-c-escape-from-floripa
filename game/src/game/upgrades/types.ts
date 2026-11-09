export type UpgradeId =
    | 'attack-range'
    | 'projectile-speed'
    | 'projectile-damage'
    | 'fire-rate'
    | 'double-shot'
    | 'piercing-shot'
    | 'companion-drone'
    | 'emergency-repair'
    | 'max-health'
    | 'shock-pulse'
    | 'blast-shot'
    | 'spark-orbit'
    | 'chain-lightning'
    | 'death-blast'
    | 'light-beams';

export type UpgradeKind = 'stat' | 'ability';

export type UpgradeProgress = ReadonlyArray<readonly [UpgradeId, number]>;

export type StatName = 'attackRange' | 'projectileSpeed' | 'damage' | 'fireInterval';

export type UpgradeEffect =
    | {
        type: 'multiply-stat';
        stat: StatName;
        multiplier: number;
    }
    | {
        type: 'add-stat';
        stat: 'damage';
        amount: number;
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
        statRatio: number;
        damageRatio: number;
        maxCompanions: number;
    }
    | {
        type: 'increase-max-health';
        amount: number;
        healAmount: number;
    }
    | {
        type: 'heal-on-room-complete';
        amount: number;
    }
    | {
        // Onda periódica em volta do jogador com o dano do tiro.
        type: 'shock-pulse';
        radius: number;
        radiusPerLevel: number;
        interval: number;
        damageRatio: number;
    }
    | {
        // O projétil explode no inimigo atingido e fere quem está ao redor.
        type: 'blast-shot';
        radius: number;
        radiusPerLevel: number;
        damageRatio: number;
    }
    | {
        // Faíscas girando em volta do jogador; cada inimigo leva no máximo um toque por intervalo.
        type: 'spark-orbit';
        count: number;
        countPerLevel: number;
        radius: number;
        damageRatio: number;
        hitInterval: number;
    }
    | {
        // Raio que nasce no inimigo mais perto e salta para os vizinhos.
        type: 'chain-lightning';
        interval: number;
        jumps: number;
        jumpsPerLevel: number;
        jumpRange: number;
        damageRatio: number;
    }
    | {
        // Inimigo abatido explode; uma explosão pode derrubar outro e seguir em cadeia.
        type: 'death-blast';
        radius: number;
        radiusPerLevel: number;
        damageRatio: number;
    }
    | {
        // Feixes que saem do jogador em leque, giram a cada disparo e ferem tudo na linha.
        type: 'light-beams';
        beams: number;
        beamsPerLevel: number;
        length: number;
        interval: number;
        damageRatio: number;
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
