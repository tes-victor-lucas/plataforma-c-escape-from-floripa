import type { UpgradeCardDefinition, UpgradeId } from './types';

export const UPGRADE_CARDS = [
    {
        id: 'attack-range',
        kind: 'stat',
        title: 'Alcance ampliado',
        description: 'Aumenta o raio de ataque em 10%.',
        maxLevel: null,
        effect: { type: 'multiply-stat', stat: 'attackRange', multiplier: 1.1 }
    },
    {
        id: 'projectile-speed',
        kind: 'stat',
        title: 'Projétil acelerado',
        description: 'Aumenta a velocidade dos projéteis em 10%.',
        maxLevel: null,
        effect: { type: 'multiply-stat', stat: 'projectileSpeed', multiplier: 1.1 }
    },
    {
        id: 'projectile-damage',
        kind: 'stat',
        title: 'Impacto reforçado',
        description: 'Aumenta o dano atual em 20%.',
        maxLevel: null,
        effect: { type: 'multiply-stat', stat: 'damage', multiplier: 1.2 }
    },
    {
        id: 'fire-rate',
        kind: 'stat',
        title: 'Cadência aprimorada',
        description: 'Aumenta velocidade de tiro em 15%.',
        maxLevel: null,
        effect: { type: 'multiply-stat', stat: 'fireInterval', multiplier: 0.85 }
    },
    {
        id: 'double-shot',
        kind: 'ability',
        title: 'Tiro duplo',
        description: 'Dispara dois projéteis paralelos, lado a lado.',
        maxLevel: 1,
        effect: { type: 'parallel-projectiles', projectileCount: 2 }
    },
    {
        id: 'piercing-shot',
        kind: 'ability',
        title: 'Tiro perfurante',
        description: 'Atravessa um inimigo adicional por nível. Perfuração +1',
        maxLevel: 3,
        effect: { type: 'piercing', targetsPerLevel: 1, maxTargets: 3 }
    },
    {
        id: 'companion-drone',
        kind: 'ability',
        title: 'Drone companheiro',
        description: 'Invoca um pequeno drone com 40% dos atributos do jogador.',
        maxLevel: 1,
        effect: { type: 'companion-drone', playerStatRatio: 0.4, maxCompanions: 1 }
    },
    {
        id: 'max-health',
        kind: 'stat',
        title: 'Núcleo reforçado',
        description: 'Adiciona um coração máximo e recupera esse coração.',
        maxLevel: 3,
        effect: { type: 'increase-max-health', amount: 2, healAmount: 2 }
    },
    {
        id: 'emergency-repair',
        kind: 'ability',
        title: 'Reparo emergencial',
        description: 'Recupera 20% da vida máxima ao concluir a sala.',
        maxLevel: 1,
        effect: { type: 'heal-on-room-complete', maxHealthRatio: 0.2 }
    }
] as const satisfies readonly UpgradeCardDefinition[];

export function getUpgradeCard(id: UpgradeId): UpgradeCardDefinition {
    const card = UPGRADE_CARDS.find((candidate) => candidate.id === id);

    if (!card) {
        throw new Error(`Upgrade desconhecido: ${id}`);
    }

    return card;
}
