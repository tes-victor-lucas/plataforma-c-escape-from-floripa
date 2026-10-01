import StartGame from './game/main';
import { setupFullscreenButton } from './game/ui/FullscreenButton';

async function loadPixelGamerFont() {
    const pixelGamer = new FontFace(
        'PixelGamer',
        'url("assets/fonts/PixelGamer-Regular.otf")'
    );

    await pixelGamer.load();
    document.fonts.add(pixelGamer);
}

document.addEventListener('DOMContentLoaded', () => {
    void loadPixelGamerFont()
        .catch(() => {
            console.warn('Unable to load the Pixel Gamer font; using the fallback font.');
        })
        .finally(() => {
            const game = StartGame('game-container');
            setupFullscreenButton(game);
        });
});
