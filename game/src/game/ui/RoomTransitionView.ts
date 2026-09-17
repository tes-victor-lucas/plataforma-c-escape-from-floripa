import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type RoomTransitionOptions = {
    onCovered: () => void;
    onComplete: () => void;
};

const TITLE = 'Sala I';
const TRANSITION_DEPTH = 100;
const CLOSE_DURATION = 1200;
const TITLE_DELAY = 350;
const CHARACTER_DELAY = 160;
const TITLE_HOLD_DURATION = 1200;
const REVEAL_DURATION = 1200;

/** Plays the cinematic blackout transition between the menu and Room 1. */
export class RoomTransitionView {
    private readonly leftCurtain: Phaser.GameObjects.Rectangle;
    private readonly rightCurtain: Phaser.GameObjects.Rectangle;
    private readonly title: Phaser.GameObjects.Text;

    constructor(private readonly scene: Scene) {
        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;
        const curtainWidth = GAME_WIDTH / 2;

        this.leftCurtain = this.scene.add
            .rectangle(centerX, centerY, curtainWidth, GAME_HEIGHT, 0x000000)
            .setOrigin(1, 0.5)
            .setScale(0, 1)
            .setDepth(TRANSITION_DEPTH)
            .setScrollFactor(0);

        this.rightCurtain = this.scene.add
            .rectangle(centerX, centerY, curtainWidth, GAME_HEIGHT, 0x000000)
            .setOrigin(0, 0.5)
            .setScale(0, 1)
            .setDepth(TRANSITION_DEPTH)
            .setScrollFactor(0);

        this.title = this.scene.add
            .text(centerX, centerY, '', {
                color: '#ffffff',
                fontFamily: 'PixelGamer, monospace',
                fontSize: '42px',
                shadow: {
                    offsetX: 2,
                    offsetY: 3,
                    color: '#000000',
                    blur: 0,
                    fill: true
                }
            })
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(TRANSITION_DEPTH + 1)
            .setScrollFactor(0);
    }

    play(options: RoomTransitionOptions) {
        this.closeFromCenter(() => {
            options.onCovered();
            this.scene.time.delayedCall(TITLE_DELAY, () => {
                this.typeTitle(() => {
                    this.scene.time.delayedCall(TITLE_HOLD_DURATION, () => {
                        this.revealGame(options.onComplete);
                    });
                });
            });
        });
    }

    private closeFromCenter(onComplete: () => void) {
        this.scene.tweens.add({
            targets: [this.leftCurtain, this.rightCurtain],
            scaleX: 1,
            duration: CLOSE_DURATION,
            ease: 'Sine.Out',
            onComplete
        });
    }

    private typeTitle(onComplete: () => void) {
        const characters = [...TITLE];
        let characterIndex = 0;

        this.title.setText('').setScale(0.92).setAlpha(0);
        this.scene.tweens.add({
            targets: this.title,
            alpha: 1,
            scale: 1,
            duration: 180,
            ease: 'Sine.Out'
        });

        const revealNextCharacter = () => {
            characterIndex += 1;
            this.title.setText(characters.slice(0, characterIndex).join(''));

            if (characterIndex === characters.length) {
                onComplete();
                return;
            }

            this.scene.time.delayedCall(CHARACTER_DELAY, revealNextCharacter);
        };

        revealNextCharacter();
    }

    private revealGame(onComplete: () => void) {
        this.scene.tweens.add({
            targets: this.title,
            alpha: 0,
            duration: 180,
            ease: 'Sine.In'
        });

        this.scene.tweens.add({
            targets: [this.leftCurtain, this.rightCurtain],
            scaleX: 0,
            duration: REVEAL_DURATION,
            ease: 'Sine.InOut',
            onComplete
        });
    }
}
