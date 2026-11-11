import { Game, Scale } from 'phaser';
import { isTouchScreen, orientationFullscreenAction } from '../input/TouchInput';

const BUTTON_ID = 'fullscreen-button';

/** Connects the player-shell action to Phaser's fullscreen scale manager. */
export function setupFullscreenButton(game: Game) {
    const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
    if (!button) return;

    const visibleLabel = button.querySelector<HTMLElement>('.fullscreen-label');

    const updateButton = () => {
        const isFullscreen = game.scale.isFullscreen;
        const label = isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia';

        button.dataset.fullscreen = String(isFullscreen);
        button.setAttribute('aria-label', label);
        button.title = label;
        if (visibleLabel) {
            visibleLabel.textContent = isFullscreen ? 'Sair da tela cheia' : 'Tela cheia';
        }
    };

    const disableButton = () => {
        button.disabled = true;
        button.title = 'Tela cheia indisponível neste navegador';
    };

    button.addEventListener('click', () => game.scale.toggleFullscreen());
    game.scale.on(Scale.Events.ENTER_FULLSCREEN, updateButton);
    game.scale.on(Scale.Events.LEAVE_FULLSCREEN, updateButton);
    game.scale.on(Scale.Events.FULLSCREEN_UNSUPPORTED, disableButton);

    updateButton();
    // Phaser só avisa "sem suporte" na primeira tentativa; o iPhone já sabemos de cara.
    if (!game.device.fullscreen.available) disableButton();
    setupOrientationFullscreen(game, button);
}

/** Celular deitado joga em tela cheia; ao ficar em pé sai sozinho. */
function setupOrientationFullscreen(game: Game, button: HTMLElement) {
    const landscape = window.matchMedia('(orientation: landscape)');
    const sync = (isGesture: boolean) => {
        const action = orientationFullscreenAction(isTouchScreen(), landscape.matches, game.scale.isFullscreen);
        if (action === 'exit') game.scale.stopFullscreen();
        // O navegador só abre tela cheia dentro de um gesto: girar não conta, então ela abre no próximo toque.
        if (action === 'enter' && isGesture) game.scale.startFullscreen();
    };
    landscape.addEventListener('change', () => sync(false));
    window.addEventListener('pointerup', (event) => {
        // O próprio botão alterna a tela cheia; abrir aqui também faria o clique fechá-la em seguida.
        if (!button.contains(event.target as Node)) sync(true);
    }, true);
}
