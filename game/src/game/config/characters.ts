/**
 * Pernas do personagem de frente no frame de 38 px: largura de cada perna, vão entre elas
 * e a linha logo abaixo do pé. As botas são desenhadas nessa medida para calçar de verdade.
 */
export type FeetFit = Readonly<{ legWidth: number; gap: number; bottom: number }>;

/** Personagens jogáveis: as folhas usam o mesmo layout, mas têm proporções visuais diferentes. */
export const CHARACTERS = {
    padrao: {
        label: 'PADRÃO',
        texture: 'player-walk',
        path: 'assets/character.png',
        scaleMultiplier: 1,
        feet: { legWidth: 6, gap: 2, bottom: 36 } as FeetFit
    },
    gaucho: {
        label: 'GAÚCHO',
        texture: 'player-gaucho',
        path: 'assets/characters/gaucho.png',
        // 35 px de altura no frame contra 30 px do padrão: ambos ficam com 21 px no jogo.
        scaleMultiplier: 6 / 7,
        // Pernas mais grossas e mais afastadas que as do padrão, e o pé uma linha mais baixo.
        feet: { legWidth: 7, gap: 6, bottom: 37 } as FeetFit
    }
} as const;

export type CharacterId = keyof typeof CHARACTERS;

const STORAGE_KEY = 'escape-from-floripa:character:v1';
const DEFAULT_CHARACTER: CharacterId = 'padrao';

type CharacterStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getBrowserStorage(): CharacterStorage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

export function isCharacterId(value: unknown): value is CharacterId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHARACTERS, value);
}

/** Preferência só deste navegador; sem armazenamento, o jogo usa o personagem padrão. */
export function loadCharacterId(storage: CharacterStorage | undefined = getBrowserStorage()): CharacterId {
    try {
        const saved = storage?.getItem(STORAGE_KEY);
        return isCharacterId(saved) ? saved : DEFAULT_CHARACTER;
    } catch {
        return DEFAULT_CHARACTER;
    }
}

export function saveCharacterId(id: CharacterId, storage: CharacterStorage | undefined = getBrowserStorage()) {
    try {
        storage?.setItem(STORAGE_KEY, id);
    } catch {
        // Sem armazenamento, a escolha vale só até recarregar a página.
    }
}

export function nextCharacterId(id: CharacterId): CharacterId {
    const ids = Object.keys(CHARACTERS) as CharacterId[];
    return ids[(ids.indexOf(id) + 1) % ids.length];
}
