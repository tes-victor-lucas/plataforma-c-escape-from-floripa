import type { Scene } from 'phaser';
import { ITEMS, type ItemDefinition } from '../config/items';

/** Desenha a textura do item uma vez por jogo; as cenas seguintes reaproveitam. */
export function createItemTexture(scene: Scene, item: ItemDefinition) {
    if (scene.textures.exists(item.texture)) return;
    const graphics = scene.make.graphics({}, false);
    for (const [x, y, width, height, color] of item.pixels) graphics.fillStyle(color, 1).fillRect(x, y, width, height);
    graphics.generateTexture(item.texture, item.width, item.height);
    graphics.destroy();
}

/** Todas as texturas de item, para o inventário e os baús mostrarem qualquer um. */
export function createItemTextures(scene: Scene) {
    for (const item of Object.values(ITEMS)) createItemTexture(scene, item);
}

/** Posição do chapéu sobre a cabeça, proporcional ao tamanho do personagem na tela. */
export function getHatOffsetY(displayHeight: number) {
    return -displayHeight * 0.31;
}

/** Posição das botas nos pés, proporcional ao tamanho do personagem na tela. */
export function getFeetOffsetY(displayHeight: number) {
    return displayHeight * 0.39;
}

export function getItemOffsetY(item: ItemDefinition, displayHeight: number) {
    return item.anchor === 'feet' ? getFeetOffsetY(displayHeight) : getHatOffsetY(displayHeight);
}

/** Item vestido que acompanha o personagem pelo mapa, inclusive subindo a escada; devolve como tirá-lo. */
export function attachWornItem(scene: Scene, sprite: Phaser.GameObjects.Sprite, item: ItemDefinition) {
    createItemTexture(scene, item);
    const image = scene.add.image(sprite.x, sprite.y, item.texture);
    const detach = () => {
        scene.events.off('postupdate', follow);
        image.destroy();
    };
    const follow = () => {
        if (!sprite.active) {
            detach();
            return;
        }
        image.setPosition(sprite.x, sprite.y + getItemOffsetY(item, sprite.displayHeight))
            .setScale(sprite.scaleX)
            .setAlpha(sprite.alpha)
            .setVisible(sprite.visible)
            .setDepth(sprite.depth + 0.01);
    };
    follow();
    scene.events.on('postupdate', follow);
    scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
    return detach;
}
