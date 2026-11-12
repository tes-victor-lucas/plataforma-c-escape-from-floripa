export const SCORE_VERSION = 4;

export const SCORE_CONFIG = Object.freeze({
    victory: 1_000,
    dungeonCompletion: 1_000,
    enemyKill: 100,
    time: Object.freeze({
        maximumBonus: 6_000,
        pointsLostPerSecond: 10
    }),
    damage: Object.freeze({
        noHits: 2_000,
        oneHit: 1_200,
        twoHits: 600,
        threeOrMoreHits: 0
    }),
    multiKill: Object.freeze({
        twoKills: 250,
        eachKillAfterSecond: 100
    }),
    // Fliperama do Mercado Público: o relógio para enquanto se joga, com teto igual ao do servidor.
    arcade: Object.freeze({
        winBonus: 5_000,
        maxPausedMs: 360_000
    }),
    // Pegar os 14 topázios que o golem derruba no TICEN (Sala V).
    topazBonus: 2_000
});

export type GameMode = 'SINGLE_PLAYER' | 'MULTIPLAYER';
export type RunStatus = 'IDLE' | 'RUNNING' | 'WON' | 'LOST';
