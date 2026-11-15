import type { FeetFit } from './characters';
import type { RoomKey } from './rooms';

/** Itens de equipar guardados no inventário; cada um entra aqui quando for implementado. */
export type ItemId = 'gaucho-hat' | 'helmet' | 'rubber-boots' | 'silver-boots' | 'diamond-boots' | 'flame-sword' | 'ice-staff'
    | 'iron-armor' | 'vampire-cape' | 'wizard-hat';
export type EquipmentSlot = 'CABEÇA' | 'CORPO' | 'MÃOS' | 'PÉS';

// Itens novos entram sempre no fim: a posição é o bit enviado ao parceiro.
export const ITEM_IDS: readonly ItemId[] = [
    'gaucho-hat', 'helmet', 'rubber-boots', 'silver-boots', 'diamond-boots', 'flame-sword', 'ice-staff',
    'iron-armor', 'vampire-cape', 'wizard-hat'
];

/** Pixel art do item: retângulos [x, y, largura, altura, cor] desenhados uma vez numa textura. */
export type ItemPixels = readonly (readonly [number, number, number, number, number])[];

/** Desenho em texto, uma letra por pixel ('.' é vazio, '#' é o contorno): vira os retângulos de ItemPixels, um por trecho de cor na linha. */
export function gridPixels(rows: readonly string[], palette: Readonly<Record<string, number>>): ItemPixels {
    const colors: Record<string, number> = { '#': 0x101018, ...palette };
    const pixels: [number, number, number, number, number][] = [];
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
            let end = x + 1;
            while (row[end] === row[x]) end += 1;
            if (row[x] !== '.') pixels.push([x, y, end - x, 1, colors[row[x]]]);
            x = end;
        }
    });
    return pixels;
}

// Medida das pernas do personagem padrão: o ícone do inventário usa essa.
const DEFAULT_FEET = { legWidth: 6, gap: 2 };

/** Bota de perfil 10x5 com a ponta para a esquerda: cano no calcanhar (à direita), pé e sola na largura toda. */
export function sideBootPixels(color: number, shine: number): ItemPixels {
    return [
        [4, 0, 6, 3, color],
        [4, 0, 1, 3, shine],
        [0, 3, 10, 1, color],
        [0, 4, 10, 1, 0x101018]
    ];
}

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
    anchor: 'head' | 'feet' | 'hand' | 'body';
    /** Só o que vai no corpo: quantas linhas o desenho sobe acima da linha dos ombros (gola, ombreiras). */
    bodyRise?: number;
    /** Só a capa: de frente e de lado fica atrás do corpo; de costas, por cima, com este desenho do lado de fora. */
    backPixels?: ItemPixels;
    /** Multiplica o dano do tiro comum enquanto vestido. */
    shotDamageMultiplier?: number;
    /** Vida recuperada a cada horda vencida com o item vestido (2 = um coração). */
    hordeHeal?: number;
    /** A espada flamejante é desenhada pelo combate, que a gira no golpe; o resto segue o personagem. */
    heldByCombat?: boolean;
    width: number;
    height: number;
    pixels: ItemPixels;
    /** Só as botas: desenho refeito na medida das pernas de cada personagem. */
    fitFeet?: (feet: FeetFit) => ItemPixels;
    /** Só as botas: de lado as pernas ficam juntas, então vira um pé só de perfil, com a ponta para a esquerda. */
    sidePixels?: ItemPixels;
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
    fitFeet: (feet) => bootPixels(0x2e7d4a, 0x56b070, feet),
    sidePixels: sideBootPixels(0x2e7d4a, 0x56b070)
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
    fitFeet: (feet) => bootPixels(0x9aa4b4, 0xe6ecf4, feet),
    sidePixels: sideBootPixels(0x9aa4b4, 0xe6ecf4)
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
    fitFeet: (feet) => bootPixels(0x35c8e0, 0xc8f6ff, feet),
    sidePixels: sideBootPixels(0x35c8e0, 0xc8f6ff)
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

/** Peitoral de ferro do baú ao lado do Piranhas Bar: defesa leve, que soma com a do chapéu. */
export const IRON_ARMOR: ItemDefinition = {
    id: 'iron-armor',
    name: 'ARMADURA DE FERRO',
    texture: 'item-armadura-ferro',
    slot: 'CORPO',
    blockChance: 0.1,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
    anchor: 'body',
    bodyRise: 1,
    description: 'PEITORAL ACHADO NUM BAÚ AO LADO DO PIRANHAS BAR.\nBLOQUEIA 1 EM CADA 10 GOLPES, EM MÉDIA.',
    // 14x9: ombreiras, peito com o brilho à esquerda e a barra escura na cintura.
    width: 14,
    height: 9,
    pixels: gridPixels([
        '.###......###.',
        '#lmm#....#mmd#',
        '#lmmd####dmmd#',
        '.##d#llwm#d##.',
        '...#lwlmmd#...',
        '...#lwlmmd#...',
        '...#llmmmd#...',
        '...#mmmmdd#...',
        '....#dddd#....'
    ], { d: 0x5a6272, m: 0x9aa4b4, l: 0xd4dce6, w: 0xffffff })
};

const CAPE_PALETTE = { b: 0x1c1a26, g: 0x2e2b3c, r: 0x5a1420, R: 0x7e1e2c, p: 0xb07ab8 };

/** Capa de vampiro do baú da Sala III: cada horda vencida devolve meio coração. */
export const VAMPIRE_CAPE: ItemDefinition = {
    id: 'vampire-cape',
    name: 'CAPA DE VAMPIRO',
    texture: 'item-capa-vampiro',
    slot: 'CORPO',
    blockChance: 0,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
    anchor: 'body',
    bodyRise: 5,
    hordeHeal: 1,
    description: 'ACHADA NUM BAÚ DIANTE DO PRÉDIO AMARELO.\nCADA HORDA VENCIDA DEVOLVE MEIO CORAÇÃO.',
    // 22x18: gola alta em pontas ao lado da cabeça, forro vinho por dentro e a barra recortada.
    width: 22,
    height: 18,
    pixels: gridPixels([
        '.#..................#.',
        '.##................##.',
        '.#R#..............#R#.',
        '.#rR#............#Rr#.',
        '.#rrR############Rrr#.',
        '#gbrrrrrrrpprrrrrrrbg#',
        '#gbrrrrrrrrrrrrrrrrbg#',
        '#gbbrrrrrrrrrrrrrrbbg#',
        '#gbbrrrrrrrrrrrrrrbbg#',
        '#gbbrrrrrrrrrrrrrrbbg#',
        '#gbbrrrrrrrrrrrrrrbbg#',
        '#gbbrrrrrrrrrrrrrrbbg#',
        '#gbbbrrrrrrrrrrrrbbbg#',
        '#gbbbrrrrrrrrrrrrbbbg#',
        '#gbbbrrrrrrrrrrrrbbbg#',
        '#gbbb#rrrr#rrrr#bbbg#.',
        '.#bb#.#rr#.#rr#.#bb#..',
        '..##...##...##...##...'
    ], CAPE_PALETTE),
    backPixels: gridPixels([
        '.#..................#.',
        '.##................##.',
        '.#g#..............#g#.',
        '.#bg#............#gb#.',
        '.#bbg############gbb#.',
        '#gbbbbbbbbbbbbbbbbbbg#',
        '#gbbbbbbbbbbbbbbbbbbg#',
        '#gbbbbbbbgbbbbbbbbbbg#',
        '#gbbbbbbbgbbbbbgbbbbg#',
        '#gbbbbbbbgbbbbbgbbbbg#',
        '#gbbbbbbbbbbbbbgbbbbg#',
        '#gbbbbbgbbbbbbbbbbbbg#',
        '#gbbbbbgbbbbbbbbbbbbg#',
        '#gbbbbbgbbbbbbgbbbbbg#',
        '#gbbbbbbbbbbbbgbbbbbg#',
        '#gbbb#bbbb#bbbb#bbbg#.',
        '.#bb#.#bb#.#bb#.#bb#..',
        '..##...##...##...##...'
    ], CAPE_PALETTE)
};

/** Chapéu de mago do baú da Sala I: o tiro comum fere um pouco mais; com o cajado de gelo, vira o tiro arcano. */
export const WIZARD_HAT: ItemDefinition = {
    id: 'wizard-hat',
    name: 'CHAPÉU DE MAGO',
    texture: 'item-chapeu-mago',
    slot: 'CABEÇA',
    blockChance: 0,
    speedMultiplier: 1,
    dashCooldownMultiplier: 1,
    anchor: 'head',
    shotDamageMultiplier: 1.1,
    description: 'ACHADO NUM BAÚ PERTO DO GATUS ROCK BAR. TIRO +10%.\nCOM O CAJADO DE GELO, O TIRO FICA ROXO: +30%.',
    // 19x14: cone roxo com a ponta caída e a lua pendurada, faixa com fivela e aba larga.
    width: 19,
    height: 14,
    pixels: gridPixels([
        '............####...',
        '...........#Ppdd#..',
        '..........#Ppk##dk.',
        '..........#Pk...#k.',
        '.........#Ppk...#m#',
        '.........#Pyk....m.',
        '........#Pppdk.....',
        '........#Ppypdk....',
        '.......#Ppppppdk...',
        '......#ooOOssOOok..',
        '......#OOOOssOOOk..',
        '..#kkkPpppppppdkkk.',
        '.#PPpppppppppppppd#',
        '..#kkkkkkkkkkkkkkk.'
    ], { k: 0x101018, d: 0x3c1f6a, p: 0x6a3cb4, P: 0x9a6ae0, y: 0xffd24a, o: 0xc8762c, O: 0x8a4a1a, s: 0xd8d8e0, m: 0xffe27a })
};

export const ITEMS: Readonly<Record<ItemId, ItemDefinition>> = {
    'gaucho-hat': GAUCHO_HAT,
    helmet: HELMET,
    'rubber-boots': RUBBER_BOOTS,
    'silver-boots': SILVER_BOOTS,
    'diamond-boots': DIAMOND_BOOTS,
    'flame-sword': FLAME_SWORD,
    'ice-staff': ICE_STAFF,
    'iron-armor': IRON_ARMOR,
    'vampire-cape': VAMPIRE_CAPE,
    'wizard-hat': WIZARD_HAT
};

/**
 * Baús de item das salas, mais de um por sala. Os especiais (com tempo) ficam trancados e só abrem se o combate
 * da sala terminar dentro do tempo; os sem tempo abrem quando a sala é vencida.
 * Ao destrancar, o baú sorteia um item da lista que o jogador ainda não tem.
 * Posição em pixels do mapa (base do baú); tempo em milissegundos, contado da entrada na sala.
 */
export type ItemChestConfig = Readonly<{
    room: RoomKey;
    x: number;
    y: number;
    items: readonly ItemId[];
    timeLimitMs?: number;
    roomName: string;
}>;

export const ITEM_CHESTS: Readonly<Record<string, ItemChestConfig>> = {
    // À direita do balcão do TCHAY, fora da fila.
    room1: { room: 'room1', x: 640, y: 88, items: ['silver-boots'], timeLimitMs: 90_000, roomName: 'SALA I' },
    // Na calçada de baixo, à esquerda do Gatus Rock Bar.
    'room1-gatus': { room: 'room1', x: 86, y: 552, items: ['wizard-hat'], timeLimitMs: 90_000, roomName: 'SALA I' },
    // No alto da escada do Centro Cultural da Marinha, logo abaixo da placa.
    room2: { room: 'room2', x: 216, y: 188, items: ['diamond-boots', 'flame-sword', 'ice-staff'], timeLimitMs: 180_000, roomName: 'SALA II' },
    // Ao lado do Piranhas Bar: sem desafio, abre quando a sala é vencida.
    'room2-piranhas': { room: 'room2', x: 584, y: 232, items: ['iron-armor'], roomName: 'SALA II' },
    // No caminho de tijolos diante do monumento da Praça XV.
    room3: { room: 'room3', x: 576, y: 270, items: ['flame-sword', 'ice-staff', 'diamond-boots'], timeLimitMs: 240_000, roomName: 'SALA III' },
    // Bem em frente à Catedral, o prédio amarelo da Praça XV: ao pé da escadaria, à esquerda do bloqueio das colunas 23-26.
    'room3-predio': { room: 'room3', x: 20.5 * 16, y: 19 * 16, items: ['vampire-cape'], timeLimitMs: 240_000, roomName: 'SALA III' }
};

/** Baús de uma sala, com o id de cada um. */
export function getRoomChests(room: RoomKey) {
    return Object.entries(ITEM_CHESTS).filter(([, chest]) => chest.room === room);
}

/** Chapéu de mago com o cajado de gelo: o tiro comum vira arcano, roxo e brilhante, e fere mais que só com o chapéu. */
export const ARCANE_SHOT = { damageMultiplier: 1.3, color: 0xb36bff } as const;

export function isArcaneShot(ids: readonly ItemId[]) {
    return ids.includes('wizard-hat') && ids.includes('ice-staff');
}

/** Quanto os itens vestidos multiplicam o dano do tiro comum. */
export function getShotDamageMultiplier(ids: readonly ItemId[]) {
    if (isArcaneShot(ids)) return ARCANE_SHOT.damageMultiplier;
    return ids.reduce((total, id) => total * (ITEMS[id].shotDamageMultiplier ?? 1), 1);
}

/** Cada peça tenta bloquear por conta própria: chapéu de 20% e armadura de 10% juntos seguram 28% dos golpes. */
export function getCombinedBlockChance(worn: readonly Pick<ItemDefinition, 'blockChance'>[]) {
    return 1 - worn.reduce((miss, { blockChance }) => miss * (1 - blockChance), 1);
}

/** Itens da lista do baú que o jogador ainda não tem; vazio, o baú já nasce aberto. */
export function getChestCandidates(items: readonly ItemId[], owned: readonly ItemId[]) {
    return items.filter((id) => !owned.includes(id));
}

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
