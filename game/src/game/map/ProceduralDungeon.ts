import type { Scene } from 'phaser';
import type { Room } from './createRoom';
import { createLampLight } from './createLampLights';

export const DUNGEON_TILE_SIZE = 16;
export const DUNGEON_WIDTH = 50;
export const DUNGEON_HEIGHT = 40;
const DUNGEON_TEXTURE = 'procedural-dungeon-tiles';
const DUNGEON_SOURCE_TEXTURE = 'neo-zero-dungeon-tiles';
const DUNGEON_OBSTACLE_TEXTURE = 'neo-zero-dungeon-props';
const DUNGEON_OBSTACLE_COUNT = 12;
// Famílias pequenas e coesas: quatro variações para cada material.
export const DUNGEON_FLOOR_TILE_INDICES = [0, 1, 2, 3] as const;
export const DUNGEON_WALL_TILE_INDICES = [4, 5, 6, 7] as const;
export const DUNGEON_FLOOR_TILE_INDEX = DUNGEON_FLOOR_TILE_INDICES[0];
export const DUNGEON_WALL_TILE_INDEX = DUNGEON_WALL_TILE_INDICES[0];

const DUNGEON_TILE_SOURCES = [
    // Pisos cinza com juntas e detalhes mínimos.
    { x: 16, y: 160 },
    { x: 32, y: 160 },
    { x: 48, y: 160 },
    { x: 16, y: 176 },
    // Paredes cinza-escuras com diferenças muito discretas.
    { x: 16, y: 112 },
    { x: 32, y: 112 },
    { x: 48, y: 112 },
    { x: 32, y: 128 }
] as const;

const DUNGEON_PROP_FRAMES = [
    { x: 17, y: 16, width: 15, height: 18, tilesWide: 1, tilesHigh: 2 },
    { x: 39, y: 16, width: 41, height: 24, tilesWide: 3, tilesHigh: 2 },
    { x: 81, y: 16, width: 30, height: 24, tilesWide: 2, tilesHigh: 2 },
    { x: 112, y: 16, width: 16, height: 24, tilesWide: 1, tilesHigh: 2 },
    { x: 19, y: 75, width: 26, height: 20, tilesWide: 2, tilesHigh: 2 },
    { x: 80, y: 80, width: 32, height: 16, tilesWide: 2, tilesHigh: 1 },
    { x: 48, y: 64, width: 32, height: 16, tilesWide: 2, tilesHigh: 1 },
    { x: 144, y: 81, width: 32, height: 15, tilesWide: 2, tilesHigh: 1 }
] as const;

export type DungeonLayout = Readonly<{
    seed: number;
    width: number;
    height: number;
    walls: readonly boolean[];
    spawn: Readonly<{ x: number; y: number }>;
    returnArea: Readonly<{ left: number; right: number; top: number; bottom: number }>;
    obstacles: readonly Readonly<{ x: number; y: number; variant: number }>[];
}>;

/** PRNG pequeno e determinista: a mesma seed sempre recria o mesmo subsolo. */
function createRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

/** Gera uma sequência de salas ligada por corredores largos e sempre navegáveis. */
export function generateDungeonLayout(seed: number): DungeonLayout {
    const normalizedSeed = seed >>> 0;
    const random = createRandom(normalizedSeed);
    const walls = Array<boolean>(DUNGEON_WIDTH * DUNGEON_HEIGHT).fill(true);
    const centers: Array<{ x: number; y: number }> = [{ x: 5, y: 20 }];
    let previousY = 20;

    for (const x of [11, 17, 23, 29, 35, 41]) {
        const variation = Math.floor(random() * 15) - 7;
        previousY = Math.max(6, Math.min(DUNGEON_HEIGHT - 7, previousY + variation));
        centers.push({ x, y: previousY });
    }
    centers.push({ x: 46, y: 20 });

    const carve = (x: number, y: number) => {
        if (x <= 0 || x >= DUNGEON_WIDTH - 1 || y <= 0 || y >= DUNGEON_HEIGHT - 1) return;
        walls[y * DUNGEON_WIDTH + x] = false;
    };
    const carveRoom = (center: { x: number; y: number }, width: number, height: number) => {
        const left = Math.max(1, Math.floor(center.x - width / 2));
        const top = Math.max(1, Math.floor(center.y - height / 2));
        const right = Math.min(DUNGEON_WIDTH - 2, left + width - 1);
        const bottom = Math.min(DUNGEON_HEIGHT - 2, top + height - 1);
        for (let y = top; y <= bottom; y += 1) {
            for (let x = left; x <= right; x += 1) carve(x, y);
        }
    };
    const carveHorizontal = (fromX: number, toX: number, y: number) => {
        for (let x = Math.min(fromX, toX); x <= Math.max(fromX, toX); x += 1) {
            for (let offset = -1; offset <= 1; offset += 1) carve(x, y + offset);
        }
    };
    const carveVertical = (fromY: number, toY: number, x: number) => {
        for (let y = Math.min(fromY, toY); y <= Math.max(fromY, toY); y += 1) {
            for (let offset = -1; offset <= 1; offset += 1) carve(x + offset, y);
        }
    };

    centers.forEach((center, index) => {
        const width = index === 0 || index === centers.length - 1
            ? 8
            : 6 + Math.floor(random() * 4);
        const height = index === 0 || index === centers.length - 1
            ? 9
            : 6 + Math.floor(random() * 4);
        carveRoom(center, width, height);
    });

    for (let index = 1; index < centers.length; index += 1) {
        const from = centers[index - 1];
        const to = centers[index];
        if (random() < 0.5) {
            carveHorizontal(from.x, to.x, from.y);
            carveVertical(from.y, to.y, to.x);
        } else {
            carveVertical(from.y, to.y, from.x);
            carveHorizontal(from.x, to.x, to.y);
        }
    }

    // Pequenas câmaras laterais tornam a forma menos linear sem quebrar o caminho principal.
    for (let index = 0; index < 3; index += 1) {
        const anchor = centers[1 + Math.floor(random() * (centers.length - 2))];
        const branch = {
            x: Math.max(4, Math.min(DUNGEON_WIDTH - 5, anchor.x + Math.floor(random() * 7) - 3)),
            y: Math.max(5, Math.min(DUNGEON_HEIGHT - 6, anchor.y + (random() < 0.5 ? -8 : 8)))
        };
        carveRoom(branch, 5 + Math.floor(random() * 4), 5 + Math.floor(random() * 3));
        carveVertical(anchor.y, branch.y, anchor.x);
        carveHorizontal(anchor.x, branch.x, branch.y);
    }

    const obstacleCandidates: Array<{ x: number; y: number }> = [];
    for (let y = 2; y < DUNGEON_HEIGHT - 2; y += 1) {
        for (let x = 2; x < DUNGEON_WIDTH - 2; x += 1) {
            let hasClearSurroundings = true;
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
                for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                    if (walls[(y + offsetY) * DUNGEON_WIDTH + x + offsetX]) {
                        hasClearSurroundings = false;
                    }
                }
            }
            if (
                hasClearSurroundings
                && Math.hypot(x - centers[0].x, y - centers[0].y) >= 5
                && Math.hypot(
                    x - centers[centers.length - 1].x,
                    y - centers[centers.length - 1].y
                ) >= 4
            ) obstacleCandidates.push({ x, y });
        }
    }
    for (let index = obstacleCandidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [obstacleCandidates[index], obstacleCandidates[swapIndex]] = [
            obstacleCandidates[swapIndex],
            obstacleCandidates[index]
        ];
    }
    // Um prop de três blocos pode fechar um corredor de três; a busca recusa esse caso.
    const blocked = walls.slice();
    const countReachableFloor = () => {
        const start = centers[0];
        const visited = new Set([start.y * DUNGEON_WIDTH + start.x]);
        const pending = [start];
        for (let index = 0; index < pending.length; index += 1) {
            const { x, y } = pending[index];
            for (const next of [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]) {
                const key = next.y * DUNGEON_WIDTH + next.x;
                if (blocked[key] || visited.has(key)) continue;
                visited.add(key);
                pending.push(next);
            }
        }
        return visited.size;
    };
    let reachableFloor = countReachableFloor();
    const obstacles: Array<{ x: number; y: number; variant: number }> = [];
    for (const candidate of obstacleCandidates) {
        if (obstacles.some((obstacle) =>
            Math.hypot(candidate.x - obstacle.x, candidate.y - obstacle.y) < 3)) continue;
        const obstacle = { ...candidate, variant: Math.floor(random() * 8) };
        const tiles = getDungeonObstacleTiles(obstacle).map(({ x, y }) => y * DUNGEON_WIDTH + x);
        for (const tile of tiles) blocked[tile] = true;
        const reachable = countReachableFloor();
        if (reachable !== reachableFloor - tiles.length) {
            for (const tile of tiles) blocked[tile] = false;
            continue;
        }
        reachableFloor = reachable;
        obstacles.push(obstacle);
        if (obstacles.length === DUNGEON_OBSTACLE_COUNT) break;
    }

    const spawn = {
        x: (centers[0].x + 0.5) * DUNGEON_TILE_SIZE,
        y: (centers[0].y + 0.5) * DUNGEON_TILE_SIZE
    };
    return {
        seed: normalizedSeed,
        width: DUNGEON_WIDTH,
        height: DUNGEON_HEIGHT,
        walls,
        spawn,
        obstacles,
        returnArea: {
            left: DUNGEON_TILE_SIZE,
            right: DUNGEON_TILE_SIZE * 2,
            top: (centers[0].y - 2) * DUNGEON_TILE_SIZE,
            bottom: (centers[0].y + 3) * DUNGEON_TILE_SIZE
        }
    };
}

export function isDungeonWall(layout: DungeonLayout, tileX: number, tileY: number) {
    if (tileX < 0 || tileX >= layout.width || tileY < 0 || tileY >= layout.height) return true;
    return layout.walls[tileY * layout.width + tileX];
}

/** Renderiza somente a primeira fileira de parede junto à área caminhável. */
export function isDungeonBoundaryWall(layout: DungeonLayout, tileX: number, tileY: number) {
    if (!isDungeonWall(layout, tileX, tileY)) return false;
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            if (!isDungeonWall(layout, tileX + offsetX, tileY + offsetY)) return true;
        }
    }
    return false;
}

function selectSimilarTile(
    indices: readonly number[],
    seed: number,
    tileX: number,
    tileY: number,
    salt: number
) {
    let value = seed ^ Math.imul(tileX + 1, 73856093) ^ Math.imul(tileY + 1, 19349663) ^ salt;
    value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
    value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
    return indices[((value ^ value >>> 16) >>> 0) % indices.length];
}

function isDungeonReturnOpening(layout: DungeonLayout, tileX: number, tileY: number) {
    const centerTileY = Math.floor(
        (layout.returnArea.top + layout.returnArea.bottom) / 2 / DUNGEON_TILE_SIZE
    );
    return tileX === 0 && Math.abs(tileY - centerTileY) <= 1;
}

/** Células ocupadas pelo prop completo; alguns objetos usam mais de um bloco. */
export function getDungeonObstacleTiles(
    obstacle: Readonly<{ x: number; y: number; variant: number }>
) {
    const frame = DUNGEON_PROP_FRAMES[obstacle.variant] ?? DUNGEON_PROP_FRAMES[0];
    const left = obstacle.x - Math.floor(frame.tilesWide / 2);
    const top = obstacle.y - Math.floor(frame.tilesHigh / 2);
    const tiles: Array<{ x: number; y: number }> = [];
    for (let offsetY = 0; offsetY < frame.tilesHigh; offsetY += 1) {
        for (let offsetX = 0; offsetX < frame.tilesWide; offsetX += 1) {
            tiles.push({ x: left + offsetX, y: top + offsetY });
        }
    }
    return tiles;
}

/** Materializa o layout procedural como tilemap para colisão, tiros e line-of-sight. */
export function createProceduralDungeon(scene: Scene, seed: number): Room {
    const layout = generateDungeonLayout(seed);
    createDungeonTexture(scene);
    createDungeonObstacleFrames(scene);
    const map = scene.make.tilemap({
        tileWidth: DUNGEON_TILE_SIZE,
        tileHeight: DUNGEON_TILE_SIZE,
        width: layout.width,
        height: layout.height
    });
    const tileset = map.addTilesetImage(
        DUNGEON_TEXTURE,
        DUNGEON_TEXTURE,
        DUNGEON_TILE_SIZE,
        DUNGEON_TILE_SIZE
    );
    if (!tileset) throw new Error('Não foi possível criar o tileset da dungeon.');

    const floorLayer = map.createBlankLayer('dungeon-floor', tileset, 0, 0);
    const wallLayer = map.createBlankLayer('dungeon-walls', tileset, 0, 0);
    const obstacleLayer = map.createBlankLayer('dungeon-obstacle-collision', tileset, 0, 0);
    if (!floorLayer || !wallLayer || !obstacleLayer) {
        throw new Error('Não foi possível criar as layers da dungeon.');
    }

    scene.add.rectangle(
        map.widthInPixels / 2,
        map.heightInPixels / 2,
        map.widthInPixels,
        map.heightInPixels,
        0x17131b
    ).setDepth(-1);

    for (let y = 0; y < layout.height; y += 1) {
        for (let x = 0; x < layout.width; x += 1) {
            const wall = isDungeonWall(layout, x, y);
            if (!wall) {
                floorLayer.putTileAt(selectSimilarTile(
                    DUNGEON_FLOOR_TILE_INDICES,
                    layout.seed,
                    x,
                    y,
                    0x27d4eb2d
                ), x, y);
            }
            if (isDungeonBoundaryWall(layout, x, y) && !isDungeonReturnOpening(layout, x, y)) {
                wallLayer.putTileAt(selectSimilarTile(
                    DUNGEON_WALL_TILE_INDICES,
                    layout.seed,
                    x,
                    y,
                    0x165667b1
                ), x, y);
            }
        }
    }
    floorLayer.setDepth(0);
    wallLayer.setDepth(2).setCollisionByExclusion([-1]);
    for (const obstacle of layout.obstacles) {
        const occupiedTiles = getDungeonObstacleTiles(obstacle);
        for (const tile of occupiedTiles) {
            obstacleLayer.putTileAt(DUNGEON_WALL_TILE_INDEX, tile.x, tile.y);
        }
        const left = Math.min(...occupiedTiles.map((tile) => tile.x));
        const right = Math.max(...occupiedTiles.map((tile) => tile.x));
        const top = Math.min(...occupiedTiles.map((tile) => tile.y));
        const bottom = Math.max(...occupiedTiles.map((tile) => tile.y));
        scene.add.image(
            (left + (right - left + 1) / 2) * DUNGEON_TILE_SIZE,
            (top + (bottom - top + 1) / 2) * DUNGEON_TILE_SIZE,
            DUNGEON_OBSTACLE_TEXTURE,
            `dungeon-obstacle-${obstacle.variant}`
        ).setDepth(8);
    }
    obstacleLayer.setDepth(1).setAlpha(0).setCollisionByExclusion([-1]);
    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    createDungeonEntrance(scene, layout);

    return {
        map,
        collisionLayers: [wallLayer, obstacleLayer],
        dungeon: layout,
        openExit: () => {}
    };
}

function createDungeonObstacleFrames(scene: Scene) {
    const texture = scene.textures.get(DUNGEON_OBSTACLE_TEXTURE);
    if (texture.has('dungeon-obstacle-0')) return;
    DUNGEON_PROP_FRAMES.forEach((frame, index) => {
        texture.add(
            `dungeon-obstacle-${index}`,
            0,
            frame.x,
            frame.y,
            frame.width,
            frame.height
        );
    });
}

function createDungeonEntrance(scene: Scene, layout: DungeonLayout) {
    const centerY = (layout.returnArea.top + layout.returnArea.bottom) / 2;
    // A parede já tem três blocos removidos; só a luz identifica o buraco.
    createLampLight(scene, layout.returnArea.left + 2, centerY, 5, 0.48).setScale(0.72);
}

function createDungeonTexture(scene: Scene) {
    if (scene.textures.exists(DUNGEON_TEXTURE)) return;
    const source = scene.textures.get(DUNGEON_SOURCE_TEXTURE).getSourceImage() as HTMLImageElement;
    const texture = scene.textures.createCanvas(
        DUNGEON_TEXTURE,
        DUNGEON_TILE_SOURCES.length * DUNGEON_TILE_SIZE,
        DUNGEON_TILE_SIZE
    );
    if (!texture) throw new Error('Não foi possível preparar o tileset Neo Zero da dungeon.');
    const context = texture.context;
    context.imageSmoothingEnabled = false;

    DUNGEON_TILE_SOURCES.forEach((tile, index) => {
        context.drawImage(
            source,
            tile.x,
            tile.y,
            DUNGEON_TILE_SIZE,
            DUNGEON_TILE_SIZE,
            index * DUNGEON_TILE_SIZE,
            0,
            DUNGEON_TILE_SIZE,
            DUNGEON_TILE_SIZE
        );
    });
    texture.refresh();
}
