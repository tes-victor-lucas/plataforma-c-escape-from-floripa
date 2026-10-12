import type { Scene } from 'phaser';

const PORTAL_DEPTH = 7;

/** Sinal luminoso exibido sobre a saída liberada da Room 1. */
export class RoomExitPortal {
    private readonly objects: Phaser.GameObjects.GameObject[];
    private readonly pulses: Phaser.Tweens.Tween[];

    constructor(scene: Scene, x: number, y: number) {
        const outerGlow = scene.add.ellipse(x, y, 104, 78, 0xad7cff, 0.08)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH);
        const glow = scene.add.ellipse(x, y + 3, 68, 54, 0xd8b7ff, 0.18)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 1);
        const core = scene.add.ellipse(x, y + 8, 24, 30, 0xffffff, 0.82)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 2);
        const floorLight = scene.add.ellipse(x, y + 18, 48, 13, 0xffffff, 0.68)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 3);

        this.objects = [outerGlow, glow, core, floorLight];
        this.pulses = [
            scene.tweens.add({
                targets: outerGlow,
                alpha: { from: 0.05, to: 0.16 },
                scaleX: { from: 0.9, to: 1.14 },
                scaleY: { from: 0.9, to: 1.08 },
                duration: 1050,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1
            }),
            scene.tweens.add({
                targets: [glow, core, floorLight],
                alpha: { from: 0.34, to: 0.9 },
                duration: 720,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1
            })
        ];
    }

    destroy() {
        for (const pulse of this.pulses) pulse.stop();
        for (const object of this.objects) object.destroy();
    }
}
