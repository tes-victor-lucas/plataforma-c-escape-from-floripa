import type { Scene } from 'phaser';

const LAMP_TILE_INDEX = 758;
const LIGHT_DEPTH = 1;
export const LAMP_LIGHT_TEXTURE = 'lamp-light';
const LAMP_LIGHT_RADIUS = 60;
const LAMP_LIGHT_ALPHA = 0.72;

/** Cria halos suaves sob os postes de luz presentes na layer de objetos. */
export function createLampLights(scene: Scene, objectsLayer: Phaser.Tilemaps.TilemapLayer) {
    objectsLayer.forEachTile((tile) => {
        if (tile.index !== LAMP_TILE_INDEX) return;

        createLampLight(
            scene,
            tile.getCenterX(),
            tile.getCenterY() + 11
        );
    });
}

/** Reutiliza o mesmo halo radial quente dos postes em outros pontos do mapa. */
export function createLampLight(
    scene: Scene,
    x: number,
    y: number,
    depth = LIGHT_DEPTH,
    alpha = LAMP_LIGHT_ALPHA
) {
    createLampLightTexture(scene);
    return scene.add.image(x, y, LAMP_LIGHT_TEXTURE)
        .setDepth(depth)
        .setAlpha(alpha)
        .setBlendMode(Phaser.BlendModes.ADD);
}

function createLampLightTexture(scene: Scene) {
    if (scene.textures.exists(LAMP_LIGHT_TEXTURE)) return;

    const diameter = LAMP_LIGHT_RADIUS * 2;
    const texture = scene.textures.createCanvas(LAMP_LIGHT_TEXTURE, diameter, diameter);
    if (!texture) return;

    const context = texture.context;
    const gradient = context.createRadialGradient(
        LAMP_LIGHT_RADIUS,
        LAMP_LIGHT_RADIUS,
        2,
        LAMP_LIGHT_RADIUS,
        LAMP_LIGHT_RADIUS,
        LAMP_LIGHT_RADIUS
    );

    gradient.addColorStop(0, 'rgba(255, 229, 158, 0.82)');
    gradient.addColorStop(0.32, 'rgba(255, 190, 82, 0.42)');
    gradient.addColorStop(1, 'rgba(255, 142, 45, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, diameter, diameter);
    texture.refresh();
}
