import type { Scene } from 'phaser';
import { GAUCHO_HAT } from '../config/items';

// Pixel art 16x8: aba larga, copa escura e a faixa vermelha do chapéu campeiro.
const HAT_PIXELS: readonly [number, number, number, number, number][] = [
    [5, 0, 6, 1, 0x3a2a1e],
    [4, 1, 8, 3, 0x3a2a1e],
    [5, 1, 3, 1, 0x56402e],
    [4, 4, 8, 1, 0xa3212b],
    [0, 5, 16, 2, 0x24180f],
    [1, 5, 14, 1, 0x4a3524],
    [3, 7, 10, 1, 0x120c08]
];

/** Desenha a textura uma vez por jogo; as cenas seguintes reaproveitam. */
export function createGauchoHatTexture(scene: Scene) {
    if (scene.textures.exists(GAUCHO_HAT.texture)) return;
    const graphics = scene.make.graphics({}, false);
    for (const [x, y, width, height, color] of HAT_PIXELS) graphics.fillStyle(color, 1).fillRect(x, y, width, height);
    graphics.generateTexture(GAUCHO_HAT.texture, 16, 8);
    graphics.destroy();
}

/** Posição do chapéu sobre a cabeça, proporcional ao tamanho do personagem na tela. */
export function getHatOffsetY(displayHeight: number) {
    return -displayHeight * 0.31;
}

/** Chapéu que acompanha o personagem pelo mapa, inclusive subindo a escada e sumindo junto. */
export function attachGauchoHat(scene: Scene, sprite: Phaser.GameObjects.Sprite) {
    createGauchoHatTexture(scene);
    const hat = scene.add.image(sprite.x, sprite.y, GAUCHO_HAT.texture);
    const follow = () => {
        if (!sprite.active) {
            hat.destroy();
            scene.events.off('postupdate', follow);
            return;
        }
        hat.setPosition(sprite.x, sprite.y + getHatOffsetY(sprite.displayHeight))
            .setScale(sprite.scaleX)
            .setAlpha(sprite.alpha)
            .setVisible(sprite.visible)
            .setDepth(sprite.depth + 0.01);
    };
    follow();
    scene.events.on('postupdate', follow);
    scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
    return hat;
}
