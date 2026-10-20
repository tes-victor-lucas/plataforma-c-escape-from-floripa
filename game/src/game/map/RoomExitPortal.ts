import type { Scene } from 'phaser';
import { createLampLight, LAMP_LIGHT_TEXTURE } from './createLampLights';

const PORTAL_DEPTH = 7;

export const ROOM_EXIT_LIGHT_STYLE = {
    texture: LAMP_LIGHT_TEXTURE,
    mainScale: 1.15,
    spillScale: 1.65,
    mainAlpha: 0.82,
    spillAlpha: 0.3
} as const;

/** Halo circular centralizado sobre a saída liberada da Room 1. */
export class RoomExitPortal {
    private readonly objects: Phaser.GameObjects.GameObject[];
    private readonly pulses: Phaser.Tweens.Tween[];

    constructor(scene: Scene, x: number, y: number) {
        const style = ROOM_EXIT_LIGHT_STYLE;
        const spill = createLampLight(scene, x, y, PORTAL_DEPTH, style.spillAlpha)
            .setScale(style.spillScale);
        const light = createLampLight(scene, x, y, PORTAL_DEPTH + 1, style.mainAlpha)
            .setScale(style.mainScale);

        this.objects = [spill, light];
        this.pulses = [
            scene.tweens.add({
                targets: [spill, light],
                alpha: { from: style.spillAlpha, to: style.mainAlpha },
                duration: 950,
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
