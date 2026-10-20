import { SCORE_CONFIG } from '../config/score';

export type ScoreBreakdown = Readonly<{
    victoryPoints: number;
    timePoints: number;
    enemyPoints: number;
    multiKillPoints: number;
    damagePoints: number;
    total: number;
}>;

export type ScoreInput = Readonly<{
    won: boolean;
    completed?: boolean;
    elapsedTimeMs: number;
    enemiesDefeated: number;
    hitsTaken: number;
    multiKillBonuses: readonly number[];
}>;

export function calculateTimePoints(elapsedTimeMs: number) {
    const elapsedSeconds = Math.floor(Math.max(0, elapsedTimeMs) / 1_000);
    return Math.max(
        0,
        SCORE_CONFIG.time.maximumBonus - elapsedSeconds * SCORE_CONFIG.time.pointsLostPerSecond
    );
}

export function calculateDamagePoints(hitsTaken: number) {
    const hits = Math.max(0, Math.floor(hitsTaken));
    if (hits === 0) return SCORE_CONFIG.damage.noHits;
    if (hits === 1) return SCORE_CONFIG.damage.oneHit;
    if (hits === 2) return SCORE_CONFIG.damage.twoHits;
    return SCORE_CONFIG.damage.threeOrMoreHits;
}

export function calculateMultiKillBonus(killCount: number) {
    const kills = Math.max(0, Math.floor(killCount));
    if (kills < 2) return 0;
    return SCORE_CONFIG.multiKill.twoKills
        + (kills - 2) * SCORE_CONFIG.multiKill.eachKillAfterSecond;
}

export function calculateScore(input: ScoreInput): ScoreBreakdown {
    const completed = input.completed ?? true;
    const victoryPoints = completed && input.won ? SCORE_CONFIG.victory : 0;
    const timePoints = completed ? calculateTimePoints(input.elapsedTimeMs) : 0;
    const enemyPoints = Math.max(0, Math.floor(input.enemiesDefeated)) * SCORE_CONFIG.enemyKill;
    const multiKillPoints = input.multiKillBonuses.reduce(
        (total, bonus) => total + Math.max(0, Math.floor(bonus)),
        0
    );
    const damagePoints = completed ? calculateDamagePoints(input.hitsTaken) : 0;
    const total = Math.max(
        0,
        victoryPoints + timePoints + enemyPoints + multiKillPoints + damagePoints
    );
    return { victoryPoints, timePoints, enemyPoints, multiKillPoints, damagePoints, total };
}

export function formatElapsedTime(elapsedTimeMs: number) {
    const totalSeconds = Math.floor(Math.max(0, elapsedTimeMs) / 1_000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
