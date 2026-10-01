import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';

/** Avança uma única vez por onda, preservando a vida do jogador. */
export class DroneWaves {
    private nextWave = 0;
    private completed = false;
    private waitingForIntermission = false;

    constructor(
        private readonly spawn: (count: number) => void,
        private readonly onComplete: () => void = () => {},
        private readonly playIntermission: (resume: () => void) => void = (resume) => resume()
    ) {}

    update(drones: ReadonlyArray<{ health: { isAlive: boolean } }>) {
        if (this.completed || this.waitingForIntermission || drones.some((drone) => drone.health.isAlive)) return;
        const count = COMBAT_CONFIG.waves[this.nextWave];
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
}

/** Distribui a onda fora do início protegido e longe da posição atual do jogador. */
export function selectDroneSpawns(count: number, playerPosition: { x: number; y: number }) {
    const { spawn, spawnSafeRadius } = WORLD_CONFIG.player;
    const candidates = COMBAT_CONFIG.droneSpawns.filter((point) => {
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
