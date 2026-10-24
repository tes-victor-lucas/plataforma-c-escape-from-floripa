import { GAME_WIDTH } from './display';

export const MENU_CONFIG = {
    // Posição e escala em que o logo estava pintado no fundo original.
    title: { texture: 'menu-title', path: 'assets/menu/title.png', x: GAME_WIDTH / 2, y: 139, scale: 0.5317 },
    background: { texture: 'menu-background-bridge', path: 'assets/menu/background-bridge.png' }
} as const;
