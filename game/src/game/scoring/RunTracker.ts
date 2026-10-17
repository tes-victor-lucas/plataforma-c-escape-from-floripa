import { SCORE_VERSION, type GameMode, type RunStatus } from '../config/score';
import { calculateMultiKillBonus, calculateScore, type ScoreBreakdown } from './ScoreCalculator';
import { scoreApi } from './ScoreApi';

export type MultiKill = Readonly<{
    projectileId: string;
    enemies: number;
    bonus: number;
}>;

export type RunSnapshot = Readonly<{
    runId?: string;
    startedAt?: string;
    endedAt?: string;
    elapsedTimeMs: number;
    enemiesDefeated: number;
    hitsTaken: number;
    multiKills: readonly MultiKill[];
    accumulatedBonuses: number;
    score: ScoreBreakdown;
    scoreVersion: number;
    mode: GameMode;
    status: RunStatus;
}>;

export type RunCheckpoint = Readonly<{
    runId: string;
    startedAt: string;
    enemiesDefeated: number;
    hitsTaken: number;
    multiKills: readonly MultiKill[];
    defeatedEnemyIds: readonly string[];
    scoreVersion: number;
    mode: GameMode;
    status: 'RUNNING';
}>;

type Listener = (snapshot: RunSnapshot, event?: RunTrackerEvent) => void;
export type RunTrackerEvent = Readonly<{
    type: 'MULTI_KILL';
    enemies: number;
    bonus: number;
}>;

function createRunId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Fonte única das estatísticas e da pontuação da run ativa. */
export class RunTracker {
    private runId?: string;
    private startedAt?: string;
    private endedAt?: string;
    private enemiesDefeated = 0;
    private hitsTaken = 0;
    private multiKills: MultiKill[] = [];
    private defeatedEnemyIds = new Set<string>();
    private projectileKills = new Map<string, Set<string>>();
    private finalizedProjectileIds = new Set<string>();
    private status: RunStatus = 'IDLE';
    private mode: GameMode = 'SINGLE_PLAYER';
    private listeners = new Set<Listener>();
    private startRequest?: Promise<unknown>;

    startNew(mode: GameMode = 'SINGLE_PLAYER', now = new Date()) {
        if (this.status === 'RUNNING' && this.runId) {
            this.discardAfterStart(this.runId, this.startRequest);
        }
        this.resetTransientState();
        this.runId = createRunId();
        this.startedAt = now.toISOString();
        this.status = 'RUNNING';
        this.mode = mode;
        this.startRequest = scoreApi.startRun(this.runId, mode)
            .then((response) => {
                if (this.runId === response.runId && this.status === 'RUNNING') {
                    this.startedAt = response.startedAt;
                    this.emit();
                }
            })
            .catch(() => undefined);
        this.emit();
        return this.snapshot();
    }

    restore(checkpoint: RunCheckpoint) {
        this.resetTransientState();
        this.runId = checkpoint.runId;
        this.startedAt = checkpoint.startedAt;
        this.enemiesDefeated = checkpoint.enemiesDefeated;
        this.hitsTaken = checkpoint.hitsTaken;
        this.multiKills = checkpoint.multiKills.map((multiKill) => ({ ...multiKill }));
        this.defeatedEnemyIds = new Set(checkpoint.defeatedEnemyIds);
        this.mode = checkpoint.mode;
        this.status = 'RUNNING';
        this.emit();
    }

    ensureRunning(mode: GameMode = 'SINGLE_PLAYER') {
        if (this.status !== 'RUNNING') this.startNew(mode);
    }

    registerProjectile(projectileId: string) {
        if (this.status !== 'RUNNING' || this.finalizedProjectileIds.has(projectileId)) return;
        if (!this.projectileKills.has(projectileId)) this.projectileKills.set(projectileId, new Set());
    }

    recordEnemyDeath(enemyId: string, projectileId: string) {
        if (this.status !== 'RUNNING' || this.defeatedEnemyIds.has(enemyId)) return false;
        if (this.finalizedProjectileIds.has(projectileId)) return false;
        this.registerProjectile(projectileId);
        this.defeatedEnemyIds.add(enemyId);
        this.projectileKills.get(projectileId)?.add(enemyId);
        this.enemiesDefeated += 1;
        this.emit();
        return true;
    }

    finalizeProjectile(projectileId: string) {
        if (this.finalizedProjectileIds.has(projectileId)) return 0;
        this.finalizedProjectileIds.add(projectileId);
        const enemies = this.projectileKills.get(projectileId)?.size ?? 0;
        this.projectileKills.delete(projectileId);
        const bonus = calculateMultiKillBonus(enemies);
        if (bonus > 0) {
            this.multiKills.push({ projectileId, enemies, bonus });
            this.emit({ type: 'MULTI_KILL', enemies, bonus });
        }
        return bonus;
    }

    recordPlayerHit(actualHealthLost: number) {
        if (this.status !== 'RUNNING' || actualHealthLost <= 0) return false;
        this.hitsTaken += 1;
        this.emit();
        return true;
    }

    async win(now = new Date()) {
        if (this.status !== 'RUNNING') return this.snapshot();
        this.finalizeOutstandingProjectiles();
        this.endedAt = now.toISOString();
        this.status = 'WON';
        this.emit();
        await this.startRequest;
        if (this.runId) {
            void scoreApi.finishVictory(this.runId, {
                mode: this.mode,
                scoreVersion: SCORE_VERSION,
                enemiesDefeated: this.enemiesDefeated,
                hitsTaken: this.hitsTaken,
                multiKills: this.multiKills.map(({ enemies }) => enemies)
            }).catch(() => undefined);
        }
        return this.snapshot();
    }

    lose(now = new Date()) {
        if (this.status !== 'RUNNING') return this.snapshot();
        this.finalizeOutstandingProjectiles();
        this.endedAt = now.toISOString();
        this.status = 'LOST';
        if (this.runId) this.discardAfterStart(this.runId, this.startRequest);
        this.emit();
        return this.snapshot();
    }

    abandon() {
        if (this.status === 'RUNNING' && this.runId) {
            this.discardAfterStart(this.runId, this.startRequest);
        }
        this.resetTransientState();
        this.emit();
    }

    checkpoint(): RunCheckpoint | undefined {
        if (this.status !== 'RUNNING' || !this.runId || !this.startedAt) return undefined;
        return {
            runId: this.runId,
            startedAt: this.startedAt,
            enemiesDefeated: this.enemiesDefeated,
            hitsTaken: this.hitsTaken,
            multiKills: this.multiKills.map((multiKill) => ({ ...multiKill })),
            defeatedEnemyIds: [...this.defeatedEnemyIds],
            scoreVersion: SCORE_VERSION,
            mode: this.mode,
            status: 'RUNNING'
        };
    }

    snapshot(now = Date.now()): RunSnapshot {
        const end = this.endedAt ? Date.parse(this.endedAt) : now;
        const start = this.startedAt ? Date.parse(this.startedAt) : end;
        const elapsedTimeMs = Math.max(0, end - start);
        const score = calculateScore({
            won: this.status === 'WON',
            completed: this.status === 'WON' || this.status === 'LOST',
            elapsedTimeMs,
            enemiesDefeated: this.enemiesDefeated,
            hitsTaken: this.hitsTaken,
            multiKillBonuses: this.multiKills.map(({ bonus }) => bonus)
        });
        return {
            runId: this.runId,
            startedAt: this.startedAt,
            endedAt: this.endedAt,
            elapsedTimeMs,
            enemiesDefeated: this.enemiesDefeated,
            hitsTaken: this.hitsTaken,
            multiKills: this.multiKills.map((multiKill) => ({ ...multiKill })),
            accumulatedBonuses: score.total - score.enemyPoints,
            score,
            scoreVersion: SCORE_VERSION,
            mode: this.mode,
            status: this.status
        };
    }

    subscribe(listener: Listener) {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    private finalizeOutstandingProjectiles() {
        for (const projectileId of [...this.projectileKills.keys()]) this.finalizeProjectile(projectileId);
    }

    private emit(event?: RunTrackerEvent) {
        const snapshot = this.snapshot();
        for (const listener of this.listeners) listener(snapshot, event);
    }

    private discardAfterStart(runId: string, startRequest?: Promise<unknown>) {
        if (startRequest) {
            void startRequest.then(() => scoreApi.discardRun(runId));
        } else {
            void scoreApi.discardRun(runId);
        }
    }

    private resetTransientState() {
        this.runId = undefined;
        this.startedAt = undefined;
        this.endedAt = undefined;
        this.enemiesDefeated = 0;
        this.hitsTaken = 0;
        this.multiKills = [];
        this.defeatedEnemyIds.clear();
        this.projectileKills.clear();
        this.finalizedProjectileIds.clear();
        this.status = 'IDLE';
        this.mode = 'SINGLE_PLAYER';
        this.startRequest = undefined;
    }
}

export const runTracker = new RunTracker();
