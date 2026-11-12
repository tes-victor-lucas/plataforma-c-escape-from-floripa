import {
    AREA_UPGRADE_IDS,
    BASIC_UPGRADE_IDS,
    EVERY_ROOM_UPGRADE_IDS,
    RETIRED_UPGRADE_IDS,
    ROOM3_FINAL_UPGRADE_IDS,
    ROOM3_UPGRADE_IDS,
    UPGRADE_CARDS
} from './catalog';
import type { UpgradeCardDefinition, UpgradeId } from './types';

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

/**
 * Garante até duas cartas em destaque que ainda podem ser escolhidas e completa com o sorteio normal.
 * A terceira vaga é um curinga das outras cartas: com o destaque ocupando as três, a mesa era sempre parecida
 * (no fim da Sala III, que tem só três cartas finais, saíam sempre as mesmas).
 */
export function drawUpgradeCardsFeaturing(
    featured: readonly UpgradeId[],
    random: RandomSource = Math.random,
    availableCards: readonly UpgradeCardDefinition[] = UPGRADE_CARDS,
    featuredSlots = 2
) {
    const highlighted: UpgradeCardDefinition[] = [];
    const featuredPool = availableCards.filter((card) => featured.includes(card.id));
    while (highlighted.length < featuredSlots && featuredPool.length > 0) highlighted.push(takeRandom(featuredPool, random));
    const others = availableCards.filter((card) => !featured.includes(card.id));
    if (highlighted.length === 0 || others.length < 3 || !others.some((card) => card.kind === 'ability')) {
        return drawUpgradeCards(random, availableCards);
    }
    return [...highlighted, ...drawUpgradeCards(random, others).slice(0, 3 - highlighted.length)];
}

/** Mesas de cartas: cada sala oferece as suas; o fim da Sala III destaca as cartas finais. */
export type CardTable = 'room1' | 'room2' | 'room3' | 'room3-final';

const TABLE_IDS: Record<Exclude<CardTable, 'room3-final'>, readonly UpgradeId[]> = {
    room1: BASIC_UPGRADE_IDS,
    room2: AREA_UPGRADE_IDS,
    room3: ROOM3_UPGRADE_IDS
};

/**
 * Cartas da mesa ainda disponíveis, junto com as que valem em todas as salas. Se a mesa já não tem três
 * cartas com uma habilidade (tudo no nível máximo), completa com qualquer carta ainda disponível, menos as aposentadas.
 */
export function getTableCards(table: Exclude<CardTable, 'room3-final'>, availableCards: readonly UpgradeCardDefinition[]) {
    const ids = [...TABLE_IDS[table], ...EVERY_ROOM_UPGRADE_IDS];
    const cards = availableCards.filter((card) => ids.includes(card.id));
    if (cards.length >= 3 && cards.some((card) => card.kind === 'ability')) return cards;
    return availableCards.filter((card) => !RETIRED_UPGRADE_IDS.includes(card.id));
}

/**
 * Rodada do golem na Sala V: até cinco cartas das mesas das Salas II e III (com as finais e as de todas as salas),
 * só entre as que o jogador ainda não pegou nenhuma vez.
 */
export function drawGolemCards(
    acquired: readonly UpgradeId[],
    random: RandomSource = Math.random,
    availableCards: readonly UpgradeCardDefinition[] = UPGRADE_CARDS
) {
    const ids = [...AREA_UPGRADE_IDS, ...ROOM3_UPGRADE_IDS, ...ROOM3_FINAL_UPGRADE_IDS, ...EVERY_ROOM_UPGRADE_IDS];
    const pool = availableCards.filter((card) => ids.includes(card.id) && !acquired.includes(card.id));
    const drawn: UpgradeCardDefinition[] = [];
    while (drawn.length < 5 && pool.length > 0) drawn.push(takeRandom(pool, random));
    return drawn;
}

/** Sorteia a mesa: três cartas da sala; no fim da Sala III, duas finais garantidas e um curinga da mesa da sala. */
export function drawTableCards(
    table: CardTable,
    random: RandomSource = Math.random,
    availableCards: readonly UpgradeCardDefinition[] = UPGRADE_CARDS
) {
    if (table !== 'room3-final') return drawUpgradeCards(random, getTableCards(table, availableCards));
    const finals = availableCards.filter((card) => ROOM3_FINAL_UPGRADE_IDS.includes(card.id));
    return drawUpgradeCardsFeaturing(ROOM3_FINAL_UPGRADE_IDS, random, [...finals, ...getTableCards('room3', availableCards)]);
}
