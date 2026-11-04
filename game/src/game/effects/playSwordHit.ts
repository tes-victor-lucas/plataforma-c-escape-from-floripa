import type { Scene } from 'phaser';

/** Faísca de pancada, usada na espada e nos golpes dos gaúchos. */
export function playSwordHit(scene: Scene, x: number, y: number) {
    const hit = scene.add.image(x, y, 'sword-hit', Math.floor(Math.random() * 3))
        .setDepth(16)
        .setScale(0.6);
    scene.tweens.add({
        targets: hit,
        scale: 1.1,
        alpha: 0,
        duration: 220,
        onComplete: () => hit.destroy()
    });
}
