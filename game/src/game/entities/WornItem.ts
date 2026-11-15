import type { Scene } from 'phaser';
import { getCharacterByTexture, type FeetFit } from '../config/characters';
import { ITEMS, type ItemDefinition, type ItemPixels } from '../config/items';
import { WALK_FRAMES } from './PlayerAnimations';

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

function getCharacter(characterTexture: string) {
    return getCharacterByTexture(characterTexture);
}

function getCharacterFeet(characterTexture: string): FeetFit {
    return getCharacter(characterTexture).feet;
}

/** De costas (andando para cima): a capa troca de desenho e passa para a frente do corpo. */
export function isWalkingAway(frame: number) {
    return WALK_FRAMES.up.includes(frame);
}

/** -1 andando para a esquerda, 1 para a direita, 0 de frente ou de costas: pelo quadro da folha de andar. */
export function getWalkSide(frame: number) {
    if (WALK_FRAMES.left.includes(frame)) return -1;
    if (WALK_FRAMES.right.includes(frame)) return 1;
    return 0;
}

/** Textura do item no corpo: as botas são redesenhadas na largura e no vão das pernas de quem as veste; de lado, de perfil. */
export function getWornTexture(scene: Scene, item: ItemDefinition, characterTexture: string, isSide = false, isBack = false) {
    if (isBack && item.backPixels) {
        const key = `${item.texture}-costas`;
        drawPixelTexture(scene, key, item.backPixels, item.width, item.height);
        return key;
    }
    if (isSide && item.sidePixels) {
        const key = `${item.texture}-lado`;
        drawPixelTexture(scene, key, item.sidePixels, 10, item.height);
        return key;
    }
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
// O chapéu de gaúcho (8 px de altura) senta na cabeça nessa posição; chapéus mais altos crescem para cima a partir da mesma aba.
const HAT_BRIM_HEIGHT = 8;

export function getHatOffsetY(displayHeight: number, itemHeight = HAT_BRIM_HEIGHT) {
    return -displayHeight * 0.31 + ((HAT_BRIM_HEIGHT - itemHeight) / 2 / CHARACTER_FRAME) * displayHeight;
}

/** Posição das botas: a sola encosta na linha de baixo do pé daquele personagem. */
export function getFeetOffsetY(displayHeight: number, item: ItemDefinition, characterTexture: string) {
    const { bottom } = getCharacterFeet(characterTexture);
    return ((bottom - item.height / 2 - CHARACTER_FRAME / 2) / CHARACTER_FRAME) * displayHeight;
}

/** Peças do corpo: o topo do desenho fica `bodyRise` linhas acima dos ombros daquele personagem. */
export function getBodyOffsetY(displayHeight: number, item: ItemDefinition, characterTexture: string) {
    const top = getCharacter(characterTexture).shoulderY - (item.bodyRise ?? 0);
    return ((top + item.height / 2 - CHARACTER_FRAME / 2) / CHARACTER_FRAME) * displayHeight;
}

export function getItemOffsetY(item: ItemDefinition, displayHeight: number, characterTexture: string) {
    if (item.anchor === 'hand') return displayHeight * HAND.y;
    if (item.anchor === 'body') return getBodyOffsetY(displayHeight, item, characterTexture);
    return item.anchor === 'feet' ? getFeetOffsetY(displayHeight, item, characterTexture) : getHatOffsetY(displayHeight, item.height);
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
        // De lado, a bota vira perfil; o desenho aponta para a esquerda e espelha para a direita.
        const frame = Number(sprite.frame.name);
        const side = item.anchor === 'feet' ? getWalkSide(frame) : 0;
        // A capa fica atrás do corpo, menos de costas, quando cobre as costas por cima.
        const isBack = item.backPixels !== undefined && isWalkingAway(frame);
        const texture = getWornTexture(scene, item, sprite.texture.key, side !== 0, isBack);
        if (image.texture.key !== texture) image.setTexture(texture);
        image.setFlipX(side === 1);
        image.setPosition(
            sprite.x + getItemOffsetX(item, sprite.displayWidth),
            sprite.y + getItemOffsetY(item, sprite.displayHeight, sprite.texture.key)
        )
            .setScale(sprite.scaleX)
            .setAlpha(sprite.alpha)
            .setVisible(sprite.visible)
            .setDepth(sprite.depth + (item.backPixels && !isBack ? -0.01 : 0.01));
    };
    follow();
    scene.events.on('postupdate', follow);
    scene.events.once('shutdown', () => scene.events.off('postupdate', follow));
    return detach;
}
