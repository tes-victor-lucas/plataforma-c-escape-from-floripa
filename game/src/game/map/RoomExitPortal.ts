import type { Scene } from 'phaser';

const PORTAL_DEPTH = 7;

/** Sinal luminoso exibido sobre a saída liberada da Room 1. */
export class RoomExitPortal {
    private readonly objects: Phaser.GameObjects.GameObject[];
    private readonly pulses: Phaser.Tweens.Tween[];

    constructor(scene: Scene, x: number, y: number) {
        const glow = scene.add.ellipse(x, y, 62, 92, 0x31e6ff, 0.16)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH);
        const core = scene.add.ellipse(x, y, 30, 74, 0xc8fbff, 0.28)
            .setStrokeStyle(2, 0x69f4ff, 0.72)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(PORTAL_DEPTH + 1);
        const marker = scene.add.text(x, y + 50, 'PRÓXIMA SALA', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '7px',
            color: '#bffaff',
            backgroundColor: '#06141ddd',
            padding: { x: 4, y: 2 }
        }).setOrigin(0.5).setDepth(PORTAL_DEPTH + 2);

        this.objects = [glow, core, marker];
        this.pulses = [
            scene.tweens.add({
                targets: glow,
                alpha: { from: 0.1, to: 0.3 },
                scaleX: { from: 0.88, to: 1.12 },
                scaleY: { from: 0.94, to: 1.06 },
                duration: 900,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1
            }),
            scene.tweens.add({
                targets: core,
                alpha: { from: 0.22, to: 0.48 },
                duration: 650,
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
