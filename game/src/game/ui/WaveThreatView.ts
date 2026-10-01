import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

const DEPTH = 150;
const BAND_WIDTH = 720;
const BAND_HEIGHT = 76;
const HOLD_DURATION = 1350;

const GLITCH_SLICES = [
    { y: -52, x: -308, width: 616, height: 5 },
    { y: -46, x: -344, width: 688, height: 7 },
    { y: -39, x: -360, width: 720, height: 9 },
    { y: 32, x: -360, width: 720, height: 8 },
    { y: 40, x: -337, width: 674, height: 7 },
    { y: 47, x: -292, width: 584, height: 5 }
] as const;

/** Vinheta ameaçadora exibida entre a primeira e a segunda onda. */
export class WaveThreatView {
    private readonly dim: Phaser.GameObjects.Rectangle;
    private readonly banner: Phaser.GameObjects.Container;

    constructor(
        private readonly scene: Scene,
        private readonly worldCamera?: Phaser.Cameras.Scene2D.Camera
    ) {
        this.dim = scene.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x000000,
            0
        ).setDepth(DEPTH).setScrollFactor(0);

        const glitch = scene.add.graphics();
        glitch.fillStyle(0x000000, 1);
        glitch.fillRect(-BAND_WIDTH / 2, -BAND_HEIGHT / 2, BAND_WIDTH, BAND_HEIGHT);
        for (const slice of GLITCH_SLICES) glitch.fillRect(slice.x, slice.y, slice.width, slice.height);
        for (const fragment of [
            { x: -398, y: -36, width: 28, height: 5 },
            { x: -386, y: 22, width: 15, height: 7 },
            { x: 371, y: -25, width: 35, height: 6 },
            { x: 382, y: 31, width: 18, height: 5 }
        ]) glitch.fillRect(fragment.x, fragment.y, fragment.width, fragment.height);

        const message = scene.add.text(0, 0, 'VOCÊ NÃO VAI ESCAPAR', {
            color: '#ffffff',
            fontFamily: 'PixelGamer, monospace',
            fontSize: '34px',
            shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5);

        this.banner = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2, [glitch, message])
            .setAlpha(0)
            .setScale(0.08, 1)
            .setDepth(DEPTH + 1)
            .setScrollFactor(0);
    }

    private shake(duration: number, intensity: number) {
        this.scene.cameras.main.shake(duration, intensity);
        if (this.worldCamera && this.worldCamera !== this.scene.cameras.main) {
            this.worldCamera.shake(duration, intensity);
        }
    }

    play(onComplete: () => void) {
        this.shake(320, 0.012);
        this.scene.tweens.add({ targets: this.dim, fillAlpha: 0.52, duration: 100 });
        this.scene.tweens.add({
            targets: this.banner,
            alpha: 1,
            scaleX: 1,
            duration: 140,
            ease: 'Expo.Out'
        });

        const centerX = GAME_WIDTH / 2;
        for (const [delay, offset] of [[90, -7], [145, 5], [205, -3], [255, 0]] as const) {
            this.scene.time.delayedCall(delay, () => this.banner.setX(centerX + offset));
        }

        this.scene.time.delayedCall(HOLD_DURATION, () => {
            this.shake(220, 0.008);
            this.scene.tweens.add({ targets: this.dim, fillAlpha: 0, duration: 160 });
            this.scene.tweens.add({
                targets: this.banner,
                alpha: 0,
                scaleX: 0.04,
                duration: 160,
                ease: 'Expo.In',
                onComplete: () => {
                    this.dim.destroy();
                    this.banner.destroy(true);
                    onComplete();
                }
            });
        });
    }
}
