/** Distâncias em pixels do mundo; intervalos e duração em milissegundos. */
export const COMBAT_CONFIG = {
    player: { maxHealth: 4, healthPerHeart: 2, range: 100, fireInterval: 600, damage: 20, projectileSpeed: 180, color: 0x5ce5f1 },
    drone: {
        maxHealth: 60,
        range: 200,
        fireInterval: 1100,
        damage: 1,
        projectileSpeed: 130,
        color: 0xff3030,
        deathShake: { duration: 100, intensity: 0.003 }
    },
    projectile: { width: 6, height: 3, cornerRadius: 1, scale: 0.85, lifetime: 2200 },
    rangeIndicator: { color: 0xff4d4d, fillAlpha: 0.06, strokeAlpha: 0.22, strokeWidth: 1 },
    waves: [10, 20],
    spawnDistanceFromPlayer: 120,
    // Pontos livres do mapa Sala I; nenhum fica na área inicial protegida.
    droneSpawns: [
        ...[112, 176, 240].flatMap((y) =>
            [128, 208, 288, 368, 448, 528, 608, 688].map((x) => ({ x, y, patrolLeft: x - 16, patrolRight: x + 16 }))
        ),
        ...[128, 192, 608, 688].map((x) => ({ x, y: 400, patrolLeft: x - 16, patrolRight: x + 16 })),
        ...[160, 208, 592, 656].map((x) => ({ x, y: 312, patrolLeft: x - 16, patrolRight: x + 16 }))
    ]
} as const;
