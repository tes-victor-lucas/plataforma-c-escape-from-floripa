export const WORLD_CONFIG = {
    mapKey: 'room1',
    player: {
        texture: 'player-walk',
        initialFrame: 120,
        scale: 0.7,
        spawn: { x: 400, y: 536 },
        spawnSafeRadius: 240,
        speed: 120,
        velocityResponsiveness: 14,
        stopThreshold: 2,
        directionThreshold: 0.15,
        hitbox: {
            width: 8,
            height: 5,
            offsetX: 15,
            offsetY: 32
        }
    },
    drone: {
        texture: 'drone-fly',
        scale: 0.72,
        speed: 40,
        chaseSpeed: 65,
        detectionRadius: 220,
        loseTargetRadius: 260,
        stopDistance: 64,
        hitbox: { width: 18, height: 21, offsetX: 6, offsetY: 8 }
    },
    camera: {
        // Mantém a mesma área vertical visível após a mudança para 16:9.
        zoom: 1.75,
        lerpX: 0.15,
        lerpY: 0.15
    }
} as const;
