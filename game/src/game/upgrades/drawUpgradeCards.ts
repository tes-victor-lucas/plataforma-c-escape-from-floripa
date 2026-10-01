import { UPGRADE_CARDS } from './catalog';
import type { UpgradeCardDefinition } from './types';

type RandomSource = () => number;

function takeRandom<T>(items: T[], random: RandomSource) {
    const normalized = Math.min(0.999999, Math.max(0, random()));
    const index = Math.floor(normalized * items.length);
    return items.splice(index, 1)[0];
}

/** Sorteia três cartas distintas e garante a presença de ao menos uma habilidade. */
export function drawUpgradeCards(
    random: RandomSource = Math.random,
    availableCards: readonly UpgradeCardDefinition[] = UPGRADE_CARDS
) {
    if (availableCards.length < 3) {
        throw new Error('São necessárias ao menos três cartas disponíveis.');
    }

    const pool = [...availableCards];
    const abilities = pool.filter((card) => card.kind === 'ability');
    if (abilities.length === 0) {
        throw new Error('É necessária ao menos uma habilidade disponível.');
    }

    const guaranteedAbility = takeRandom(abilities, random);
    const selected = [guaranteedAbility];
    const abilityIndex = pool.findIndex((card) => card.id === guaranteedAbility.id);
    pool.splice(abilityIndex, 1);

    while (selected.length < 3) selected.push(takeRandom(pool, random));

    for (let index = selected.length - 1; index > 0; index -= 1) {
        const normalized = Math.min(0.999999, Math.max(0, random()));
        const target = Math.floor(normalized * (index + 1));
        [selected[index], selected[target]] = [selected[target], selected[index]];
    }

    return selected;
}
