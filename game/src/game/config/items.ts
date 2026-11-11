/** Itens de equipar guardados no inventário; cada um entra aqui quando for implementado. */
export type ItemId = 'gaucho-hat';
export type EquipmentSlot = 'CABEÇA' | 'CORPO' | 'MÃOS' | 'PÉS';

export const ITEM_IDS: readonly ItemId[] = ['gaucho-hat'];

/** Chapéu campeiro: cai quando todos os gaúchos do esconderijo morrem e bloqueia parte dos golpes. */
export const GAUCHO_HAT = {
    id: 'gaucho-hat',
    name: 'CHAPÉU DE GAÚCHO',
    texture: 'gaucho-hat',
    slot: 'CABEÇA',
    blockChance: 0.2,
    description: 'CAIU DOS GAÚCHOS DO ESCONDERIJO.\nBLOQUEIA 1 EM CADA 5 GOLPES, EM MÉDIA.'
} as const;

export const ITEMS: Readonly<Record<ItemId, typeof GAUCHO_HAT>> = { 'gaucho-hat': GAUCHO_HAT };

export function isItemId(value: unknown): value is ItemId {
    return ITEM_IDS.includes(value as ItemId);
}
