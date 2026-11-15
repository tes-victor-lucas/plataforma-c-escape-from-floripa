/**
 * Curva cúbica de Bézier como a do CSS, para as cenas usarem as mesmas curvas fortes da interface.
 * Acha o t de cada x por bisseção: x(t) só cresce quando x1 e x2 estão entre 0 e 1.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
    const sample = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return (x: number) => {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        let low = 0;
        let high = 1;
        for (let step = 0; step < 24; step += 1) {
            const t = (low + high) / 2;
            if (sample(x1, x2, t) < x) low = t;
            else high = t;
        }
        return sample(y1, y2, (low + high) / 2);
    };
}

/** Entrar e sair. */
export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
/** Mexer algo que já está na tela. */
export const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

/** Quem pediu menos movimento ao sistema vê as cenas sem deslizar, sem zoom e sem clarão. */
export function prefersReducedMotion(
    matchMedia = typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window)
) {
    return matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
