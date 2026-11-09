import type { Scene } from 'phaser';
import { createLampLights } from './createLampLights';
import { openRoomExit } from './openRoomExit';
import { ROOM_DEFINITIONS } from '../config/rooms';
import {
    toStairPassageArea,
    type StairPassageArea
} from './StairPassage';
import { createProceduralDungeon, type DungeonLayout } from './ProceduralDungeon';

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
const GRADES_DEPTH = 18;
const FLOOR_DEPTH = 0;
const SCENERY_DEPTH = 2;
// Um tom frio e moderado cria o clima noturno sem esconder os detalhes do mapa.
const ROOM_AMBIENT_TINT = 0xb8c0d0;
// Os postes usam três tiles verticais: somente os dois primeiros devem ocultar o jogador.
const POST_FOREGROUND_TILE_INDICES = new Set([758, 768]);
const ROOM2_FOREGROUND_LAYERS = new Set([
    'superior-postes',
    'old-terminal-teto-front',
    'old-terminal-teto-back',
    'linhas-placa',
    'poste-old-terminal',
    'placa-onibus',
    'grades'
]);

export interface Room {
    map: Phaser.Tilemaps.Tilemap;
    collisionLayers: Phaser.Tilemaps.TilemapLayer[];
    stairPassage?: StairPassageArea;
    dungeon?: DungeonLayout;
    openExit: () => void;
}

/** Mantém elementos altos da Room 2 na frente do personagem. */
export function getRoom2LayerDepth(layerName: string) {
    const localName = layerName.split('/').pop() ?? layerName;
    if (localName === 'grades') return GRADES_DEPTH;
    return ROOM2_FOREGROUND_LAYERS.has(localName) ? FOREGROUND_DEPTH : SCENERY_DEPTH;
}

export function isRoom2LampLayer(layerName: string) {
    return (layerName.split('/').pop() ?? layerName) === 'superior-postes';
}

/** Cria as layers do mapa e habilita colisão somente nos tiles marcados no Tiled. */
export function createRoom(scene: Scene, mapKey: string, dungeonSeed = Date.now()): Room | null {
    if (mapKey === 'dungeon') return createProceduralDungeon(scene, dungeonSeed);
    // A semente é da partida inteira; o esconderijo não pode repetir a planta da dungeon.
    if (mapKey === 'gaucho-dungeon') return createProceduralDungeon(scene, (dungeonSeed ^ 0x9e3779b9) >>> 0);
    if (mapKey === 'room2' || mapKey === 'room3') return createLayeredRoom(scene, mapKey);

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

/** Monta todas as camadas das Salas II e III na ordem do Tiled e respeita seus colliders por camada. */
function createLayeredRoom(scene: Scene, roomKey: 'room2' | 'room3'): Room | null {
    const roomDefinition = ROOM_DEFINITIONS[roomKey];
    const map = scene.make.tilemap({ key: roomDefinition.mapKey });
    if (map.tilesets.length !== roomDefinition.tilesets.length) {
        console.error(`A quantidade de tilesets da ${roomKey} não corresponde à configuração.`);
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
        const createdLayer = map.createLayer(index, resolvedTilesets);
        if (!createdLayer) {
            console.error(`Não foi possível criar a camada ${map.layers[index].name} da ${roomKey}.`);
            return null;
        }
        // As salas montadas no Tiled usam o renderizador clássico, que oferece tint e colisão Arcade.
        const layer = createdLayer as Phaser.Tilemaps.TilemapLayer;

        layer.setDepth(getRoom2LayerDepth(layer.layer.name)).setTint(ROOM_AMBIENT_TINT);
        if (isRoom2LampLayer(layer.layer.name)) createLampLights(scene, layer);
        if (layer.layer.name === 'stairs') stairsLayer = layer;
        if (hasColliderProperty(layer.layer.properties)) {
            layer.setCollisionByExclusion([-1]);
            collisionLayers.push(layer);
        }
    }

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    return {
        map,
        collisionLayers,
        // O efeito especial da escada existe apenas nas versões do mapa que
        // ainda possuem a layer dedicada `stairs`.
        stairPassage: stairsLayer
            ? toStairPassageArea(map.tileWidth, map.tileHeight)
            : undefined,
        openExit: () => {}
    };
}

function hasColliderProperty(properties: Phaser.Types.Tilemaps.LayerDataConfig['properties']) {
    const tiledProperties = properties as Array<{ name?: string; value?: unknown }> | undefined;
    return tiledProperties?.some((property) =>
        property.name === 'collider' && property.value === true
    ) ?? false;
}
