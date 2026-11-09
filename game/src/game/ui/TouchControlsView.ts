import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { joystickDirection, touchInput, type TouchAction } from '../input/TouchInput';

const DEPTH = 120;
const STICK = { x: 96, y: GAME_HEIGHT - 96, radius: 52 };
const BUTTON_RADIUS = 39;
// Mesma paleta do botão de pausa (action-buttons.png).
const COLORS = {
    outline: 0x02040f,
    ring: 0x23c8ff,
    ringShadow: 0x0b46d8,
    fill: 0x050a24,
    pressed: 0x123a8c,
    icon: 0x5fd8ff
};
const BUTTONS: readonly { action: TouchAction; label: string; x: number; y: number }[] = [
    { action: 'dash', label: 'DASH', x: GAME_WIDTH - 72, y: GAME_HEIGHT - 135 },
    { action: 'interact', label: 'USAR', x: GAME_WIDTH - 172, y: GAME_HEIGHT - 66 }
];

/** Joystick na metade esquerda e botões à direita; só aparece em telas de toque. */
export class TouchControlsView {
    private swordIcon?: Phaser.GameObjects.Image;
    private useIcon?: Phaser.GameObjects.Graphics;

    constructor(private readonly scene: Scene) {}

    /** A espada só aparece no botão depois de coletada, nas salas onde ela ataca. */
    showSword(visible: boolean) {
        this.swordIcon?.setVisible(visible);
        this.useIcon?.setVisible(!visible);
    }

    create() {
        if (!this.scene.sys.game?.device?.input?.touch) return;
        const { scene } = this;
        touchInput.reset();
        scene.events.once('shutdown', () => touchInput.reset());

        const base = scene.add.graphics().setDepth(DEPTH);
        drawPixelDisc(base, STICK.x, STICK.y, STICK.radius, COLORS.ring, 0.5);
        drawPixelDisc(base, STICK.x, STICK.y, STICK.radius - 3, COLORS.fill, 0.55);
        const thumb = scene.add.graphics().setDepth(DEPTH + 1);
        drawPixelDisc(thumb, 0, 0, 21, COLORS.outline);
        drawPixelDisc(thumb, 0, 0, 18, COLORS.ring);
        drawPixelDisc(thumb, 0, 0, 15, COLORS.ringShadow);
        thumb.setPosition(STICK.x, STICK.y);

        let stickPointer: number | undefined;
        const moveStick = (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== stickPointer) return;
            const dx = pointer.x - STICK.x;
            const dy = pointer.y - STICK.y;
            const scale = Math.min(1, STICK.radius / (Math.hypot(dx, dy) || 1));
            thumb.setPosition(STICK.x + dx * scale, STICK.y + dy * scale);
            const direction = joystickDirection(dx, dy, STICK.radius);
            touchInput.x = direction.x;
            touchInput.y = direction.y;
        };
        const releaseStick = (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== stickPointer) return;
            stickPointer = undefined;
            thumb.setPosition(STICK.x, STICK.y);
            touchInput.x = 0;
            touchInput.y = 0;
        };
        scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (stickPointer !== undefined || pointer.x > GAME_WIDTH / 2) return;
            stickPointer = pointer.id;
            moveStick(pointer);
        });
        scene.input.on('pointermove', moveStick);
        scene.input.on('pointerup', releaseStick);
        scene.input.on('pointerupoutside', releaseStick);

        for (const { action, label, x, y } of BUTTONS) {
            const frame = scene.add.graphics().setDepth(DEPTH);
            const draw = (pressed: boolean) => {
                frame.clear();
                drawPixelDisc(frame, x, y, BUTTON_RADIUS, COLORS.outline);
                drawPixelDisc(frame, x, y, BUTTON_RADIUS - 3, COLORS.ring);
                drawPixelDisc(frame, x, y, BUTTON_RADIUS - 6, COLORS.ringShadow);
                drawPixelDisc(frame, x, y, BUTTON_RADIUS - 9, pressed ? COLORS.pressed : COLORS.fill);
            };
            draw(false);
            if (action === 'dash') drawDashIcon(scene.add.graphics().setDepth(DEPTH + 1), x, y);
            else {
                this.useIcon = scene.add.graphics().setDepth(DEPTH + 1);
                drawUseIcon(this.useIcon, x, y);
                this.swordIcon = scene.add.image(x, y, 'sword').setDepth(DEPTH + 1).setScale(2.6)
                    .setVisible(false);
            }
            scene.add.text(x, y - BUTTON_RADIUS - 10, label, {
                fontFamily: 'Pixeboy, monospace',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#02040f',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(DEPTH + 1).setResolution(2);
            scene.add.circle(x, y, BUTTON_RADIUS, 0x000000, 0).setDepth(DEPTH + 2)
                .setInteractive()
                .on('pointerdown', () => {
                    touchInput.press(action);
                    draw(true);
                })
                .on('pointerup', () => draw(false))
                .on('pointerout', () => draw(false));
        }
    }
}

/** Círculo em degraus de 3 px, para combinar com a pixel art. */
function drawPixelDisc(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha = 1) {
    const step = 3;
    graphics.fillStyle(color, alpha);
    for (let row = -radius; row < radius; row += step) {
        const middle = row + step / 2;
        const half = Math.floor(Math.sqrt(Math.max(0, radius * radius - middle * middle)) / step) * step;
        graphics.fillRect(x - half, y + row, half * 2, step);
    }
}

/** Duas setas ">" em pixels. */
function drawDashIcon(graphics: Phaser.GameObjects.Graphics, x: number, y: number) {
    graphics.fillStyle(COLORS.icon, 1);
    for (const offset of [-15, 1]) {
        for (let i = 0; i <= 4; i++) {
            graphics.fillRect(x + offset + i * 4, y - 18 + i * 4, 5, 5);
            graphics.fillRect(x + offset + i * 4, y + 13 - i * 4, 5, 5);
        }
    }
}

/** Exclamação em pixels: o sinal de "interagir" quando não há espada. */
function drawUseIcon(graphics: Phaser.GameObjects.Graphics, x: number, y: number) {
    graphics.fillStyle(COLORS.icon, 1);
    graphics.fillRect(x - 4, y - 18, 8, 22);
    graphics.fillRect(x - 4, y + 9, 8, 8);
}
