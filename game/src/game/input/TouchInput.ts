export type TouchAction = 'dash' | 'interact';

/** Celular e tablet: o mesmo critério do CSS, para notebooks com tela de toque continuarem no teclado. */
export function isTouchScreen(
    matchMedia = typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window)
) {
    return matchMedia?.('(pointer: coarse)').matches ?? false;
}

/** Estado dos controles de toque, lido pelo Player e pelo World como se fosse o gamepad. */
export const touchInput = {
    x: 0,
    y: 0,
    pending: new Set<TouchAction>(),
    press(action: TouchAction) {
        this.pending.add(action);
    },
    /** Cada toque num botão dispara a ação uma vez só. */
    consume(action: TouchAction) {
        return this.pending.delete(action);
    },
    reset() {
        this.x = 0;
        this.y = 0;
        this.pending.clear();
    }
};

/** Direção unitária do joystick; arrastar menos de um quarto do raio não move. */
export function joystickDirection(dx: number, dy: number, radius: number) {
    const length = Math.hypot(dx, dy);
    if (length < radius / 4) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
}
