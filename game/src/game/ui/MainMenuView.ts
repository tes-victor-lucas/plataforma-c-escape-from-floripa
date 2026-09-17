import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type MainMenuViewOptions = {
    onNewGame: () => void;
};

const ACTION_FONT = 'PixelGamer, monospace';
const ACTION_FONT_SIZE = '26px';
const ACTION_HOVER_OFFSET = 6;
const ACTION_ANIMATION_DURATION = 120;

/** Renders the menu artwork and actions independently from navigation. */
export class MainMenuView {
    constructor(
        private readonly scene: Scene,
        private readonly options: MainMenuViewOptions
    ) {}

    create() {
        this.scene.add
            .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-background')
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setScrollFactor(0);

        this.addActions();
    }

    private addActions() {
        this.createAction('New Game', 250, this.options.onNewGame);
        this.createAction('Quit', 300);
    }

    private createAction(label: string, y: number, onClick?: () => void) {
        const action = this.scene.add
            .text(72, y, label, {
                color: '#f7f7f7',
                fontFamily: ACTION_FONT,
                fontSize: ACTION_FONT_SIZE,
                fontStyle: 'normal',
                shadow: {
                    offsetX: 1,
                    offsetY: 2,
                    color: '#000000',
                    blur: 2,
                    fill: true
                }
            })
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        action.on('pointerover', () => {
            action.setColor('#ef3441');
            this.animateAction(action, y - ACTION_HOVER_OFFSET);
        });

        action.on('pointerout', () => {
            action.setColor('#f7f7f7');
            this.animateAction(action, y);
        });

        if (onClick) {
            action.on('pointerup', onClick);
        }
    }

    private animateAction(action: Phaser.GameObjects.Text, targetY: number) {
        this.scene.tweens.killTweensOf(action);
        this.scene.tweens.add({
            targets: action,
            y: targetY,
            duration: ACTION_ANIMATION_DURATION,
            ease: 'Sine.Out'
        });
    }
}
