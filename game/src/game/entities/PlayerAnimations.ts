import type { Scene } from 'phaser';

export type Direction = 'up' | 'down' | 'left' | 'right';

// A folha possui 12 colunas: cada direção ocupa 9 frames em uma linha distinta.
export const WALK_FRAMES: Record<Direction, number[]> = {
    up: [96, 97, 98, 99, 100, 101, 102, 103, 104],
    left: [108, 109, 110, 111, 112, 113, 114, 115, 116],
    down: [120, 121, 122, 123, 124, 125, 126, 127, 128],
    right: [132, 133, 134, 135, 136, 137, 138, 139, 140]
};

export function walkAnimationKey(texture: string, direction: Direction) {
    return `${texture}-${direction}`;
}

/** Cria uma vez por textura; jogador local, parceiro e prévia do menu compartilham as animações. */
export function createWalkAnimations(scene: Scene, texture: string) {
    for (const [direction, frames] of Object.entries(WALK_FRAMES) as [Direction, number[]][]) {
        const key = walkAnimationKey(texture, direction);
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(texture, { frames }),
            frameRate: 9,
            repeat: -1
        });
    }
}
