import './styles.css';
import StartGame from './game/main';
import { setupControlsPanel } from './game/ui/ControlsPanel';
import { setupFullscreenButton } from './game/ui/FullscreenButton';

async function loadGameFonts() {
    const fonts = [
        new FontFace('PixelGamer', 'url("assets/fonts/PixelGamer-Regular.otf")'),
        // Na PixelGamer, números e estes símbolos são desenhos: vêm da Pixeboy, no tamanho das letras.
        new FontFace('PixelGamer', 'url("assets/fonts/Pixeboy.ttf")', {
            unicodeRange: 'U+24-26, U+2C, U+2E, U+30-39',
            // Ainda não está nos tipos do TypeScript.
            sizeAdjust: '140%'
        } as FontFaceDescriptors),
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
            const gameContainer = document.getElementById('game-container');
            gameContainer?.addEventListener('pointerdown', () => gameContainer.focus());
            const game = StartGame('game-container');
            setupFullscreenButton(game);
        });
});
