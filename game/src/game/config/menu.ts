import { GAME_WIDTH } from './display';

const SIDE_MARGIN = 48;

export const MENU_CONFIG = {
    // O central é o menu principal; o lateral só aparece com ?telas na URL.
    layouts: {
        center: {
            // Posição e escala em que o logo estava pintado no fundo original.
            title: { texture: 'menu-title', path: 'assets/menu/title.png', scale: 0.5317 },
            titleX: GAME_WIDTH / 2,
            titleOriginX: 0.5,
            titleY: 139,
            menuX: GAME_WIDTH / 2,
            actions: { color: '#0074df', disabledColor: '#6c7580', shadow: undefined, spacing: 25, markerSlide: 0 },
            backgrounds: [
                { texture: 'menu-background-bridge', path: 'assets/menu/background-bridge.png' }
            ]
        },
        side: {
            // Logo já reduzido a 260px: no pixelArt o Phaser amostra sem filtro e quebraria as letras.
            title: { texture: 'menu-title-side', path: 'assets/menu/title-side.png', scale: 1 },
            titleX: SIDE_MARGIN,
            titleOriginX: 0,
            // Logo de 40px de altura, encostado no bloco de opções logo abaixo.
            titleY: 171,
            // Centro do logo lateral, que tem 260px de largura.
            menuX: SIDE_MARGIN + 260 / 2,
            // Tons frios das próprias cenas, para que só o vermelho do logo e do marcador chamem atenção.
            actions: {
                color: '#8fa3b8',
                disabledColor: '#46525f',
                shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true },
                spacing: 30,
                markerSlide: 4
            },
            backgrounds: [
                { texture: 'menu-background-platform', path: 'assets/menu/background-platform.png' },
                { texture: 'menu-background-bus', path: 'assets/menu/background-bus.png' },
                { texture: 'menu-background-drone', path: 'assets/menu/background-drone.png' },
                { texture: 'menu-background-terminal', path: 'assets/menu/background-terminal.png' },
                { texture: 'menu-background-bar', path: 'assets/menu/background-bar.png' }
            ]
        }
    },
    backgroundHoldMs: 9000,
    backgroundFadeMs: 1600
} as const;

export type MenuLayout = (typeof MENU_CONFIG.layouts)[keyof typeof MENU_CONFIG.layouts];

export function getMenuLayout(
    search = typeof window === 'undefined' ? '' : window.location.search
): MenuLayout {
    return new URLSearchParams(search).has('telas') ? MENU_CONFIG.layouts.side : MENU_CONFIG.layouts.center;
}
