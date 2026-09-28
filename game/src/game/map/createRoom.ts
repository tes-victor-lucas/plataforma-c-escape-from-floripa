import type { Scene } from 'phaser';
import { createLampLights } from './createLampLights';
import { openRoomExit } from './openRoomExit';

const TILESETS = [
    { mapName: 'floor_and_buildings-01', textureKey: 'floor_and_buildings' },
    { mapName: 'floor_and_walls-1', textureKey: 'floor_and_walls' },
    { mapName: 'objects_and_items-01', textureKey: 'objects' }
] as const;

const LAYER_NAMES = [
    'floor',
    'wall',
    'wall-stores',
    'objects',
    'street',
    'objectos-block-back',
    'objects-block'
] as const;
const FOREGROUND_DEPTH = 20;
const FLOOR_DEPTH = 0;
const SCENERY_DEPTH = 2;
// Os postes usam três tiles verticais: somente os dois primeiros devem ocultar o jogador.
const POST_FOREGROUND_TILE_INDICES = new Set([758, 768]);

export interface Room {
    map: Phaser.Tilemaps.Tilemap;
    collisionLayers: Phaser.Tilemaps.TilemapLayer[];
    openExit: () => void;
}

/** Cria as layers do mapa e habilita colisão somente nos tiles marcados no Tiled. */
export function createRoom(scene: Scene, mapKey: string): Room | null {
    const map = scene.make.tilemap({ key: mapKey });
    const tilesets = TILESETS.map(({ mapName, textureKey }) =>
        map.addTilesetImage(mapName, textureKey)
    );

    if (tilesets.some((tileset) => tileset === null)) {
        console.error(`Não foi possível resolver todos os tilesets do ${mapKey}.`, tilesets);
        return null;
    }

    const resolvedTilesets = tilesets as Phaser.Tilemaps.Tileset[];
    const layers = LAYER_NAMES.map((name) =>
        map.createLayer(name, resolvedTilesets, 0, 0)
    );

    if (layers.some((layer) => layer === null)) {
        console.error(`Uma ou mais layers do mapa ${mapKey} não foram encontradas.`);
        return null;
    }

    const collisionLayers = layers as Phaser.Tilemaps.TilemapLayer[];

    collisionLayers[LAYER_NAMES.indexOf('floor')].setDepth(FLOOR_DEPTH);
    for (const name of [
        'wall',
        'wall-stores',
        'objects',
        'street',
        'objectos-block-back',
        'objects-block'
    ] as const) {
        collisionLayers[LAYER_NAMES.indexOf(name)].setDepth(SCENERY_DEPTH);
    }

    for (const layer of collisionLayers) {
        layer.setCollisionByProperty({ collider: true });
    }

    const objectsLayer = collisionLayers[LAYER_NAMES.indexOf('objects')];
    createLampLights(scene, objectsLayer);
    const postForegroundLayer = map.createBlankLayer('post-foreground', resolvedTilesets, 0, 0);

    if (!postForegroundLayer) {
        console.error(`Não foi possível criar a camada de primeiro plano do ${mapKey}.`);
        return null;
    }

    objectsLayer.forEachTile((tile) => {
        if (POST_FOREGROUND_TILE_INDICES.has(tile.index)) {
            postForegroundLayer.putTileAt(tile.index, tile.x, tile.y);
        }
    });
    postForegroundLayer.setDepth(FOREGROUND_DEPTH);

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    return { map, collisionLayers, openExit: () => openRoomExit(collisionLayers) };
}
