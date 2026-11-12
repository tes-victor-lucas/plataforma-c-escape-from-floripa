import type { Scene } from 'phaser';
import { MERCADO_ENTRANCE_SIGN } from '../config/mercado';
import { getActorDepth } from '../config/world';

/** Placa de madeira com a seta para o portal do Mercado Público; a seta balança para chamar o olho. */
export function createMercadoEntranceSign(scene: Scene, config = MERCADO_ENTRANCE_SIGN) {
    const { x, y, text, arrowBob } = config;
    const depth = getActorDepth(y);
    const board = { x: x - 22, y: y - 34, width: 44, height: 18 };
    const sign = scene.add.graphics().setDepth(depth);
    // Poste e sombra no chão.
    sign.fillStyle(0x000000, 0.25).fillEllipse(x, y, 16, 4);
    sign.fillStyle(0x3a2a1e, 1).fillRect(x - 2, board.y + board.height, 4, y - board.y - board.height);
    // Tábua com borda escura e um friso claro em cima.
    sign.fillStyle(0x24180f, 1).fillRect(board.x - 1, board.y - 1, board.width + 2, board.height + 2);
    sign.fillStyle(0x8a5a32, 1).fillRect(board.x, board.y, board.width, board.height);
    sign.fillStyle(0xb07a46, 1).fillRect(board.x, board.y, board.width, 2);
    scene.add.text(board.x + board.width / 2 + 4, board.y + board.height / 2 + 1, text, {
        fontFamily: 'PixelGamer, monospace',
        fontSize: '8px',
        color: '#fff2d6'
    // A câmera tem zoom: sem resolução maior, as letras pequenas perdem os traços.
    }).setOrigin(0.5).setResolution(4).setDepth(depth + 0.001);
    // Seta amarela à esquerda da tábua, apontando para o portal.
    const arrow = scene.add.graphics().setDepth(depth + 0.002).setPosition(board.x - 4, board.y + board.height / 2);
    arrow.fillStyle(0x24180f, 1).fillTriangle(-11, 0, 1, -8, 1, 8);
    arrow.fillStyle(0xffd75a, 1).fillTriangle(-9, 0, 0, -6, 0, 6).fillRect(0, -3, 6, 6);
    scene.tweens.add({ targets: arrow, x: arrow.x - arrowBob, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return { sign, arrow };
}
