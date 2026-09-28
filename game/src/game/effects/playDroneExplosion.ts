import { Animations, type Scene } from 'phaser';

export const DRONE_EXPLOSION = {
    texture: 'drone-explosion',
    path: 'assets/effects/drone-explosion.png',
    frameWidth: 32,
    frameHeight: 32,
    // Prévia: linha 4, coluna 7. Spritesheet: linha 16, colunas 7–10 (20 colunas).
    firstFrame: 306,
    lastFrame: 309,
    frameRate: 10
} as const;

/** Toca os quatro frames uma vez e remove o efeito ao concluir. */
export function playDroneExplosion(scene: Scene, x: number, y: number) {
    const { texture, firstFrame, lastFrame, frameRate } = DRONE_EXPLOSION;
    if (!scene.anims.exists(texture)) {
        scene.anims.create({
            key: texture,
            frames: scene.anims.generateFrameNumbers(texture, { start: firstFrame, end: lastFrame }),
            frameRate,
            repeat: 0
        });
    }

    const explosion = scene.add.sprite(x, y, texture, firstFrame).setDepth(25);
    explosion.once(Animations.Events.ANIMATION_COMPLETE, () => explosion.destroy());
    explosion.play(texture);
}
