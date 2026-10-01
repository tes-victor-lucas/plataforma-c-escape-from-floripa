import { Game, Scale } from 'phaser';

const BUTTON_ID = 'fullscreen-button';

/** Connects the persistent DOM button to Phaser's fullscreen scale manager. */
export function setupFullscreenButton(game: Game) {
    const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
    if (!button) return;

    const updateButton = () => {
        const isFullscreen = game.scale.isFullscreen;
        const label = isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia';

        button.dataset.fullscreen = String(isFullscreen);
        button.setAttribute('aria-label', label);
        button.title = label;
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
}
