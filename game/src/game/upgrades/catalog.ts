import type { UpgradeCardDefinition, UpgradeId } from './types';

export const UPGRADE_CARDS = [
    {
        id: 'attack-range',
        kind: 'stat',
        title: 'Alcance ampliado',
        description: 'Aumenta o raio de ataque atual em 20% por nível.',
        maxLevel: 3,
        effect: { type: 'multiply-stat', stat: 'attackRange', multiplier: 1.2 }
    },
    {
        id: 'projectile-speed',
        kind: 'stat',
        title: 'Projétil acelerado',
        description: 'Aumenta a velocidade atual dos projéteis em 25% por nível.',
        maxLevel: 3,
        effect: { type: 'multiply-stat', stat: 'projectileSpeed', multiplier: 1.25 }
    },
    {
        id: 'projectile-damage',
        kind: 'stat',
        title: 'Impacto reforçado',
        description: 'Aumenta o dano dos projéteis em 1 por nível.',
        maxLevel: 3,
        effect: { type: 'add-stat', stat: 'damage', amount: 1 }
    },
    {
        id: 'fire-rate',
        kind: 'stat',
        title: 'Cadência aprimorada',
        description: 'Reduz o intervalo atual entre disparos em 20% por nível.',
        maxLevel: 3,
        effect: { type: 'multiply-stat', stat: 'fireInterval', multiplier: 0.8 }
    },
    {
        id: 'double-shot',
        kind: 'ability',
        title: 'Tiro duplo',
        description: 'Dispara dois projéteis paralelos, cada um com dano integral.',
        maxLevel: 1,
        effect: { type: 'parallel-projectiles', projectileCount: 2 }
    },
    {
        id: 'piercing-shot',
        kind: 'ability',
        title: 'Tiro perfurante',
        description: 'Atravessa +1 inimigo por nível, até o máximo de +3.',
        maxLevel: 3,
        effect: { type: 'piercing', targetsPerLevel: 1, maxTargets: 3 }
    },
    {
        id: 'companion-drone',
        kind: 'ability',
        title: 'Drone companheiro',
        description: 'Drone: 75% de alcance, velocidade e cadência; 50% de dano arredondado (mín. 1).',
        maxLevel: 1,
        effect: {
            type: 'companion-drone',
            statRatio: 0.75,
            damageRatio: 0.5,
            maxCompanions: 1
        }
    },
    {
        id: 'max-health',
        kind: 'stat',
        title: 'Núcleo reforçado',
        description: 'Adiciona 1 coração máximo por nível e recupera esse coração.',
        maxLevel: 3,
        effect: { type: 'increase-max-health', amount: 2, healAmount: 2 }
    },
    {
        id: 'emergency-repair',
        kind: 'ability',
        title: 'Reparo emergencial',
        description: 'Ao concluir cada sala, recupera 2 pontos de vida (1 coração).',
        maxLevel: 1,
        effect: { type: 'heal-on-room-complete', amount: 2 }
    },
    {
        id: 'shock-pulse',
        kind: 'ability',
        title: 'Pulso de choque',
        description: 'A cada 1,1 s, uma onda atinge todos à sua volta. +25 px de raio por nível.',
        maxLevel: 3,
        effect: { type: 'shock-pulse', radius: 100, radiusPerLevel: 25, interval: 1_100, damageRatio: 1.25 }
    },
    {
        id: 'blast-shot',
        kind: 'ability',
        title: 'Tiro explosivo',
        description: 'O tiro explode ao acertar e causa 150% do dano ao redor. +15 px por nível.',
        maxLevel: 2,
        effect: { type: 'blast-shot', radius: 50, radiusPerLevel: 15, damageRatio: 1.5 }
    },
    {
        id: 'spark-orbit',
        kind: 'ability',
        title: 'Faíscas orbitais',
        description: '4 faíscas giram em volta de você e ferem quem encostar. +2 por nível.',
        maxLevel: 3,
        effect: { type: 'spark-orbit', count: 4, countPerLevel: 2, radius: 52, damageRatio: 1.25, hitInterval: 420 }
    },
    {
        id: 'chain-lightning',
        kind: 'ability',
        title: 'Raio em cadeia',
        description: 'A cada 1,1 s, um raio salta entre até 8 inimigos. +4 saltos por nível.',
        maxLevel: 3,
        effect: { type: 'chain-lightning', interval: 1_100, jumps: 8, jumpsPerLevel: 4, jumpRange: 90, damageRatio: 0.85 }
    },
    {
        id: 'death-blast',
        kind: 'ability',
        title: 'Detonação',
        description: 'Inimigos abatidos explodem com 75% do dano em volta, sem reação em cadeia. +15 px por nível.',
        maxLevel: 2,
        effect: { type: 'death-blast', radius: 55, radiusPerLevel: 15, damageRatio: 0.75 }
    },
    {
        id: 'light-beams',
        kind: 'ability',
        title: 'Feixes de luz',
        description: 'A cada 1,3 s, 6 feixes cruzam a tela e ferem tudo na linha. +2 por nível.',
        maxLevel: 3,
        effect: { type: 'light-beams', beams: 6, beamsPerLevel: 2, length: 300, interval: 1_300, damageRatio: 1.7 }
    },
    {
        id: 'heavy-rounds',
        kind: 'stat',
        title: 'Munição pesada',
        description: 'Aumenta o dano dos projéteis em 3 por nível.',
        maxLevel: 2,
        effect: { type: 'add-stat', stat: 'damage', amount: 3 }
    },
    {
        id: 'overclock',
        kind: 'stat',
        title: 'Overclock',
        description: 'Reduz o intervalo atual entre disparos em 40% por nível.',
        maxLevel: 2,
        effect: { type: 'multiply-stat', stat: 'fireInterval', multiplier: 0.6 }
    },
    {
        id: 'thunder-storm',
        kind: 'ability',
        title: 'Tempestade elétrica',
        description: 'A cada 0,75 s, um raio de 125% salta entre 12 inimigos. +6 por nível.',
        maxLevel: 2,
        effect: { type: 'chain-lightning', interval: 750, jumps: 12, jumpsPerLevel: 6, jumpRange: 130, damageRatio: 1.25 }
    },
    {
        id: 'nova-pulse',
        kind: 'ability',
        title: 'Nova de choque',
        description: 'A cada 0,85 s, uma onda de 250% atinge 150 px em volta. +40 px por nível.',
        maxLevel: 2,
        effect: { type: 'shock-pulse', radius: 150, radiusPerLevel: 40, interval: 850, damageRatio: 2.5 }
    },
    {
        id: 'spin-slash',
        kind: 'ability',
        title: 'Golpe giratório',
        description: 'A cada 7 s, um corte gira à sua volta e causa 900% em 170 px. +35 px por nível.',
        maxLevel: 2,
        effect: { type: 'spin-slash', radius: 170, radiusPerLevel: 35, interval: 7_000, damageRatio: 9 }
    },
    {
        id: 'saw-orbit',
        kind: 'ability',
        title: 'Serras orbitais',
        description: '3 serras de 250% giram mais longe à sua volta. +1 serra por nível.',
        maxLevel: 3,
        effect: { type: 'spark-orbit', count: 3, countPerLevel: 1, radius: 72, damageRatio: 2.5, hitInterval: 350 }
    },
    {
        id: 'bombard',
        kind: 'ability',
        title: 'Bombardeio',
        description: 'A cada 1,6 s, bombas de 300% caem em 4 inimigos. +2 alvos por nível.',
        maxLevel: 2,
        effect: { type: 'bombard', targets: 4, targetsPerLevel: 2, radius: 55, range: 220, interval: 1_600, damageRatio: 3 }
    }
] as const satisfies readonly UpgradeCardDefinition[];

/** Cartas de dano em área, oferecidas antes da horda maior da Sala II. */
export const AREA_UPGRADE_IDS: readonly UpgradeId[] = [
    'shock-pulse',
    'blast-shot',
    'spark-orbit',
    'chain-lightning',
    'death-blast',
    'light-beams'
];

/** Cartas fortes que só aparecem na Sala III. */
export const ROOM3_EXCLUSIVE_UPGRADE_IDS: readonly UpgradeId[] = [
    'heavy-rounds',
    'overclock',
    'thunder-storm',
    'nova-pulse'
];

/** Cartas de área ainda mais fortes, oferecidas só ao vencer a horda 2 da Sala III. */
export const ROOM3_FINAL_UPGRADE_IDS: readonly UpgradeId[] = [
    'spin-slash',
    'saw-orbit',
    'bombard'
];

/** Mesa da Sala III: as exclusivas embaralhadas com as cartas de área mais fortes da Sala II. */
export const ROOM3_UPGRADE_IDS: readonly UpgradeId[] = [
    ...ROOM3_EXCLUSIVE_UPGRADE_IDS,
    'chain-lightning',
    'light-beams',
    'death-blast'
];

export function getUpgradeCard(id: UpgradeId): UpgradeCardDefinition {
    const card = UPGRADE_CARDS.find((candidate) => candidate.id === id);

    if (!card) {
        throw new Error(`Upgrade desconhecido: ${id}`);
    }

    return card;
}
