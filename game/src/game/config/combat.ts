/** Distâncias em pixels do mundo; intervalos e duração em milissegundos. */
export const COMBAT_CONFIG = {
    player: { maxHealth: 100, range: 180, fireInterval: 450, damage: 20, projectileSpeed: 240, color: 0x5ce5f1 },
    drone: { maxHealth: 60, range: 200, fireInterval: 1100, damage: 10, projectileSpeed: 130, color: 0xff3030 },
    projectile: { width: 6, height: 3, cornerRadius: 1, scale: 0.85, lifetime: 2200 },
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
