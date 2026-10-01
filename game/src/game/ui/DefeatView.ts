import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type DefeatViewOptions = {
    onRestart: () => void;
    onQuit: () => void;
};

const DEPTH = 200;
const FRAME_COLOR = 0x008fa5;
const PANEL_COLOR = 0x00171b;
const BUTTON_COLOR = 0x002b33;
const BUTTON_HOVER_COLOR = 0x005260;
const BUTTON_WIDTH = 300;
const BUTTON_HEIGHT = 52;

/** Tela apresentada quando a vida do jogador chega a zero. */
export class DefeatView {
    constructor(
        private readonly scene: Scene,
        private readonly options: DefeatViewOptions
    ) {}

    create() {
        this.scene.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
            .setDepth(DEPTH);
        this.scene.add
            .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 250, PANEL_COLOR)
            .setStrokeStyle(3, FRAME_COLOR)
            .setDepth(DEPTH + 1);
        this.scene.add
            .text(GAME_WIDTH / 2, 178, 'Você foi derrotado', {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '36px',
                color: '#ff2d2d'
            })
            .setOrigin(0.5)
            .setDepth(DEPTH + 2);

        this.createButton('Tentar novamente', 260, this.options.onRestart);
        this.createButton('Voltar ao menu', 324, this.options.onQuit);
    }

    private createButton(label: string, y: number, action: () => void) {
        const x = (GAME_WIDTH - BUTTON_WIDTH) / 2;
        const background = this.scene.add.graphics().setDepth(DEPTH + 2);
        const text = this.scene.add
            .text(GAME_WIDTH / 2, y, label, {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '24px',
                color: '#f7f7f7'
            })
            .setOrigin(0.5)
            .setDepth(DEPTH + 3);
        const hitArea = this.scene.add
            .rectangle(GAME_WIDTH / 2, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x000000, 0)
            .setDepth(DEPTH + 4)
            .setInteractive({ useHandCursor: true });

        const drawButton = (isHovered: boolean) => {
            background.clear();
            background
                .fillStyle(isHovered ? BUTTON_HOVER_COLOR : BUTTON_COLOR, 1)
                .fillRect(x, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT);
            background
                .lineStyle(2, FRAME_COLOR, 1)
                .strokeRect(x, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT);
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
        hitArea.once('pointerup', action);
    }
}
