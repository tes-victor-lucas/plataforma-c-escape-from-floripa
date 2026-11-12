import type { Scene } from 'phaser';
import { CHARACTERS, type FeetFit } from '../config/characters';
import { ITEMS, type ItemDefinition, type ItemPixels } from '../config/items';

// Frame das folhas de personagem: as medidas das pernas são contadas nele.
const CHARACTER_FRAME = 38;

function drawPixelTexture(scene: Scene, key: string, pixels: ItemPixels, width: number, height: number) {
    if (scene.textures.exists(key)) return;
    const graphics = scene.make.graphics({}, false);
    for (const [x, y, w, h, color] of pixels) graphics.fillStyle(color, 1).fillRect(x, y, w, h);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
}

/** Desenha a textura do item uma vez por jogo; as cenas seguintes reaproveitam. */
export function createItemTexture(scene: Scene, item: ItemDefinition) {
    drawPixelTexture(scene, item.texture, item.pixels, item.width, item.height);
}

function getCharacterFeet(characterTexture: string): FeetFit {
    return Object.values(CHARACTERS).find(({ texture }) => texture === characterTexture)?.feet ?? CHARACTERS.padrao.feet;
}

/** Textura do item no corpo: as botas são redesenhadas na largura e no vão das pernas de quem as veste. */
export function getWornTexture(scene: Scene, item: ItemDefinition, characterTexture: string) {
    if (!item.fitFeet) {
        createItemTexture(scene, item);
        return item.texture;
    }
    const feet = getCharacterFeet(characterTexture);
    const key = `${item.texture}-${feet.legWidth}-${feet.gap}`;
    drawPixelTexture(scene, key, item.fitFeet(feet), feet.legWidth * 2 + feet.gap, item.height);
    return key;
}

/** Todas as texturas de item, para o inventário e os baús mostrarem qualquer um. */
export function createItemTextures(scene: Scene) {
    for (const item of Object.values(ITEMS)) createItemTexture(scene, item);
}

/** Posição do chapéu sobre a cabeça, proporcional ao tamanho do personagem na tela. */
export function getHatOffsetY(displayHeight: number) {
    return -displayHeight * 0.31;
}

/** Posição das botas: a sola encosta na linha de baixo do pé daquele personagem. */
export function getFeetOffsetY(displayHeight: number, item: ItemDefinition, characterTexture: string) {
    const { bottom } = getCharacterFeet(characterTexture);
    return ((bottom - item.height / 2 - CHARACTER_FRAME / 2) / CHARACTER_FRAME) * displayHeight;
}

export function getItemOffsetY(item: ItemDefinition, displayHeight: number, characterTexture: string) {
    if (item.anchor === 'hand') return displayHeight * HAND.y;
    return item.anchor === 'feet' ? getFeetOffsetY(displayHeight, item, characterTexture) : getHatOffsetY(displayHeight);
}

// Mão direita do personagem de frente, em fração do frame a partir do centro.
const HAND = { x: 0.2, y: 0.12 };

/** Só o que vai na mão sai do meio do corpo: fica na mão direita. */
export function getItemOffsetX(item: ItemDefinition, displayWidth: number) {
    return item.anchor === 'hand' ? displayWidth * HAND.x : 0;
}

/** Item vestido que acompanha o personagem pelo mapa, inclusive subindo a escada; devolve como tirá-lo. */
export function attachWornItem(scene: Scene, sprite: Phaser.GameObjects.Sprite, item: ItemDefinition, isPartner = false) {
    // No jogador local a espada flamejante já aparece na mão pelo combate; no parceiro não há combate para desenhá-la.
    if (item.heldByCombat && !isPartner) return () => undefined;
    const image = scene.add.image(sprite.x, sprite.y, getWornTexture(scene, item, sprite.texture.key));
    const detach = () => {
        scene.events.off('postupdate', follow);
        image.destroy();
    };
    const follow = () => {
        if (!sprite.active) {
            detach();
            return;
        }
        // O parceiro pode trocar de personagem no meio da partida: a bota acompanha as pernas novas.
        const texture = getWornTexture(scene, item, sprite.texture.key);
        if (image.texture.key !== texture) image.setTexture(texture);
        image.setPosition(
            sprite.x + getItemOffsetX(item, sprite.displayWidth),
            sprite.y + getItemOffsetY(item, sprite.displayHeight, sprite.texture.key)
        )
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
