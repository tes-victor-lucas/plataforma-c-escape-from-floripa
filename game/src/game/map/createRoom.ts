import type { Scene } from 'phaser';
import { createLampLights } from './createLampLights';
import { openRoomExit } from './openRoomExit';
import { ROOM_DEFINITIONS } from '../config/rooms';
import {
    isOutsideStairPassage,
    toStairPassageArea,
    type StairPassageArea
} from './StairPassage';

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
// Um tom frio e moderado cria o clima noturno sem esconder os detalhes do mapa.
const ROOM_AMBIENT_TINT = 0xb8c0d0;
// Os postes usam três tiles verticais: somente os dois primeiros devem ocultar o jogador.
const POST_FOREGROUND_TILE_INDICES = new Set([758, 768]);

export interface Room {
    map: Phaser.Tilemaps.Tilemap;
    collisionLayers: Phaser.Tilemaps.TilemapLayer[];
    stairPassage?: StairPassageArea;
    openExit: () => void;
}

/** Cria as layers do mapa e habilita colisão somente nos tiles marcados no Tiled. */
export function createRoom(scene: Scene, mapKey: string): Room | null {
    if (mapKey === 'room2') return createRoom2(scene);

    const map = scene.make.tilemap({ key: mapKey });
    const tilesets = ROOM_DEFINITIONS.room1.tilesets.map(({ mapName, textureKey }) =>
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
        layer.setTint(ROOM_AMBIENT_TINT);
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
    postForegroundLayer
        .setDepth(FOREGROUND_DEPTH)
        .setTint(ROOM_AMBIENT_TINT);

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    return { map, collisionLayers, openExit: () => openRoomExit(collisionLayers) };
}

/** Monta todas as camadas da Room 2 na ordem do Tiled e respeita seus colliders por camada. */
function createRoom2(scene: Scene): Room | null {
    const roomDefinition = ROOM_DEFINITIONS.room2;
    const map = scene.make.tilemap({ key: roomDefinition.mapKey });
    if (map.tilesets.length !== roomDefinition.tilesets.length) {
        console.error('A quantidade de tilesets da room2 não corresponde à configuração.');
        return null;
    }

    // Resolve por posição para aceitar tilesets repetidos que o Tiled exporta com o mesmo nome.
    const resolvedTilesets = map.tilesets.map((tileset, index) => {
        const { textureKey } = roomDefinition.tilesets[index];
        tileset.setImage(scene.textures.get(textureKey));
        return tileset;
    });
    const collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    let stairsLayer: Phaser.Tilemaps.TilemapLayer | undefined;

    for (let index = 0; index < map.layers.length; index += 1) {
        const layer = map.createLayer(index, resolvedTilesets);
        if (!layer) {
            console.error(`Não foi possível criar a camada ${map.layers[index].name} da room2.`);
            return null;
        }

        layer.setDepth(SCENERY_DEPTH).setTint(ROOM_AMBIENT_TINT);
        if (layer.layer.name === 'stairs') stairsLayer = layer;
        if (hasColliderProperty(layer.layer.properties)) {
            layer.setCollisionByExclusion([-1]);
            collisionLayers.push(layer);
        }
    }

    if (!stairsLayer) {
        console.error('A layer stairs não foi encontrada na room2.');
        return null;
    }

    const stairBlockers = createStairBlockers(map, resolvedTilesets, stairsLayer);
    if (!stairBlockers) return null;
    collisionLayers.push(stairBlockers);

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    return {
        map,
        collisionLayers,
        stairPassage: toStairPassageArea(map.tileWidth, map.tileHeight),
        openExit: () => {}
    };
}

/** Replica apenas os tiles laterais da escada em uma layer invisível de colisão. */
function createStairBlockers(
    map: Phaser.Tilemaps.Tilemap,
    tilesets: Phaser.Tilemaps.Tileset[],
    stairsLayer: Phaser.Tilemaps.TilemapLayer
) {
    const blockers = map.createBlankLayer('stair-side-blockers', tilesets, 0, 0);
    if (!blockers) {
        console.error('Não foi possível criar os bloqueios laterais da escada da room2.');
        return null;
    }

    stairsLayer.forEachTile((tile) => {
        if (tile.index !== -1 && isOutsideStairPassage(tile.x, tile.y)) {
            blockers.putTileAt(tile.index, tile.x, tile.y);
        }
    });

    blockers.setVisible(false).setCollisionByExclusion([-1]);
    return blockers;
}

function hasColliderProperty(properties: Phaser.Types.Tilemaps.LayerDataConfig['properties']) {
    return properties?.some((property) => property.name === 'collider' && property.value === true) ?? false;
}
