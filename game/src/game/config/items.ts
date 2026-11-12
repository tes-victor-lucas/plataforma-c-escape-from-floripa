/** Itens de equipar guardados no inventário; cada um entra aqui quando for implementado. */
export type ItemId = 'gaucho-hat' | 'helmet' | 'rubber-boots';
export type EquipmentSlot = 'CABEÇA' | 'CORPO' | 'MÃOS' | 'PÉS';

export const ITEM_IDS: readonly ItemId[] = ['gaucho-hat', 'helmet', 'rubber-boots'];

/** Pixel art do item: retângulos [x, y, largura, altura, cor] desenhados uma vez numa textura. */
type ItemPixels = readonly (readonly [number, number, number, number, number])[];

export type ItemDefinition = Readonly<{
    id: ItemId;
    name: string;
    texture: string;
    slot: EquipmentSlot;
    description: string;
    /** Chance de um golpe não pegar, entre 0 e 1. */
    blockChance: number;
    /** Multiplica a velocidade de andar enquanto equipado. */
    speedMultiplier: number;
    /** Onde o item aparece no personagem pelo mapa. */
    anchor: 'head' | 'feet';
    width: number;
    height: number;
    pixels: ItemPixels;
}>;

/** Chapéu campeiro: cai quando todos os gaúchos do esconderijo morrem e bloqueia parte dos golpes. */
export const GAUCHO_HAT: ItemDefinition = {
    id: 'gaucho-hat',
    name: 'CHAPÉU DE GAÚCHO',
    texture: 'gaucho-hat',
    slot: 'CABEÇA',
    blockChance: 0.2,
    speedMultiplier: 1,
    anchor: 'head',
    description: 'CAIU DOS GAÚCHOS DO ESCONDERIJO.\nBLOQUEIA 1 EM CADA 5 GOLPES, EM MÉDIA.',
    // 16x8: aba larga, copa escura e a faixa vermelha do chapéu campeiro.
    width: 16,
    height: 8,
    pixels: [
        [5, 0, 6, 1, 0x3a2a1e],
        [4, 1, 8, 3, 0x3a2a1e],
        [5, 1, 3, 1, 0x56402e],
        [4, 4, 8, 1, 0xa3212b],
        [0, 5, 16, 2, 0x24180f],
        [1, 5, 14, 1, 0x4a3524],
        [3, 7, 10, 1, 0x120c08]
    ]
};

/** Capacete de ciclista dos baús da disputa no TICEN: bloqueia mais golpes que o chapéu. */
export const HELMET: ItemDefinition = {
    id: 'helmet',
    name: 'CAPACETE',
    texture: 'item-capacete',
    slot: 'CABEÇA',
    blockChance: 1 / 3,
    speedMultiplier: 1,
    anchor: 'head',
    description: 'CAPACETE DE CICLISTA, ACHADO NUM BAÚ DO TICEN.\nBLOQUEIA 1 EM CADA 3 GOLPES, EM MÉDIA.',
    // 14x7: casco verde-água com as entradas de ar e a viseira escura.
    width: 14,
    height: 7,
    pixels: [
        [3, 0, 8, 1, 0x0c4a46],
        [1, 1, 12, 3, 0x28a094],
        [2, 1, 4, 1, 0x7fe0d4],
        [4, 2, 1, 2, 0x0c4a46],
        [7, 2, 1, 2, 0x0c4a46],
        [10, 2, 1, 2, 0x0c4a46],
        [0, 4, 14, 2, 0x166e66],
        [9, 5, 5, 1, 0x101018],
        [1, 6, 2, 1, 0x101018]
    ]
};

/** Galochas de pescador dos baús da disputa no TICEN: andar fica mais rápido. */
export const RUBBER_BOOTS: ItemDefinition = {
    id: 'rubber-boots',
    name: 'GALOCHAS',
    texture: 'item-galochas',
    slot: 'PÉS',
    blockChance: 0,
    speedMultiplier: 1.2,
    anchor: 'feet',
    description: 'GALOCHAS DE PESCADOR, ACHADAS NUM BAÚ DO TICEN.\nANDA 20% MAIS RÁPIDO.',
    // 14x5: duas botas verdes de borracha com a sola escura.
    width: 14,
    height: 5,
    pixels: [
        [1, 0, 4, 3, 0x2e7d4a],
        [9, 0, 4, 3, 0x2e7d4a],
        [1, 0, 1, 3, 0x56b070],
        [9, 0, 1, 3, 0x56b070],
        [0, 3, 6, 1, 0x2e7d4a],
        [8, 3, 6, 1, 0x2e7d4a],
        [0, 4, 6, 1, 0x101018],
        [8, 4, 6, 1, 0x101018]
    ]
};

export const ITEMS: Readonly<Record<ItemId, ItemDefinition>> = {
    'gaucho-hat': GAUCHO_HAT,
    helmet: HELMET,
    'rubber-boots': RUBBER_BOOTS
};

export function isItemId(value: unknown): value is ItemId {
    return ITEM_IDS.includes(value as ItemId);
}
