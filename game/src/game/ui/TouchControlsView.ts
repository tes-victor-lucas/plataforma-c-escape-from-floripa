import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { isTouchScreen, joystickDirection, touchInput, type TouchAction } from '../input/TouchInput';

export type UseAction = 'sword' | 'interact';

const DEPTH = 120;
const MARGIN = 96;
const STICK = { x: MARGIN, y: GAME_HEIGHT - MARGIN, radius: 52 };
const KNOB_RADIUS = 24;
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
// DASH espelha o joystick; USAR fica em arco ao lado, ao alcance do mesmo polegar.
const BUTTONS: readonly { action: TouchAction; label: string; x: number; y: number }[] = [
    { action: 'dash', label: 'DASH', x: GAME_WIDTH - MARGIN, y: GAME_HEIGHT - MARGIN },
    { action: 'interact', label: 'USAR', x: GAME_WIDTH - MARGIN - 104, y: GAME_HEIGHT - 54 }
];

/** Joystick na metade esquerda e botões à direita; só aparece em telas de toque. */
export class TouchControlsView {
    private swordIcon?: Phaser.GameObjects.Image;
    private useIcon?: Phaser.GameObjects.Graphics;
    private useButton?: Phaser.GameObjects.Container;

    constructor(private readonly scene: Scene) {}

    /** USAR só existe com a espada na mão ou perto do Piranhas Bar; o ícone mostra qual dos dois. */
    showUse(action?: UseAction) {
        const button = this.useButton;
        if (!button) return;
        this.swordIcon?.setVisible(action === 'sword');
        this.useIcon?.setVisible(action === 'interact');
        if (button.visible === (action !== undefined)) return;
        button.setVisible(action !== undefined);
        // Aparece crescendo, para o jogador notar que ganhou uma ação.
        if (button.visible) {
            this.scene.tweens.add({ targets: button, scale: { from: 0.6, to: 1 }, duration: 160, ease: 'Expo.easeOut' });
        }
    }

    create() {
        if (!isTouchScreen()) return;
        const { scene } = this;
        touchInput.reset();
        scene.events.once('shutdown', () => touchInput.reset());

        const base = scene.add.graphics().setDepth(DEPTH);
        drawPixelDisc(base, STICK.x, STICK.y, STICK.radius, COLORS.outline, 0.8);
        drawPixelDisc(base, STICK.x, STICK.y, STICK.radius - 3, COLORS.ring, 0.8);
        drawPixelDisc(base, STICK.x, STICK.y, STICK.radius - 6, COLORS.fill, 0.55);
        const knob = scene.add.graphics().setDepth(DEPTH + 1).setPosition(STICK.x, STICK.y);
        const drawKnob = (active: boolean) => {
            knob.clear();
            drawPixelDisc(knob, 0, 0, KNOB_RADIUS, COLORS.outline);
            drawPixelDisc(knob, 0, 0, KNOB_RADIUS - 3, COLORS.ring);
            drawPixelDisc(knob, 0, 0, KNOB_RADIUS - 6, active ? COLORS.pressed : COLORS.ringShadow);
        };
        drawKnob(false);

        let stickPointer: number | undefined;
        const moveStick = (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== stickPointer) return;
            const dx = pointer.x - STICK.x;
            const dy = pointer.y - STICK.y;
            const travel = STICK.radius - KNOB_RADIUS / 2;
            const scale = Math.min(1, travel / (Math.hypot(dx, dy) || 1));
            knob.setPosition(STICK.x + dx * scale, STICK.y + dy * scale);
            const direction = joystickDirection(dx, dy, STICK.radius);
            touchInput.x = direction.x;
            touchInput.y = direction.y;
        };
        const releaseStick = (pointer: Phaser.Input.Pointer) => {
            if (pointer.id !== stickPointer) return;
            stickPointer = undefined;
            knob.setPosition(STICK.x, STICK.y);
            drawKnob(false);
            touchInput.x = 0;
            touchInput.y = 0;
        };
        scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (stickPointer !== undefined || pointer.x > GAME_WIDTH / 2) return;
            stickPointer = pointer.id;
            drawKnob(true);
            moveStick(pointer);
        });
        scene.input.on('pointermove', moveStick);
        scene.input.on('pointerup', releaseStick);
        scene.input.on('pointerupoutside', releaseStick);

        for (const { action, label, x, y } of BUTTONS) {
            const frame = scene.add.graphics();
            const draw = (pressed: boolean) => {
                frame.clear();
                drawPixelDisc(frame, 0, 0, BUTTON_RADIUS, COLORS.outline);
                drawPixelDisc(frame, 0, 0, BUTTON_RADIUS - 3, COLORS.ring);
                drawPixelDisc(frame, 0, 0, BUTTON_RADIUS - 6, COLORS.ringShadow);
                drawPixelDisc(frame, 0, 0, BUTTON_RADIUS - 9, pressed ? COLORS.pressed : COLORS.fill);
            };
            draw(false);
            const icons: Phaser.GameObjects.GameObject[] = [];
            if (action === 'dash') {
                const icon = scene.add.graphics();
                drawDashIcon(icon);
                icons.push(icon);
            } else {
                this.useIcon = scene.add.graphics();
                drawUseIcon(this.useIcon);
                this.swordIcon = scene.add.image(0, 0, 'sword').setScale(2.6);
                icons.push(this.useIcon, this.swordIcon);
            }
            const text = scene.add.text(0, -BUTTON_RADIUS - 10, label, {
                fontFamily: 'Pixeboy, monospace',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#02040f',
                strokeThickness: 3
            }).setOrigin(0.5).setResolution(2);
            const hitArea = scene.add.circle(0, 0, BUTTON_RADIUS, 0x000000, 0)
                .setInteractive()
                .on('pointerdown', () => {
                    // O USAR escondido continua no lugar; toque nele não pode virar ação.
                    if (!hitArea.parentContainer?.visible) return;
                    touchInput.press(action);
                    draw(true);
                })
                .on('pointerup', () => draw(false))
                .on('pointerout', () => draw(false));
            const button = scene.add.container(x, y, [frame, ...icons, text, hitArea]).setDepth(DEPTH);
            if (action === 'interact') this.useButton = button.setVisible(false);
        }
    }
}

/** Círculo em degraus de 3 px, para combinar com a pixel art. */
function drawPixelDisc(graphics: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha = 1) {
    const step = 3;
    graphics.fillStyle(color, alpha);
    for (let row = -radius; row < radius; row += step) {
        const middle = row + step / 2;
        // Arredonda (não trunca) para a largura acompanhar a altura e o círculo não ficar oval.
        const half = Math.round(Math.sqrt(Math.max(0, radius * radius - middle * middle)) / step) * step;
        graphics.fillRect(x - half, y + row, half * 2, step);
    }
}

/** Duas setas ">" em pixels. */
function drawDashIcon(graphics: Phaser.GameObjects.Graphics) {
    graphics.fillStyle(COLORS.icon, 1);
    for (const offset of [-15, 1]) {
        for (let i = 0; i <= 4; i++) {
            graphics.fillRect(offset + i * 4, -18 + i * 4, 5, 5);
            graphics.fillRect(offset + i * 4, 13 - i * 4, 5, 5);
        }
    }
}

/** Exclamação em pixels: o sinal de "interagir" quando não há espada. */
function drawUseIcon(graphics: Phaser.GameObjects.Graphics) {
    graphics.fillStyle(COLORS.icon, 1);
    graphics.fillRect(-4, -18, 8, 22);
    graphics.fillRect(-4, 9, 8, 8);
}
