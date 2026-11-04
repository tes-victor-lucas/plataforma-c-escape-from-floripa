export const WORLD_CONFIG = {
    mapKey: 'room1',
    player: {
        texture: 'player-walk',
        initialFrame: 120,
        scale: 0.7,
        spawn: { x: 400, y: 536 },
        spawnSafeRadius: 240,
        speed: 120,
        // Teto somado de chimarrões e gin tropical, para não desbalancear a fuga.
        maxSpeedMultiplier: 1.4,
        velocityResponsiveness: 14,
        stopThreshold: 2,
        directionThreshold: 0.15,
        dash: {
            speed: 360,
            duration: 130,
            cooldown: 700,
            alpha: 0.68
        },
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
    scooter: {
        texture: 'scooter-drive',
        scale: 0.9,
        hitbox: { width: 18, height: 13, offsetX: 7, offsetY: 13 }
    },
    guard: {
        texture: 'cyber-guard-walk',
        scale: 0.92,
        hitbox: { width: 18, height: 16, offsetX: 7, offsetY: 14 }
    },
    camera: {
        // Mantém a mesma área vertical visível após a mudança para 16:9.
        zoom: 1.75,
        lerpX: 0.15,
        lerpY: 0.15
    },
    feedback: {
        hitStopDuration: 45,
        enemyHitFlashDuration: 90,
        enemyKnockbackDuration: 85,
        enemyKnockbackSpeed: 130,
        lowHealth: {
            threshold: 0.4,
            maxDesaturation: 0.45
        }
    }
} as const;

/** Ordena jogadores e gaúchos pelos pés: quem está mais abaixo é desenhado na frente. */
export function getActorDepth(feetY: number) {
    // Fica entre 10 e 11, abaixo das grades (18) e dos telhados (20) da Room 2.
    return 10 + feetY / 10_000;
}
