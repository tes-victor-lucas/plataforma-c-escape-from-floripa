import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type PauseMenuViewOptions = {
    onContinue: () => void;
    onQuit: () => void;
};

const DEPTH = 200;
const FRAME_COLOR = 0x008fa5;
const PANEL_COLOR = 0x00171b;
const BUTTON_COLOR = 0x002b33;

/** Renders the overlay displayed while the room is paused. */
export class PauseMenuView {
    constructor(
        private readonly scene: Scene,
        private readonly options: PauseMenuViewOptions
    ) {}

    create() {
        this.scene.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
            .setDepth(DEPTH)
            .setScrollFactor(0);

        this.drawPanel();
        this.scene.add
            .text(GAME_WIDTH / 2, 157, 'Menu', {
                color: '#f7f7f7',
                fontFamily: 'PixelGamer, monospace',
                fontSize: '62px',
                shadow: {
                    offsetX: 2,
                    offsetY: 3,
                    color: '#000000',
                    blur: 0,
                    fill: true
                }
            })
            .setOrigin(0.5)
            .setDepth(DEPTH + 2)
            .setScrollFactor(0);

        this.createButton('Continue', 242, this.options.onContinue);
        this.createButton('Quit', 326, this.options.onQuit);
    }

    private drawPanel() {
        const x = 194;
        const y = 76;
        const width = 501;
        const height = 350;
        const frame = this.scene.add.graphics().setDepth(DEPTH + 1).setScrollFactor(0);

        frame.fillStyle(PANEL_COLOR, 0.96).fillRect(x, y, width, height);
        frame.lineStyle(5, FRAME_COLOR, 1).strokeRect(x, y, width, height);

        // Square, stepped corners keep the frame in the same pixel-art language as the game.
        frame.fillStyle(FRAME_COLOR, 1);
        frame.fillRect(x + 13, y - 6, width - 26, 6);
        frame.fillRect(x + 13, y + height, width - 26, 6);
        frame.fillRect(x - 6, y + 13, 6, height - 26);
        frame.fillRect(x + width, y + 13, 6, height - 26);
    }

    private createButton(label: string, y: number, onClick: () => void) {
        const width = 342;
        const height = 58;
        const x = (GAME_WIDTH - width) / 2;
        const button = this.scene.add.graphics().setDepth(DEPTH + 2).setScrollFactor(0);
        const text = this.scene.add
            .text(GAME_WIDTH / 2, y, label, {
                color: '#f7f7f7',
                fontFamily: 'PixelGamer, monospace',
                fontSize: '28px'
            })
            .setOrigin(0.5)
            .setDepth(DEPTH + 3)
            .setScrollFactor(0);
        const hitArea = this.scene.add
            .rectangle(GAME_WIDTH / 2, y, width, height, 0x000000, 0)
            .setDepth(DEPTH + 4)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        const drawButton = (isHovered: boolean) => {
            button.clear();
            button.fillStyle(isHovered ? 0x005260 : BUTTON_COLOR, 1).fillRect(x, y - height / 2, width, height);
            button.lineStyle(4, FRAME_COLOR, 1).strokeRect(x, y - height / 2, width, height);
        };

        drawButton(false);
        hitArea.on('pointerover', () => {
            drawButton(true);
            text.setColor('#5ce5f1');
        });
        hitArea.on('pointerout', () => {
            drawButton(false);
            text.setColor('#f7f7f7');
        });
        hitArea.on('pointerup', onClick);
    }
}
