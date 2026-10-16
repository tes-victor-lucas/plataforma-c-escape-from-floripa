import './styles.css';
import StartGame from './game/main';
import { setupControlsPanel } from './game/ui/ControlsPanel';
import { setupFullscreenButton } from './game/ui/FullscreenButton';

async function loadGameFonts() {
    const fonts = [
        new FontFace('PixelGamer', 'url("assets/fonts/PixelGamer-Regular.otf")'),
        new FontFace('Pixeboy', 'url("assets/fonts/Pixeboy.ttf")')
    ];
    const loadedFonts = await Promise.all(fonts.map((font) => font.load()));
    loadedFonts.forEach((font) => document.fonts.add(font));
}

document.addEventListener('DOMContentLoaded', () => {
    void loadGameFonts()
        .catch(() => {
            console.warn('Unable to load the game fonts; using fallback fonts.');
        })
        .finally(() => {
            setupControlsPanel();
            const game = StartGame('game-container');
            setupFullscreenButton(game);
        });
});
