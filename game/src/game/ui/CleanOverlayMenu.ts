import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { bindGamepadActions } from '../input/GamepadInput';

export const CLEAN_MENU_COLORS = {
    panel: 0x00171b,
    panelCss: '#00171b',
    frame: 0x00d3de,
    frameCss: '#5ce5f1',
    button: 0x002b33,
    buttonHover: 0x00c8d4,
    danger: 0xe90931,
    success: 0x39d98a,
    text: '#f7f7f7',
    mutedText: '#8eb6bd'
} as const;

export type CleanMenuBounds = Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
}>;

type MenuTone = 'neutral' | 'danger' | 'success';
type MenuIcon = 'pause' | 'defeat' | 'victory' | 'leaderboard';

type CleanOverlayMenuOptions = Readonly<{
    bounds: CleanMenuBounds;
    depth?: number;
    dimAlpha?: number;
}>;

type CleanMenuButtonOptions = Readonly<{
    tone?: MenuTone;
    width?: number;
    height?: number;
    fontSize?: string;
}>;

type KeyboardNavigationOptions = Readonly<{
    onCancel?: () => void;
}>;

type ControlHint = Readonly<{
    key: string;
    label: string;
}>;

type RenderedButton = Readonly<{
    background: Phaser.GameObjects.Graphics;
    arrow: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
    action: () => void;
    tone: MenuTone;
    bounds: CleanMenuBounds;
}>;

const DEFAULT_DEPTH = 200;
const FONT = 'PixelGamer, monospace';

function toneColor(tone: MenuTone) {
    if (tone === 'danger') return CLEAN_MENU_COLORS.danger;
    if (tone === 'success') return CLEAN_MENU_COLORS.success;
    return CLEAN_MENU_COLORS.buttonHover;
}

/** Desenha a caixa pixelada usada por painéis, botões e seções internas. */
export function drawCleanMenuBox(
    graphics: Phaser.GameObjects.Graphics,
    bounds: CleanMenuBounds,
    fillColor: number,
    borderColor: number,
    step: number,
    border: number
) {
    const { x, y, width, height } = bounds;
    graphics.fillStyle(borderColor, 1);
    graphics.fillRect(x + step, y, width - step * 2, height);
    graphics.fillRect(x, y + step, width, height - step * 2);
    graphics.fillStyle(fillColor, 1);
    graphics.fillRect(
        x + step,
        y + border,
        width - step * 2,
        height - border * 2
    );
    graphics.fillRect(
        x + border,
        y + step,
        width - border * 2,
        height - step * 2
    );
}

/**
 * Base compartilhada pelos menus sobrepostos do jogo.
 * Mantém o desenho enxuto e concentra interação, foco e limpeza dos listeners.
 */
export class CleanOverlayMenu {
    readonly root: Phaser.GameObjects.Container;
    private readonly buttons: RenderedButton[] = [];
    private selectedButton = 0;
    private activated = false;

    constructor(
        private readonly scene: Scene,
        private readonly options: CleanOverlayMenuOptions
    ) {
        this.root = scene.add.container(0, 0)
            .setDepth(options.depth ?? DEFAULT_DEPTH)
            .setScrollFactor(0);
        this.root.add(scene.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x000000,
            options.dimAlpha ?? 0.68
        ));
        this.root.add(this.createPanel());
    }

    add(objects: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) {
        this.root.add(objects);
    }

    addTitle(title: string, y: number, icon: MenuIcon, tone: MenuTone = 'neutral') {
        this.root.add(this.createStatusBadge(y - 44, icon, tone));
        const text = this.scene.add.text(GAME_WIDTH / 2, y, title, {
            fontFamily: FONT,
            fontSize: '30px',
            color: CLEAN_MENU_COLORS.text,
            align: 'center',
            shadow: { offsetX: 2, offsetY: 3, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5).setResolution(2);
        this.root.add(text);
        return text;
    }

    addHint(text: string, y: number) {
        const hint = this.scene.add.text(GAME_WIDTH / 2, y, text, {
            fontFamily: FONT,
            fontSize: '11px',
            color: CLEAN_MENU_COLORS.mutedText,
            align: 'center'
        }).setOrigin(0.5).setResolution(2);
        this.root.add(hint);
        return hint;
    }

    addControlHints(hints: readonly ControlHint[], y: number) {
        const groups = hints.map(({ key, label }) => {
            const labelText = this.scene.add.text(0, y, label, {
                fontFamily: FONT,
                fontSize: '11px',
                color: CLEAN_MENU_COLORS.text
            }).setOrigin(0, 0.5).setResolution(2);
            const keyWidth = key.length === 1 ? 26 : 50;
            return { key, labelText, keyWidth, width: keyWidth + 8 + labelText.width };
        });
        const separatorWidth = 34;
        const totalWidth = groups.reduce((total, group) => total + group.width, 0)
            + Math.max(0, groups.length - 1) * separatorWidth;
        let x = GAME_WIDTH / 2 - totalWidth / 2;

        groups.forEach((group, index) => {
            const keycap = this.scene.add.graphics();
            drawCleanMenuBox(
                keycap,
                { x, y: y - 12, width: group.keyWidth, height: 24 },
                CLEAN_MENU_COLORS.panel,
                CLEAN_MENU_COLORS.frame,
                3,
                2
            );
            const keyText = this.scene.add.text(x + group.keyWidth / 2, y, group.key, {
                fontFamily: FONT,
                fontSize: '11px',
                color: CLEAN_MENU_COLORS.text
            }).setOrigin(0.5).setResolution(2);
            group.labelText.setX(x + group.keyWidth + 8);
            this.root.add([keycap, keyText, group.labelText]);
            x += group.width;

            if (index < groups.length - 1) {
                const separator = this.scene.add.graphics();
                separator.fillStyle(CLEAN_MENU_COLORS.danger, 1)
                    .fillRect(x + separatorWidth / 2 - 3, y - 3, 6, 6);
                this.root.add(separator);
                x += separatorWidth;
            }
        });
    }

    addDivider(y: number, inset = 46) {
        const { x, width } = this.options.bounds;
        const divider = this.scene.add.graphics();
        divider.fillStyle(CLEAN_MENU_COLORS.frame, 0.72)
            .fillRect(x + inset, y, width - inset * 2, 2);
        this.root.add(divider);
        return divider;
    }

    addButton(label: string, y: number, action: () => void, options: CleanMenuButtonOptions = {}) {
        const width = options.width ?? 330;
        const height = options.height ?? 48;
        const bounds = {
            x: Math.round((GAME_WIDTH - width) / 2),
            y: Math.round(y - height / 2),
            width,
            height
        };
        const background = this.scene.add.graphics();
        const arrow = this.scene.add.graphics();
        const text = this.scene.add.text(GAME_WIDTH / 2, y, label, {
            fontFamily: FONT,
            fontSize: options.fontSize ?? '21px',
            color: CLEAN_MENU_COLORS.text,
            align: 'center'
        }).setOrigin(0.5).setResolution(2);
        const hitArea = this.scene.add.rectangle(GAME_WIDTH / 2, y, width, height, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const index = this.buttons.length;
        const button: RenderedButton = {
            background,
            arrow,
            label: text,
            action,
            tone: options.tone ?? 'neutral',
            bounds
        };

        hitArea.on('pointerover', () => this.selectButton(index));
        hitArea.on('pointerdown', () => this.activate(index));
        this.buttons.push(button);
        this.root.add([background, arrow, text, hitArea]);
        this.renderButtons();
        return hitArea;
    }

    enableKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
        if (this.buttons.length === 0) return;

        const previous = () => this.moveSelection(-1);
        const next = () => this.moveSelection(1);
        const confirm = () => this.activate(this.selectedButton);
        const cancel = () => {
            if (this.activated || !options.onCancel) return;
            this.activated = true;
            options.onCancel();
        };

        bindGamepadActions(this.scene, {
            up: previous,
            down: next,
            confirm,
            cancel
        });

        const keyboard = this.scene.input?.keyboard;
        if (!keyboard) return;

        keyboard.on('keydown-UP', previous);
        keyboard.on('keydown-W', previous);
        keyboard.on('keydown-DOWN', next);
        keyboard.on('keydown-S', next);
        keyboard.on('keydown-ENTER', confirm);
        keyboard.on('keydown-SPACE', confirm);
        keyboard.on('keydown-ESC', cancel);

        this.scene.events?.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard.off('keydown-UP', previous);
            keyboard.off('keydown-W', previous);
            keyboard.off('keydown-DOWN', next);
            keyboard.off('keydown-S', next);
            keyboard.off('keydown-ENTER', confirm);
            keyboard.off('keydown-SPACE', confirm);
            keyboard.off('keydown-ESC', cancel);
        });
    }

    fadeIn(duration = 160) {
        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration, ease: 'Sine.Out' });
    }

    private createPanel() {
        const { x, y, width, height } = this.options.bounds;
        const panel = this.scene.add.graphics();
        drawCleanMenuBox(
            panel,
            { x, y, width, height },
            CLEAN_MENU_COLORS.panel,
            CLEAN_MENU_COLORS.frame,
            12,
            4
        );

        // Dois pequenos cortes preservam a identidade vermelha sem virar ilustração.
        panel.fillStyle(CLEAN_MENU_COLORS.danger, 1);
        panel.fillRect(x + 12, y + 10, 13, 3);
        panel.fillRect(x + 12, y + 10, 3, 13);
        panel.fillRect(x + width - 25, y + height - 13, 13, 3);
        panel.fillRect(x + width - 15, y + height - 23, 3, 13);
        return panel;
    }

    private createStatusBadge(y: number, icon: MenuIcon, tone: MenuTone) {
        const color = tone === 'neutral' ? CLEAN_MENU_COLORS.frame : toneColor(tone);
        const badge = this.scene.add.graphics();
        drawCleanMenuBox(
            badge,
            { x: GAME_WIDTH / 2 - 21, y: y - 19, width: 42, height: 38 },
            CLEAN_MENU_COLORS.panel,
            CLEAN_MENU_COLORS.frame,
            5,
            3
        );
        badge.fillStyle(color, 1);

        if (icon === 'pause') {
            badge.fillRect(GAME_WIDTH / 2 - 8, y - 9, 6, 18);
            badge.fillRect(GAME_WIDTH / 2 + 2, y - 9, 6, 18);
        } else if (icon === 'defeat') {
            for (let step = -2; step <= 2; step++) {
                badge.fillRect(GAME_WIDTH / 2 - 2 + step * 4, y - 2 + step * 4, 5, 5);
                badge.fillRect(GAME_WIDTH / 2 - 2 + step * 4, y - 2 - step * 4, 5, 5);
            }
        } else if (icon === 'victory') {
            badge.fillRect(GAME_WIDTH / 2 - 11, y, 6, 6);
            badge.fillRect(GAME_WIDTH / 2 - 6, y + 5, 6, 6);
            badge.fillRect(GAME_WIDTH / 2 - 1, y, 6, 6);
            badge.fillRect(GAME_WIDTH / 2 + 4, y - 5, 6, 6);
            badge.fillRect(GAME_WIDTH / 2 + 9, y - 10, 6, 6);
        } else {
            badge.fillRect(GAME_WIDTH / 2 - 12, y + 8, 24, 3);
            badge.fillRect(GAME_WIDTH / 2 - 10, y + 1, 5, 7);
            badge.fillRect(GAME_WIDTH / 2 - 2, y - 5, 5, 13);
            badge.fillRect(GAME_WIDTH / 2 + 6, y - 11, 5, 19);
        }
        return badge;
    }

    private moveSelection(direction: number) {
        if (this.activated || this.buttons.length === 0) return;
        this.selectedButton = (this.selectedButton + direction + this.buttons.length) % this.buttons.length;
        this.renderButtons();
    }

    private selectButton(index: number) {
        if (this.activated || !this.buttons[index]) return;
        this.selectedButton = index;
        this.renderButtons();
    }

    private activate(index: number) {
        if (this.activated || !this.buttons[index]) return;
        this.activated = true;
        this.buttons[index].action();
    }

    private renderButtons() {
        this.buttons.forEach((button, index) => {
            const selected = index === this.selectedButton;
            const { x, y, width, height } = button.bounds;
            button.background.clear();
            drawCleanMenuBox(
                button.background,
                { x, y, width, height },
                selected
                    ? button.tone === 'danger'
                        ? CLEAN_MENU_COLORS.danger
                        : CLEAN_MENU_COLORS.buttonHover
                    : CLEAN_MENU_COLORS.button,
                CLEAN_MENU_COLORS.frame,
                5,
                2
            );
            if (selected && button.tone === 'success') {
                button.background.fillStyle(CLEAN_MENU_COLORS.success, 1)
                    .fillRect(x + 5, y + height - 3, width - 10, 3);
            }

            button.arrow.clear().setVisible(selected);
            if (selected) {
                const centerY = y + height / 2;
                button.arrow.fillStyle(
                    button.tone === 'danger' ? CLEAN_MENU_COLORS.frame : CLEAN_MENU_COLORS.danger,
                    1
                );
                button.arrow.fillRect(x + 15, centerY - 8, 3, 16);
                button.arrow.fillRect(x + 18, centerY - 6, 3, 12);
                button.arrow.fillRect(x + 21, centerY - 4, 3, 8);
                button.arrow.fillRect(x + 24, centerY - 2, 3, 4);
            }
            button.label.setColor(CLEAN_MENU_COLORS.text);
        });
    }

}
