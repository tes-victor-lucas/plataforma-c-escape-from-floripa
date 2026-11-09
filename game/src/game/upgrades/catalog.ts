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
        description: 'A cada 0,8 s, uma onda atinge todos à sua volta. +25 px de raio por nível.',
        maxLevel: 3,
        effect: { type: 'shock-pulse', radius: 100, radiusPerLevel: 25, interval: 800, damageRatio: 1.5 }
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
        effect: { type: 'spark-orbit', count: 4, countPerLevel: 2, radius: 52, damageRatio: 1.5, hitInterval: 300 }
    },
    {
        id: 'chain-lightning',
        kind: 'ability',
        title: 'Raio em cadeia',
        description: 'A cada 0,8 s, um raio salta entre até 8 inimigos. +4 saltos por nível.',
        maxLevel: 3,
        effect: { type: 'chain-lightning', interval: 800, jumps: 8, jumpsPerLevel: 4, jumpRange: 90, damageRatio: 2 }
    },
    {
        id: 'death-blast',
        kind: 'ability',
        title: 'Detonação',
        description: 'Inimigos abatidos explodem com 150% do dano em volta. +15 px por nível.',
        maxLevel: 2,
        effect: { type: 'death-blast', radius: 55, radiusPerLevel: 15, damageRatio: 1.5 }
    },
    {
        id: 'light-beams',
        kind: 'ability',
        title: 'Feixes de luz',
        description: 'A cada 1 s, 6 feixes cruzam a tela e ferem tudo na linha. +2 por nível.',
        maxLevel: 3,
        effect: { type: 'light-beams', beams: 6, beamsPerLevel: 2, length: 300, interval: 1_000, damageRatio: 2 }
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

export function getUpgradeCard(id: UpgradeId): UpgradeCardDefinition {
    const card = UPGRADE_CARDS.find((candidate) => candidate.id === id);

    if (!card) {
        throw new Error(`Upgrade desconhecido: ${id}`);
    }

    return card;
}
