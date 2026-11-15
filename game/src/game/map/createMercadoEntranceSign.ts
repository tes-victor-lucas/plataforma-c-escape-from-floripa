import type { Scene } from 'phaser';
import { MERCADO_ENTRANCE_SIGN } from '../config/mercado';
import { getActorDepth } from '../config/world';

export type SignDirection = 'left' | 'right' | 'up' | 'down';

export type WaySignConfig = Readonly<{
    x: number;
    y: number;
    text: string;
    arrowBob: number;
    direction?: SignDirection;
}>;

// A seta é desenhada apontando para a esquerda; o giro leva às outras direções.
const ARROW_ROTATION: Record<SignDirection, number> = { left: 0, up: Math.PI / 2, right: Math.PI, down: -Math.PI / 2 };
const ARROW_STEP: Record<SignDirection, { x: number; y: number }> = {
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 }
};

/** Placa de madeira fincada no chão com um texto e uma seta amarela que balança para chamar o olho. */
export function createWaySign(scene: Scene, { x, y, text, arrowBob, direction = 'left' }: WaySignConfig) {
    const depth = getActorDepth(y);
    const label = scene.add.text(0, 0, text, {
        fontFamily: 'PixelGamer, monospace',
        fontSize: '8px',
        color: '#fff2d6'
    // A câmera tem zoom: sem resolução maior, as letras pequenas perdem os traços.
    }).setOrigin(0.5).setResolution(4).setDepth(depth + 0.001);
    // A tábua cresce com o texto, e nunca fica menor que a da entrada do Mercado.
    const width = Math.max(44, Math.ceil(label.width) + 14);
    const board = { x: x - width / 2, y: y - 34, width, height: 18 };
    const sign = scene.add.graphics().setDepth(depth);
    // Poste e sombra no chão.
    sign.fillStyle(0x000000, 0.25).fillEllipse(x, y, 16, 4);
    sign.fillStyle(0x3a2a1e, 1).fillRect(x - 2, board.y + board.height, 4, y - board.y - board.height);
    // Tábua com borda escura e um friso claro em cima.
    sign.fillStyle(0x24180f, 1).fillRect(board.x - 1, board.y - 1, board.width + 2, board.height + 2);
    sign.fillStyle(0x8a5a32, 1).fillRect(board.x, board.y, board.width, board.height);
    sign.fillStyle(0xb07a46, 1).fillRect(board.x, board.y, board.width, 2);
    const isLeft = direction === 'left';
    label.setPosition(board.x + board.width / 2 + (isLeft ? 4 : -4), board.y + board.height / 2 + 1);
    // Seta para o lado na ponta da tábua daquele lado; para cima e para baixo, na ponta direita.
    const arrowX = isLeft ? board.x - 4 : board.x + board.width + 4;
    const arrow = scene.add.graphics().setDepth(depth + 0.002).setPosition(arrowX, board.y + board.height / 2)
        .setRotation(ARROW_ROTATION[direction]);
    arrow.fillStyle(0x24180f, 1).fillTriangle(-11, 0, 1, -8, 1, 8);
    arrow.fillStyle(0xffd75a, 1).fillTriangle(-9, 0, 0, -6, 0, 6).fillRect(0, -3, 6, 6);
    const step = ARROW_STEP[direction];
    scene.tweens.add({
        targets: arrow,
        x: arrow.x + step.x * arrowBob,
        y: arrow.y + step.y * arrowBob,
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    return { sign, arrow, label };
}

// Setinha parada dentro da tábua discreta: ponta para a direção pedida, em volta do centro.
const SMALL_ARROW: Record<SignDirection, readonly number[]> = {
    left: [-2, 0, 2, -3, 2, 3],
    right: [2, 0, -2, -3, -2, 3],
    up: [0, -2, -3, 2, 3, 2],
    down: [0, 2, -3, -2, 3, -2]
};

/**
 * Placa discreta para indicar caminhos: tábua baixa do tamanho do texto, poste curto e uma setinha parada
 * ao lado das letras, na mesma cor delas.
 */
export function createSmallWaySign(scene: Scene, { x, y, text, direction = 'left' }: Omit<WaySignConfig, 'arrowBob'>) {
    const depth = getActorDepth(y);
    const label = scene.add.text(0, 0, text, {
        fontFamily: 'PixelGamer, monospace',
        fontSize: '8px',
        color: '#e8d8b8'
    }).setOrigin(0.5).setResolution(4).setDepth(depth + 0.001);
    const arrowSpace = 8;
    const width = Math.ceil(label.width) + 8 + arrowSpace;
    const board = { x: x - width / 2, y: y - 20, width, height: 11 };
    const sign = scene.add.graphics().setDepth(depth);
    sign.fillStyle(0x000000, 0.2).fillEllipse(x, y, 10, 3);
    sign.fillStyle(0x3a2a1e, 1).fillRect(x - 1, board.y + board.height, 2, y - board.y - board.height);
    sign.fillStyle(0x24180f, 1).fillRect(board.x - 1, board.y - 1, board.width + 2, board.height + 2);
    sign.fillStyle(0x6e4a2a, 1).fillRect(board.x, board.y, board.width, board.height);
    label.setPosition(board.x + 4 + label.width / 2, board.y + board.height / 2 + 1);
    const [x1, y1, x2, y2, x3, y3] = SMALL_ARROW[direction];
    const ax = board.x + board.width - 4 - arrowSpace / 2 + 2;
    const ay = board.y + board.height / 2;
    sign.fillStyle(0xe8d8b8, 1).fillTriangle(ax + x1, ay + y1, ax + x2, ay + y2, ax + x3, ay + y3);
    return { sign, label };
}

/** Placa de madeira com a seta para o portal do Mercado Público. */
export function createMercadoEntranceSign(scene: Scene, config: WaySignConfig = MERCADO_ENTRANCE_SIGN) {
    return createWaySign(scene, config);
}
