import { SCORE_VERSION, type GameMode } from '../config/score';

type RuntimeConfig = Readonly<{ scoreApiUrl?: string; accessToken?: string }>;

export type LeaderboardEntry = Readonly<{
    rank: number;
    playerName: string;
    score: number;
    elapsedTimeMs: number;
    enemiesDefeated: number;
    completedAt: string;
    scoreVersion: number;
    mode: GameMode;
}>;

type VictoryPayload = Readonly<{
    mode: GameMode;
    scoreVersion: number;
    enemiesDefeated: number;
    hitsTaken: number;
    multiKills: readonly number[];
}>;

const getBaseUrl = () => {
    const configured = getRuntimeConfig()?.scoreApiUrl?.trim();
    return (configured || '/api').replace(/\/$/, '');
};

const getRuntimeConfig = () => (globalThis as typeof globalThis & {
    ESCAPE_FROM_FLORIPA_CONFIG?: RuntimeConfig;
}).ESCAPE_FROM_FLORIPA_CONFIG;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const accessToken = getRuntimeConfig()?.accessToken?.trim();
    const response = await fetch(`${getBaseUrl()}${path}`, {
        ...init,
        headers: {
            'content-type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            ...init?.headers
        }
    });
    if (!response.ok) throw new Error('Não foi possível comunicar com o placar.');
    return response.json() as Promise<T>;
}

export const scoreApi = {
    startRun(runId: string, mode: GameMode) {
        return request<{ runId: string; startedAt: string }>('/runs', {
            method: 'POST',
            body: JSON.stringify({ runId, mode, scoreVersion: SCORE_VERSION })
        });
    },

    finishVictory(runId: string, payload: VictoryPayload) {
        return request<{ score: number; elapsedTimeMs: number; rank?: number }>(
            `/runs/${encodeURIComponent(runId)}/victory`,
            { method: 'POST', body: JSON.stringify(payload) }
        );
    },

    discardRun(runId: string) {
        const accessToken = getRuntimeConfig()?.accessToken?.trim();
        return fetch(`${getBaseUrl()}/runs/${encodeURIComponent(runId)}`, {
            method: 'DELETE',
            headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined
        })
            .catch(() => undefined);
    },

    getLeaderboard(mode: GameMode = 'SINGLE_PLAYER') {
        const query = new URLSearchParams({ mode, scoreVersion: String(SCORE_VERSION) });
        return request<{ entries: LeaderboardEntry[] }>(`/leaderboard?${query}`).then(({ entries }) => entries);
    }
};
