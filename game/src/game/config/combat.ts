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
        room2: [10],
        dungeon: [10],
        'gaucho-dungeon': [10]
    },
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
        ['guard', 'guard', 'drone', 'scooter', 'drone'],
        ['drone', 'scooter', 'guard', 'drone', 'scooter']
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
    count: number
) {
    const roomPatterns = WAVE_PATTERNS[roomKey];
    const pattern = roomPatterns[Math.min(Math.max(0, waveIndex), roomPatterns.length - 1)];
    return Array.from({ length: count }, (_, index) => pattern[index % pattern.length]);
}
