import type { Scene } from 'phaser';

type Area = Readonly<{ left: number; right: number; top: number; bottom: number }>;

const LADDER_WIDTH = 12;
const LADDER_HEIGHT = 44;
const RUNG_GAP = 6;
const CLIMB_MS = 1_100;
const VANISH_MS = 260;

/** Topo e base da escada do bueiro, de pé na frente da saída do esconderijo. */
export function getSewerLadderSpan(area: Area) {
    const x = (area.left + area.right) / 2;
    const bottom = (area.top + area.bottom) / 2 + 14;
    return { x, top: bottom - LADDER_HEIGHT, bottom };
}

/** Escada de ferro até a tampa do bueiro, com a luz da rua caindo pela abertura. */
export function createSewerLadder(scene: Scene, area: Area) {
    const { x, top, bottom } = getSewerLadderSpan(area);
    const left = x - LADDER_WIDTH / 2;
    const graphics = scene.add.graphics().setDepth(3);
    // Facho da rua entrando pelo bueiro aberto.
    graphics.fillStyle(0xffd27a, 0.1).fillRect(left - 6, top - 10, LADDER_WIDTH + 12, LADDER_HEIGHT + 10);
    graphics.fillStyle(0xffd27a, 0.14).fillRect(left - 2, top - 10, LADDER_WIDTH + 4, LADDER_HEIGHT + 4);
    graphics.fillStyle(0x0b0a10, 1).fillRect(left - 3, top - 8, LADDER_WIDTH + 6, 5);
    // Trilhos e degraus enferrujados.
    graphics.fillStyle(0x2a2a33, 1).fillRect(left, top, 2, LADDER_HEIGHT).fillRect(left + LADDER_WIDTH - 2, top, 2, LADDER_HEIGHT);
    for (let y = top + 3; y < bottom; y += RUNG_GAP) {
        graphics.fillStyle(0x6b5a4a, 1).fillRect(left + 2, y, LADDER_WIDTH - 4, 2);
        graphics.fillStyle(0x9a7b5c, 1).fillRect(left + 2, y, LADDER_WIDTH - 4, 1);
    }
    return graphics;
}

/** Sobe a escada sem física: alinha na escada, sobe degrau a degrau e some pela tampa. */
export function climbSewerLadder(
    scene: Scene,
    sprite: Phaser.Physics.Arcade.Sprite,
    area: Area,
    onDone: () => void
) {
    const { x, top, bottom } = getSewerLadderSpan(area);
    if (sprite.body) sprite.body.enable = false;
    sprite.setDepth(4);
    // A origem do sprite fica no meio dele: os pés partem da base e a cabeça chega à tampa.
    sprite.setPosition(x, bottom - sprite.displayHeight / 2);
    scene.tweens.add({
        targets: sprite,
        y: top + sprite.displayHeight / 2 - 6,
        duration: CLIMB_MS,
        ease: 'Stepped',
        easeParams: [Math.round(LADDER_HEIGHT / RUNG_GAP)],
        onComplete: () => {
            scene.tweens.add({
                targets: sprite,
                alpha: 0,
                scaleX: sprite.scaleX * 0.8,
                scaleY: sprite.scaleY * 0.8,
                y: sprite.y - 6,
                duration: VANISH_MS,
                onComplete: onDone
            });
        }
    });
}
