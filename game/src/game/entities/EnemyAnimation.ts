export type EnemyDirection = 'down' | 'left' | 'right' | 'up';

const DIRECTION_ROWS: Record<EnemyDirection, number> = {
    down: 0,
    left: 1,
    right: 2,
    up: 3
};

export function enemyFrame(direction: EnemyDirection, column: number) {
    return DIRECTION_ROWS[direction] * 8 + column;
}

export function enemyWalkFrames(direction: EnemyDirection) {
    const first = enemyFrame(direction, 0);
    return [first, first + 1, first + 2, first + 3];
}

export function directionFromVector(
    x: number,
    y: number,
    fallback: EnemyDirection = 'down'
): EnemyDirection {
    if (Math.abs(x) < 0.001 && Math.abs(y) < 0.001) return fallback;
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
}

export function directionVector(direction: EnemyDirection) {
    switch (direction) {
        case 'down': return { x: 0, y: 1 };
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
        case 'up': return { x: 0, y: -1 };
    }
}
