import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

const BAR_HEIGHT = 62;

/** Faixas pretas de cinema, por cima do HUD, com uma legenda na faixa de baixo. */
export class CinematicBarsView {
    private readonly top: Phaser.GameObjects.Rectangle;
    private readonly bottom: Phaser.GameObjects.Rectangle;
    private readonly caption: Phaser.GameObjects.Text;

    constructor(private readonly scene: Scene, caption: string) {
        this.top = scene.add.rectangle(0, -BAR_HEIGHT, GAME_WIDTH, BAR_HEIGHT, 0x000000).setOrigin(0).setDepth(300);
        this.bottom = scene.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, BAR_HEIGHT, 0x000000).setOrigin(0).setDepth(300);
        this.caption = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT - BAR_HEIGHT / 2, caption, {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '28px',
            color: '#f29b38',
            stroke: '#06263d',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(301).setResolution(2).setAlpha(0);
    }

    show(duration: number) {
        this.scene.tweens.add({ targets: this.top, y: 0, duration, ease: 'Sine.easeOut' });
        this.scene.tweens.add({ targets: this.bottom, y: GAME_HEIGHT - BAR_HEIGHT, duration, ease: 'Sine.easeOut' });
        this.scene.tweens.add({ targets: this.caption, alpha: 1, delay: duration, duration: 200 });
    }

    hide(duration: number) {
        this.scene.tweens.add({ targets: this.caption, alpha: 0, duration: 120 });
        this.scene.tweens.add({ targets: this.top, y: -BAR_HEIGHT, duration, ease: 'Sine.easeIn' });
        this.scene.tweens.add({
            targets: this.bottom,
            y: GAME_HEIGHT,
            duration,
            ease: 'Sine.easeIn',
            onComplete: () => [this.top, this.bottom, this.caption].forEach((object) => object.destroy())
        });
    }
}
