import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type BlackScreenTransitionOptions = {
    onCovered: () => void;
    onComplete: () => void;
};

const DEPTH = 300;
const CLOSE_DURATION = 500;
const REVEAL_DURATION = 550;

/** Covers the screen before swapping scenes, then reveals the new scene. */
export class BlackScreenTransitionView {
    private readonly leftCurtain: Phaser.GameObjects.Rectangle;
    private readonly rightCurtain: Phaser.GameObjects.Rectangle;

    constructor(private readonly scene: Scene) {
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;
        const curtainWidth = GAME_WIDTH / 2;

        this.leftCurtain = this.scene.add
            .rectangle(centerX, centerY, curtainWidth, GAME_HEIGHT, 0x000000)
            .setOrigin(1, 0.5)
            .setScale(0, 1)
            .setDepth(DEPTH)
            .setScrollFactor(0);
        this.rightCurtain = this.scene.add
            .rectangle(centerX, centerY, curtainWidth, GAME_HEIGHT, 0x000000)
            .setOrigin(0, 0.5)
            .setScale(0, 1)
            .setDepth(DEPTH)
            .setScrollFactor(0);
    }

    play(options: BlackScreenTransitionOptions) {
        this.scene.tweens.add({
            targets: [this.leftCurtain, this.rightCurtain],
            scaleX: 1,
            duration: CLOSE_DURATION,
            ease: 'Sine.Out',
            onComplete: () => {
                options.onCovered();
                this.reveal(options.onComplete);
            }
        });
    }

    private reveal(onComplete: () => void) {
        this.scene.tweens.add({
            targets: [this.leftCurtain, this.rightCurtain],
            scaleX: 0,
            duration: REVEAL_DURATION,
            ease: 'Sine.InOut',
            onComplete
        });
    }
}
