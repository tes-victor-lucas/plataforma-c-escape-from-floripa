import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { joystickDirection, touchInput, type TouchAction } from '../input/TouchInput';

const DEPTH = 120;
const STICK = { x: 96, y: GAME_HEIGHT - 96, radius: 52 };
const BUTTON_RADIUS = 34;
const BUTTONS: readonly { action: TouchAction; label: string; x: number; y: number }[] = [
    { action: 'dash', label: 'DASH', x: GAME_WIDTH - 70, y: GAME_HEIGHT - 110 },
    { action: 'interact', label: 'USAR', x: GAME_WIDTH - 160, y: GAME_HEIGHT - 60 }
];

/** Joystick na metade esquerda e botões à direita; só aparece em telas de toque. */
export class TouchControlsView {
    constructor(private readonly scene: Scene) {}

    create() {
        if (!this.scene.sys.game?.device?.input?.touch) return;
        const { scene } = this;
        touchInput.reset();
        scene.events.once('shutdown', () => touchInput.reset());

        scene.add.circle(STICK.x, STICK.y, STICK.radius, 0xffffff, 0.12)
            .setStrokeStyle(2, 0xffffff, 0.35).setDepth(DEPTH);
        const thumb = scene.add.circle(STICK.x, STICK.y, STICK.radius / 2.4, 0xffffff, 0.4)
            .setDepth(DEPTH + 1);

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
            const button = scene.add.circle(x, y, BUTTON_RADIUS, 0xffffff, 0.15)
                .setStrokeStyle(2, 0xffffff, 0.4).setDepth(DEPTH)
                .setInteractive()
                .on('pointerdown', () => {
                    touchInput.press(action);
                    button.setFillStyle(0xffffff, 0.35);
                })
                .on('pointerup', () => button.setFillStyle(0xffffff, 0.15))
                .on('pointerout', () => button.setFillStyle(0xffffff, 0.15));
            scene.add.text(x, y, label, {
                fontFamily: 'Pixeboy, monospace',
                fontSize: '16px',
                color: '#ffffff'
            }).setOrigin(0.5).setDepth(DEPTH + 1).setResolution(2);
        }
    }
}
