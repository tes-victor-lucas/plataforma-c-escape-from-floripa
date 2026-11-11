import { MERCADO_INTERIOR } from '../config/mercado';

type ArcadeState = Readonly<{ arcadeAttempts: number; arcadeWon: boolean }>;

/** Tentativas que ainda restam no fliperama: nenhuma depois de vencer. */
export function arcadeAttemptsLeft(state: ArcadeState) {
    return state.arcadeWon ? 0 : Math.max(0, MERCADO_INTERIOR.arcade.maxAttempts - state.arcadeAttempts);
}

/** Abre o minijogo ao chegar no fliperama, se sobrou tentativa e o jogador se afastou desde a última. */
export function canStartArcade(state: ArcadeState, isArmed: boolean) {
    return isArmed && arcadeAttemptsLeft(state) > 0;
}
