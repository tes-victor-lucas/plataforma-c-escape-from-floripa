export const WORLD_CONFIG = {
    mapKey: 'room1',
    player: {
        x: 104,
        y: 88,
        texture: 'player-walk',
        initialFrame: 120,
        scale: 0.7,
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
        x: 136,
        y: 88,
        texture: 'drone-fly',
        scale: 1,
        speed: 40,
        patrolLeft: 112,
        patrolRight: 176
    },
    camera: {
        zoom: 2.25,
        lerpX: 0.15,
        lerpY: 0.15
    }
} as const;
