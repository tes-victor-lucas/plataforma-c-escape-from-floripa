import type { RoomKey } from './rooms';

export const ROOM2_STAIR_GUARD_SPAWNS = [
    { x: 176, y: 352, patrolLeft: 168, patrolRight: 184 },
    { x: 240, y: 352, patrolLeft: 232, patrolRight: 248 }
] as const;

export type EnemyKind = 'drone' | 'scooter' | 'bike' | 'guard' | 'gaucho';

/** Primeira horda da Sala II: quantos de cada tipo, além dos dois guardas da escada. */
export const ROOM2_FIRST_HORDE: Readonly<Partial<Record<EnemyKind, number>>> = {
    guard: 4,
    drone: 2,
    scooter: 2,
    gaucho: 2,
    bike: 5
};

/** Horda da Sala II depois da carta: quantos de cada tipo. */
export const ROOM2_SECOND_HORDE: Readonly<Record<EnemyKind, number>> = {
    gaucho: 46,
    guard: 22,
    scooter: 22,
    drone: 22,
    bike: 20
};

/** Horda da Sala III depois da carta: metade maior que a última da Sala II. */
export const ROOM3_SECOND_HORDE: Readonly<Record<EnemyKind, number>> = {
    gaucho: 69,
    guard: 33,
    scooter: 33,
    drone: 33,
    bike: 30
};

/** Horda da Sala IV, depois dos skatistas: a maior do jogo, metade maior que a última da Sala III. */
export const ROOM4_HORDE: Readonly<Record<EnemyKind, number>> = {
    gaucho: 104,
    guard: 50,
    scooter: 50,
    drone: 50,
    bike: 45
};

/** Espalha os tipos ao longo da onda, para não chegarem todos os drones juntos no fim. */
export function interleaveEnemyCounts(counts: Readonly<Partial<Record<EnemyKind, number>>>) {
    const entries = Object.entries(counts) as [EnemyKind, number][];
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const used = new Map<EnemyKind, number>();
    return Array.from({ length: total }, (_, index) => {
        // O tipo mais atrasado em relação à sua fatia entra agora.
        const [kind] = entries.reduce((best, entry) => {
            const lag = (index + 1) * entry[1] / total - (used.get(entry[0]) ?? 0);
            const bestLag = (index + 1) * best[1] / total - (used.get(best[0]) ?? 0);
            return lag > bestLag ? entry : best;
        });
        used.set(kind, (used.get(kind) ?? 0) + 1);
        return kind;
    });
}

// Os dois primeiros nascem nos pontos fixos da escada e precisam ser guardas.
const ROOM2_FIRST_HORDE_KINDS: readonly EnemyKind[] = ['guard', 'guard', ...interleaveEnemyCounts(ROOM2_FIRST_HORDE)];
const ROOM2_SECOND_HORDE_KINDS = interleaveEnemyCounts(ROOM2_SECOND_HORDE);
const ROOM3_SECOND_HORDE_KINDS = interleaveEnemyCounts(ROOM3_SECOND_HORDE);
const ROOM4_HORDE_KINDS = interleaveEnemyCounts(ROOM4_HORDE);

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
    // Bicicleta elétrica: como o patinete, mas investe uma vez atrás da outra, sem recuperação.
    // O aviso antes de cada investida continua, para o jogador ter como desviar.
    bike: {
        maxHealth: 3,
        contactDamage: 1,
        detectionRadius: 260,
        chargeRange: 170,
        chargeWindup: 380,
        chargeDuration: 450,
        chargeSpeed: 300,
        approachSpeed: 90,
        recoveryDuration: 0,
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
        room2: [ROOM2_FIRST_HORDE_KINDS.length, ROOM2_SECOND_HORDE_KINDS.length],
        // A Sala III já abre com a horda final da Sala II.
        room3: [ROOM2_SECOND_HORDE_KINDS.length, ROOM3_SECOND_HORDE_KINDS.length],
        // Uma onda só: a horda gigante que entra quando os skatistas somem.
        room4: [ROOM4_HORDE_KINDS.length],
        // Sem combate: só o corredor até o fliperama.
        'mercado-interior': [],
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
        ],
        room3: [
            { maxAlive: 28, batchSize: 6, interval: 800 },
            { maxAlive: 36, batchSize: 8, interval: 700 }
        ],
        room4: [{ maxAlive: 44, batchSize: 10, interval: 600 }]
    } as Partial<Record<RoomKey, readonly { maxAlive: number; batchSize: number; interval: number }[]>>,
    // A câmera mostra ~508×286 px do mapa (zoom 1,75): a horda nasce logo depois da borda
    // da tela, e os inimigos dela perseguem de qualquer distância.
    hordeSpawnMinDistance: 300,
    hordeSpawnMaxDistance: 380,
    // Quem ficou bem para trás, ou parado preso em algum canto, volta para fora da tela à frente.
    // `nearDistance` passa da distância em que o drone para e atira (64), para ele não contar como preso.
    hordeRecall: { interval: 2_000, distance: 480, stuckDistance: 12, nearDistance: 96 },
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
        ROOM2_FIRST_HORDE_KINDS,
        // Horda: a composição exata vem de ROOM2_SECOND_HORDE.
        ROOM2_SECOND_HORDE_KINDS
    ],
    room3: [ROOM2_SECOND_HORDE_KINDS, ROOM3_SECOND_HORDE_KINDS],
    room4: [ROOM4_HORDE_KINDS],
    'mercado-interior': [],
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
