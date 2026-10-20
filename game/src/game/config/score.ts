export const SCORE_VERSION = 1;

export const SCORE_CONFIG = Object.freeze({
    victory: 1_000,
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
    })
});

export type GameMode = 'SINGLE_PLAYER' | 'MULTIPLAYER';
export type RunStatus = 'IDLE' | 'RUNNING' | 'WON' | 'LOST';
