const PLAYER_ID = 'game-player';
const PANEL_ID = 'controls-panel';
const OPEN_BUTTON_ID = 'controls-button';
const CLOSE_BUTTON_ID = 'close-controls-button';
const BACKDROP_ID = 'controls-backdrop';

/** Controls the accessible game-instructions drawer rendered by the page shell. */
export function setupControlsPanel() {
    const player = document.getElementById(PLAYER_ID);
    const panel = document.getElementById(PANEL_ID);
    const openButton = document.getElementById(OPEN_BUTTON_ID) as HTMLButtonElement | null;
    const closeButton = document.getElementById(CLOSE_BUTTON_ID) as HTMLButtonElement | null;
    const backdrop = document.getElementById(BACKDROP_ID) as HTMLButtonElement | null;

    if (!player || !panel || !openButton || !closeButton || !backdrop) return;

    const setOpen = (isOpen: boolean) => {
        player.classList.toggle('controls-open', isOpen);
        panel.setAttribute('aria-hidden', String(!isOpen));
        openButton.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
            closeButton.focus();
        } else if (panel.contains(document.activeElement)) {
            openButton.focus();
        }
    };

    openButton.addEventListener('click', () => {
        setOpen(!player.classList.contains('controls-open'));
    });
    closeButton.addEventListener('click', () => setOpen(false));
    backdrop.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && player.classList.contains('controls-open')) {
            event.stopPropagation();
            setOpen(false);
        }
    }, true);
}
