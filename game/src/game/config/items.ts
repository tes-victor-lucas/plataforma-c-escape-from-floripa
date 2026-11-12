import type { FeetFit } from './characters';
import type { RoomKey } from './rooms';

/** Itens de equipar guardados no inventário; cada um entra aqui quando for implementado. */
export type ItemId = 'gaucho-hat' | 'helmet' | 'rubber-boots' | 'silver-boots' | 'diamond-boots' | 'flame-sword' | 'ice-staff';
export type EquipmentSlot = 'CABEÇA' | 'CORPO' | 'MÃOS' | 'PÉS';

// Itens novos entram sempre no fim: a posição é o bit enviado ao parceiro.
export const ITEM_IDS: readonly ItemId[] = ['gaucho-hat', 'helmet', 'rubber-boots', 'silver-boots', 'diamond-boots', 'flame-sword', 'ice-staff'];

/** Pixel art do item: retângulos [x, y, largura, altura, cor] desenhados uma vez numa textura. */
export type ItemPixels = readonly (readonly [number, number, number, number, number])[];

// Medida das pernas do personagem padrão: o ícone do inventário usa essa.
const DEFAULT_FEET = { legWidth: 6, gap: 2 };

/**
 * Par de botas de 5 px de altura, uma por perna: cano um pixel mais estreito por dentro, pé e sola na largura toda.
 * Largura total = duas pernas mais o vão.
 */
export function bootPixels(color: number, shine: number, { legWidth, gap }: Pick<FeetFit, 'legWidth' | 'gap'> = DEFAULT_FEET): ItemPixels {
    const right = legWidth + gap;
    return [
        [1, 0, legWidth - 1, 3, color],
        [right, 0, legWidth - 1, 3, color],
        [1, 0, 1, 3, shine],
        [right, 0, 1, 3, shine],
        [0, 3, legWidth, 1, color],
        [right, 3, legWidth, 1, color],
        [0, 4, legWidth, 1, 0x101018],
        [right, 4, legWidth, 1, 0x101018]
    ];
}

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
    /** Multiplica a recarga do dash enquanto equipado: menor que 1 recarrega mais rápido. */
    dashCooldownMultiplier: number;
    /** Onde o item aparece no personagem pelo mapa. */
    anchor: 'head' | 'feet' | 'hand';
    /** A espada flamejante é desenhada pelo combate, que a gira no golpe; o resto segue o personagem. */
    heldByCombat?: boolean;
    width: number;
    height: number;
    pixels: ItemPixels;
    /** Só as botas: desenho refeito na medida das pernas de cada personagem. */
    fitFeet?: (feet: FeetFit) => ItemPixels;
}>;

/** Chapéu campeiro: cai quando todos os gaúchos do esconderijo morrem e bloqueia parte dos golpes. */
export const GAUCHO_HAT: ItemDefinition = {
    id: 'gaucho-hat',
    name: 'CHAPÉU DE GAÚCHO',
    texture: 'gaucho-hat',
    slot: 'CABEÇA',
    blockChance: 0.2,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
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
    dashCooldownMultiplier: 1,
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
    dashCooldownMultiplier: 1,
    anchor: 'feet',
    description: 'GALOCHAS DE PESCADOR, ACHADAS NUM BAÚ DO TICEN.\nANDA 20% MAIS RÁPIDO.',
    // 14x5: duas botas verdes de borracha com a sola escura.
    width: 14,
    height: 5,
    pixels: bootPixels(0x2e7d4a, 0x56b070),
    fitFeet: (feet) => bootPixels(0x2e7d4a, 0x56b070, feet)
};

/** Botas de prata do baú da Sala I: um pouco mais de velocidade. */
export const SILVER_BOOTS: ItemDefinition = {
    id: 'silver-boots',
    name: 'BOTAS DE PRATA',
    texture: 'item-botas-prata',
    slot: 'PÉS',
    blockChance: 0,
    speedMultiplier: 1.1,
    dashCooldownMultiplier: 1,
    anchor: 'feet',
    description: 'BOTAS DE PRATA, GUARDADAS NUM BAÚ.\nANDA 10% MAIS RÁPIDO.',
    width: 14,
    height: 5,
    pixels: bootPixels(0x9aa4b4, 0xe6ecf4),
    fitFeet: (feet) => bootPixels(0x9aa4b4, 0xe6ecf4, feet)
};

/** Botas de diamante do baú da Marinha, na Sala II: o dash recarrega mais rápido. */
export const DIAMOND_BOOTS: ItemDefinition = {
    id: 'diamond-boots',
    name: 'BOTAS DE DIAMANTE',
    texture: 'item-botas-diamante',
    slot: 'PÉS',
    blockChance: 0,
    speedMultiplier: 1,
    dashCooldownMultiplier: 0.6,
    anchor: 'feet',
    description: 'BOTAS DE DIAMANTE, GUARDADAS NUM BAÚ.\nO DASH RECARREGA 40% MAIS RÁPIDO.',
    width: 14,
    height: 5,
    pixels: bootPixels(0x35c8e0, 0xc8f6ff),
    fitFeet: (feet) => bootPixels(0x35c8e0, 0xc8f6ff, feet)
};

/** Lâmina na diagonal, do cabo embaixo à esquerda até a ponta em cima à direita, como o ícone da espada do jogo. */
function swordPixels(edge: number, core: number): ItemPixels {
    const blade: [number, number, number, number, number][] = [];
    for (let step = 0; step < 10; step += 1) {
        blade.push([5 + step, 9 - step, 2, 2, edge]);
        blade.push([5 + step, 10 - step, 1, 1, core]);
    }
    return [
        ...blade,
        // Guarda atravessada e cabo escuro com o pomo.
        [3, 9, 2, 1, 0x3a2a1e],
        [5, 11, 1, 2, 0x3a2a1e],
        [2, 12, 3, 2, 0x56402e],
        [1, 14, 2, 2, 0xffd75a]
    ];
}

/** Espada flamejante dos baús: golpe corpo a corpo de dano médio nas salas normais, sem largar o tiro. */
export const FLAME_SWORD: ItemDefinition = {
    id: 'flame-sword',
    name: 'ESPADA FLAMEJANTE',
    texture: 'item-espada-flamejante',
    slot: 'MÃOS',
    blockChance: 0,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
    anchor: 'hand',
    heldByCombat: true,
    description: 'ACHADA NUM BAÚ. GOLPEIE COM O BOTÃO DIREITO\nSEM PARAR DE ATIRAR; CADA GOLPE SOLTA FOGO.',
    width: 16,
    height: 16,
    pixels: swordPixels(0xff6a1f, 0xffe27a)
};

/** Cajado de gelo dos baús: não bate, mas congela quem estiver em volta de tempos em tempos. */
export const ICE_STAFF: ItemDefinition = {
    id: 'ice-staff',
    name: 'CAJADO DE GELO',
    texture: 'item-cajado-gelo',
    slot: 'MÃOS',
    blockChance: 0,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
    anchor: 'hand',
    description: 'ACHADO NUM BAÚ. A CADA 4 S CONGELA POR 1 S\nOS INIMIGOS EM VOLTA. QUASE NÃO FERE.',
    // 6x18: cristal de gelo no alto de uma haste de madeira.
    width: 6,
    height: 18,
    pixels: [
        [2, 0, 2, 1, 0xe8fbff],
        [1, 1, 4, 3, 0x7fd8f0],
        [2, 1, 1, 2, 0xe8fbff],
        [0, 2, 1, 1, 0x7fd8f0],
        [5, 2, 1, 1, 0x7fd8f0],
        [2, 4, 2, 1, 0x3a8fb0],
        [2, 5, 2, 13, 0x6b4a2e],
        [2, 5, 1, 13, 0x8a6440]
    ]
};

export const ITEMS: Readonly<Record<ItemId, ItemDefinition>> = {
    'gaucho-hat': GAUCHO_HAT,
    helmet: HELMET,
    'rubber-boots': RUBBER_BOOTS,
    'silver-boots': SILVER_BOOTS,
    'diamond-boots': DIAMOND_BOOTS,
    'flame-sword': FLAME_SWORD,
    'ice-staff': ICE_STAFF
};

/**
 * Baús de item das salas: ficam trancados e só abrem se o combate da sala terminar dentro do tempo.
 * Posição em pixels do mapa (base do baú); tempo em milissegundos, contado da entrada na sala.
 */
export const ITEM_CHESTS: Partial<Record<RoomKey, Readonly<{
    x: number;
    y: number;
    item: ItemId;
    timeLimitMs: number;
    roomName: string;
}>>> = {
    // À direita do balcão do TCHAY, fora da fila.
    room1: { x: 640, y: 88, item: 'silver-boots', timeLimitMs: 90_000, roomName: 'SALA I' },
    // No alto da escada do Centro Cultural da Marinha, logo abaixo da placa.
    room2: { x: 216, y: 188, item: 'diamond-boots', timeLimitMs: 180_000, roomName: 'SALA II' }
};

/** Itens vestidos viram um número, um bit por item na ordem de ITEM_IDS: cabe no estado enviado 20 vezes por segundo. */
export function encodeWornItems(ids: readonly ItemId[]) {
    return ITEM_IDS.reduce((mask, id, bit) => (ids.includes(id) ? mask | (1 << bit) : mask), 0);
}

export function decodeWornItems(mask: number): ItemId[] {
    return ITEM_IDS.filter((_id, bit) => (mask & (1 << bit)) !== 0);
}

export function isItemId(value: unknown): value is ItemId {
    return ITEM_IDS.includes(value as ItemId);
}
