export type PiranhasBarItemId = 'gin-tropical' | 'gin-melancia' | 'cookie-magico';

export type PiranhasBarItem = Readonly<{
    id: PiranhasBarItemId;
    kind: 'stat' | 'ability';
    theme: 'yellow' | 'red' | 'mystery';
    label: string;
    title: string;
    description: string;
    texture: string;
}>;

export const PIRANHAS_BAR_CONFIG = {
    interactionArea: {
        left: 24 * 16,
        right: 35 * 16,
        top: 10 * 16,
        bottom: 15 * 16
    },
    prompt: { x: 29.5 * 16, y: 12 * 16 },
    tropicalSpeedMultiplier: 1.25,
    watermelonHealthIncrease: 2,
    nauseaDuration: 10_000,
    nauseaRotation: 0.035,
    nauseaZoom: 0.018
} as const;

export const PIRANHAS_BAR_ITEMS = [
    {
        id: 'gin-tropical',
        kind: 'stat',
        theme: 'yellow',
        label: 'BEBIDA',
        title: 'Gin de 10 Tropical',
        description: 'Aumenta a velocidade de movimento em 25%.',
        texture: 'piranhas-gin-tropical'
    },
    {
        id: 'gin-melancia',
        kind: 'stat',
        theme: 'red',
        label: 'BEBIDA',
        title: 'Gin de 10 Melancia',
        description: 'Adiciona um coração e recupera essa vida.',
        texture: 'piranhas-gin-melancia'
    },
    {
        id: 'cookie-magico',
        kind: 'ability',
        theme: 'mystery',
        label: 'COMIDA',
        title: 'Cookie Mágico',
        description: '???',
        texture: 'piranhas-cookie-magico'
    }
] as const satisfies readonly PiranhasBarItem[];

export function isInsidePiranhasBarArea(x: number, y: number) {
    const area = PIRANHAS_BAR_CONFIG.interactionArea;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}
