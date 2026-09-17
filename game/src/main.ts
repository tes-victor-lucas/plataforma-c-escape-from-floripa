import StartGame from './game/main';

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
            StartGame('game-container');
        });
});
