import type { Scene } from 'phaser';

const PORTAL_DEPTH = 7;

export const ROOM_EXIT_LIGHT_STYLE = {
    outerGlow: { width: 104, height: 78, color: 0xad7cff, alpha: 0.08 },
    glow: { width: 68, height: 54, color: 0xd8b7ff, alpha: 0.18 },
    core: { width: 24, height: 30, color: 0xffffff, alpha: 0.82 },
    floor: { width: 48, height: 13, color: 0xffffff, alpha: 0.68 }
} as const;

/** Sinal luminoso exibido sobre a saída liberada da Room 1. */
export class RoomExitPortal {
    private readonly objects: Phaser.GameObjects.GameObject[];
    private readonly pulses: Phaser.Tweens.Tween[];

    constructor(scene: Scene, x: number, y: number) {
        const { outerGlow: outer, glow: middle, core: center, floor } = ROOM_EXIT_LIGHT_STYLE;
        const outerGlow = scene.add.ellipse(x, y, outer.width, outer.height, outer.color, outer.alpha)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH);
        const glow = scene.add.ellipse(x, y + 3, middle.width, middle.height, middle.color, middle.alpha)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 1);
        const core = scene.add.ellipse(x, y + 8, center.width, center.height, center.color, center.alpha)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 2);
        const floorLight = scene.add.ellipse(x, y + 18, floor.width, floor.height, floor.color, floor.alpha)
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
