import type { RoomKey } from './rooms';

export const ROOM2_STAIR_GUARD_SPAWNS = [
    { x: 176, y: 352, patrolLeft: 168, patrolRight: 184 },
    { x: 240, y: 352, patrolLeft: 232, patrolRight: 248 }
] as const;

export type EnemyKind = 'drone' | 'scooter' | 'guard' | 'gaucho';

/** Distâncias em pixels do mundo; intervalos e duração em milissegundos. */
const PLAYER_COMBAT_STATS = {
    maxHealth: 4,
    range: 100,
    fireInterval: 600,
    damage: 2,
    projectileSpeed: 180
} as const;

export const COMBAT_CONFIG = {
    player: { ...PLAYER_COMBAT_STATS, healthPerHeart: 2, color: 0x5ce5f1 },
    drone: {
        ...PLAYER_COMBAT_STATS,
        damage: PLAYER_COMBAT_STATS.damage / 2,
        color: 0xff3030,
        deathShake: { duration: 100, intensity: 0.003 }
    },
    scooter: {
        maxHealth: 3,
        contactDamage: 1,
        detectionRadius: 230,
        chargeRange: 150,
        chargeWindup: 520,
        chargeDuration: 430,
        chargeSpeed: 260,
        approachSpeed: 78,
        recoveryDuration: 680,
        impactDistance: 24
    },
    guard: {
        maxHealth: 6,
        meleeDamage: 2,
        detectionRadius: 210,
        movementSpeed: 38,
        stopDistance: 28,
        meleeRange: 34,
        attackWindup: 520,
        attackRecovery: 360,
        attackCooldown: 1_150,
        shieldDamageMultiplier: 0.25,
        shieldArcDot: -0.55
    },
    // Espada do esconderijo dos gaúchos: arco de 120° para onde o personagem olha.
    // damageMultiplier sobre o dano do tiro (com cartas): 1,5 derruba um gaúcho em 2 golpes.
    melee: {
        range: 44,
        arc: Math.PI * 2 / 3,
        interval: 450,
        swingDuration: 140,
        damageMultiplier: 1.5,
        // Clique dado nesse final da recarga fica guardado e sai assim que ela termina.
        bufferWindow: 150
    },
    gaucho: {
        maxHealth: PLAYER_COMBAT_STATS.maxHealth,
        range: 20,
        attackInterval: 900,
        damage: 1,
        strikeShake: { duration: 90, intensity: 0.004 }
    },
    projectile: { width: 6, height: 3, cornerRadius: 1, scale: 0.85, lifetime: 2200 },
    rangeIndicator: { color: 0xff4d4d, fillAlpha: 0.06, strokeAlpha: 0.22, strokeWidth: 1 },
    waves: [10, 8],
    wavesByRoom: {
        room1: [10, 8],
        // A segunda onda vem depois da carta e é bem maior: a horda cresce.
        room2: [12, 72],
        dungeon: [10],
        'gaucho-dungeon': [10]
    },
    /**
     * Horda contínua: em vez de nascer tudo de uma vez, a onda chega em lotes até a meta,
     * sem passar de `maxAlive` vivos. Uma entrada por onda; salas sem entrada nascem de uma vez.
     */
    hordeByRoom: {
        room2: [
            { maxAlive: 10, batchSize: 4, interval: 1_000 },
            { maxAlive: 28, batchSize: 6, interval: 800 }
        ]
    } as Partial<Record<RoomKey, readonly { maxAlive: number; batchSize: number; interval: number }[]>>,
    // A câmera mostra ~508×286 px do mapa (zoom 1,75): a horda nasce logo depois da borda
    // da tela, e os inimigos dela perseguem de qualquer distância.
    hordeSpawnMinDistance: 300,
    hordeSpawnMaxDistance: 380,
    // Quem ficou bem para trás volta para fora da tela à frente, senão a onda nunca termina.
    hordeRecall: { interval: 2_000, distance: 480 },
    multiplayer: {
        // Dois jogadores causam o dobro de dano nos mesmos inimigos; acima de 2 fica mais difícil.
        enemyHealthMultiplier: 2.5,
        reviveDuration: 5_000,
        reviveRadius: 28,
        reviveHealthRatio: 0.5,
        maxRevives: 2
    },
    spawnDistanceFromPlayer: 180,
    // Pontos livres do mapa Sala I; nenhum fica na área inicial protegida.
    droneSpawns: [
        ...[112, 176, 240].flatMap((y) =>
            [128, 208, 288, 368, 448, 528, 608, 688].map((x) => ({ x, y, patrolLeft: x - 16, patrolRight: x + 16 }))
        ),
        ...[128, 192, 608, 688].map((x) => ({ x, y: 400, patrolLeft: x - 16, patrolRight: x + 16 })),
        ...[160, 208, 592, 656].map((x) => ({ x, y: 312, patrolLeft: x - 16, patrolRight: x + 16 }))
    ]
} as const;

const WAVE_PATTERNS: Record<RoomKey, readonly (readonly EnemyKind[])[]> = {
    room1: [
        ['drone'],
        ['drone', 'scooter', 'drone', 'guard', 'drone', 'scooter', 'drone', 'drone', 'scooter', 'guard']
    ],
    room2: [
        // Um a cada cinco inimigos da Sala II é um gaúcho.
        ['guard', 'guard', 'drone', 'scooter', 'gaucho'],
        // Horda: maioria corpo a corpo, poucos drones atirando.
        ['gaucho', 'guard', 'scooter', 'gaucho', 'drone', 'gaucho']
    ],
    dungeon: [
        ['scooter', 'drone', 'guard', 'drone', 'scooter']
    ],
    'gaucho-dungeon': [
        ['gaucho']
    ]
};

/** Composição determinística: mantém a quantidade da onda e mistura papéis. */
export function getWaveEnemyKinds(
    roomKey: RoomKey,
    waveIndex: number,
    count: number,
    // Lotes da mesma onda continuam o padrão de onde o anterior parou.
    offset = 0
) {
    const roomPatterns = WAVE_PATTERNS[roomKey];
    const pattern = roomPatterns[Math.min(Math.max(0, waveIndex), roomPatterns.length - 1)];
    return Array.from({ length: count }, (_, index) => pattern[(offset + index) % pattern.length]);
}
