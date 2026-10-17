import type { RoomKey } from '../config/rooms';
import type { PlayerProgress } from './PlayerProgress';
import { SCORE_VERSION } from '../config/score';
import type { RunCheckpoint } from '../scoring/RunTracker';

const STORAGE_KEY = 'escape-from-floripa:campaign-progress:v1';

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type CampaignProgress = Readonly<{
    roomKey: RoomKey;
    playerProgress: PlayerProgress;
    run?: RunCheckpoint;
}>;

function getBrowserStorage(): ProgressStorage | undefined {
    if (typeof window === 'undefined') return undefined;
    try {
        return window.localStorage;
    } catch {
        return undefined;
    }
}

function isPlayerProgress(value: unknown): value is PlayerProgress {
    if (!value || typeof value !== 'object') return false;
    const progress = value as Partial<PlayerProgress>;
    return typeof progress.currentHealth === 'number'
        && typeof progress.maxHealth === 'number'
        && typeof progress.movementSpeedMultiplier === 'number'
        && Array.isArray(progress.upgrades);
}

function isRunCheckpoint(value: unknown): value is RunCheckpoint {
    if (!value || typeof value !== 'object') return false;
    const run = value as Partial<RunCheckpoint>;
    return typeof run.runId === 'string'
        && typeof run.startedAt === 'string'
        && typeof run.enemiesDefeated === 'number'
        && typeof run.hitsTaken === 'number'
        && Array.isArray(run.multiKills)
        && Array.isArray(run.defeatedEnemyIds)
        && run.scoreVersion === SCORE_VERSION
        && (run.mode === 'SINGLE_PLAYER' || run.mode === 'MULTIPLAYER')
        && run.status === 'RUNNING';
}

/** Retorna somente checkpoints conquistados depois da Room 1. */
export function loadCampaignProgress(
    storage: ProgressStorage | undefined = getBrowserStorage()
): CampaignProgress | undefined {
    if (!storage) return undefined;
    try {
        const serialized = storage.getItem(STORAGE_KEY);
        if (!serialized) return undefined;
        const progress = JSON.parse(serialized) as Partial<CampaignProgress>;
        if (progress.roomKey !== 'room2' || !isPlayerProgress(progress.playerProgress)) {
            return undefined;
        }
        if (progress.run !== undefined && !isRunCheckpoint(progress.run)) return undefined;
        return progress as CampaignProgress;
    } catch {
        return undefined;
    }
}

export function saveCampaignProgress(
    progress: CampaignProgress,
    storage: ProgressStorage | undefined = getBrowserStorage()
) {
    if (!storage || progress.roomKey === 'room1') return;
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function clearCampaignProgress(
    storage: ProgressStorage | undefined = getBrowserStorage()
) {
    storage?.removeItem(STORAGE_KEY);
}
