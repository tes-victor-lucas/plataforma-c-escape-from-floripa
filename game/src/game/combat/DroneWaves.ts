import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';

export type DroneSpawnPoint = {
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
};

type TileGrid = {
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;
};

/** Avança uma única vez por onda, preservando a vida do jogador. */
export class DroneWaves {
    private nextWave = 0;
    private completed = false;
    private waitingForIntermission = false;

    constructor(
        private readonly spawn: (count: number) => void,
        private readonly onComplete: () => void = () => {},
        private readonly playIntermission: (resume: () => void) => void = (resume) => resume(),
        private readonly waveCounts: readonly number[] = COMBAT_CONFIG.waves
    ) {}

    update(drones: ReadonlyArray<{ health: { isAlive: boolean } }>) {
        if (this.completed || this.waitingForIntermission || drones.some((drone) => drone.health.isAlive)) return;
        const count = this.waveCounts[this.nextWave];
        if (count === undefined) {
            this.completed = true;
            this.onComplete();
            return;
        }

        if (this.nextWave === 0) {
            this.spawn(count);
        } else {
            this.waitingForIntermission = true;
            this.playIntermission(() => {
                this.waitingForIntermission = false;
                this.spawn(count);
            });
        }
        this.nextWave += 1;
    }

    /** Ondas que ainda não começaram, para retomar a sala em outra visita. */
    pendingWaves() {
        return this.waveCounts.slice(this.nextWave);
    }
}

/** Distribui a onda fora do início protegido e longe da posição atual do jogador. */
export function selectDroneSpawns(
    count: number,
    playerPosition: { x: number; y: number },
    spawnPoints: readonly DroneSpawnPoint[] = COMBAT_CONFIG.droneSpawns
) {
    const { spawn, spawnSafeRadius } = WORLD_CONFIG.player;
    const candidates = spawnPoints.filter((point) => {
        // Inclui toda a patrulha e uma margem para o corpo do drone.
        const closestX = Math.max(point.patrolLeft, Math.min(spawn.x, point.patrolRight));
        return Math.hypot(closestX - spawn.x, point.y - spawn.y) >= spawnSafeRadius + 16
            && Math.hypot(point.x - playerPosition.x, point.y - playerPosition.y) >= COMBAT_CONFIG.spawnDistanceFromPlayer;
    });
    if (candidates.length < count) {
        throw new Error(`Não há posições seguras suficientes para criar ${count} drones.`);
    }
    return Array.from({ length: count }, (_, index) => candidates[Math.floor(index * candidates.length / count)]);
}

/** Reserva sentinelas em pontos narrativos e completa a onda com os pontos comuns. */
export function selectDroneSpawnsWithPriority(
    count: number,
    playerPosition: { x: number; y: number },
    prioritySpawns: readonly DroneSpawnPoint[],
    spawnPoints: readonly DroneSpawnPoint[] = COMBAT_CONFIG.droneSpawns
) {
    const priority = prioritySpawns.slice(0, count);
    const remainingCandidates = spawnPoints.filter((candidate) =>
        !priority.some((reserved) => reserved.x === candidate.x && reserved.y === candidate.y)
    );
    return [
        ...priority,
        ...selectDroneSpawns(count - priority.length, playerPosition, remainingCandidates)
    ];
}

/** Gera patrulhas apenas no componente navegável que contém o jogador. */
export function createReachableDroneSpawns(
    map: TileGrid,
    isBlocked: (tileX: number, tileY: number) => boolean,
    origin: { x: number; y: number },
    isWalkable: (tileX: number, tileY: number) => boolean = () => true
): DroneSpawnPoint[] {
    const reachableTiles = collectReachableTiles(map, isBlocked, isWalkable, origin);
    const { hitbox, scale } = WORLD_CONFIG.drone;
    const halfFrame = 16;
    const patrolRadius = map.tileWidth;
    const candidates: DroneSpawnPoint[] = [];

    for (let y = map.tileHeight * 2; y < map.height * map.tileHeight - map.tileHeight * 2; y += map.tileHeight) {
        for (let x = map.tileWidth * 2; x < map.width * map.tileWidth - map.tileWidth * 2; x += map.tileWidth) {
            const point = { x, y, patrolLeft: x - patrolRadius, patrolRight: x + patrolRadius };
            const left = Math.floor((point.patrolLeft + (hitbox.offsetX - halfFrame) * scale) / map.tileWidth);
            const right = Math.floor((point.patrolRight + (hitbox.offsetX + hitbox.width - halfFrame) * scale - 0.001) / map.tileWidth);
            const top = Math.floor((point.y + (hitbox.offsetY - halfFrame) * scale) / map.tileHeight);
            const bottom = Math.floor((point.y + (hitbox.offsetY + hitbox.height - halfFrame) * scale - 0.001) / map.tileHeight);

            if (isAreaReachable(map.width, reachableTiles, left, right, top, bottom)) {
                candidates.push(point);
            }
        }
    }
    return candidates;
}

function collectReachableTiles(
    map: TileGrid,
    isBlocked: (tileX: number, tileY: number) => boolean,
    isWalkable: (tileX: number, tileY: number) => boolean,
    origin: { x: number; y: number }
) {
    const originX = Math.floor(origin.x / map.tileWidth);
    const originY = Math.floor(origin.y / map.tileHeight);
    const reachable = new Set<number>();
    const pending: Array<[number, number]> = [];

    if (!isBlocked(originX, originY) && isWalkable(originX, originY)) {
        reachable.add(originY * map.width + originX);
        pending.push([originX, originY]);
    }

    for (let index = 0; index < pending.length; index += 1) {
        const [tileX, tileY] = pending[index];
        for (const [offsetX, offsetY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nextX = tileX + offsetX;
            const nextY = tileY + offsetY;
            const key = nextY * map.width + nextX;
            if (
                nextX < 0 || nextX >= map.width || nextY < 0 || nextY >= map.height
                || reachable.has(key) || isBlocked(nextX, nextY) || !isWalkable(nextX, nextY)
            ) continue;
            reachable.add(key);
            pending.push([nextX, nextY]);
        }
    }
    return reachable;
}

function isAreaReachable(
    mapWidth: number,
    reachableTiles: ReadonlySet<number>,
    left: number,
    right: number,
    top: number,
    bottom: number
) {
    for (let tileY = top; tileY <= bottom; tileY += 1) {
        for (let tileX = left; tileX <= right; tileX += 1) {
            if (!reachableTiles.has(tileY * mapWidth + tileX)) return false;
        }
    }
    return true;
}
