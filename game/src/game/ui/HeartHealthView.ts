import type { Scene } from 'phaser';
import { COMBAT_CONFIG } from '../config/combat';
import { HUD_CONFIG } from '../config/hud';

type HeartLayers = {
    empty: Phaser.GameObjects.Image;
    filled: Phaser.GameObjects.Image;
};

/** Converte a vida em preenchimentos de coração entre 0 (vazio) e 1 (cheio). */
export function getHeartFillLevels(current: number, max: number) {
    const unitsPerHeart = COMBAT_CONFIG.player.healthPerHeart;
    const heartCount = Math.ceil(max / unitsPerHeart);

    return Array.from({ length: heartCount }, (_, index) => Math.max(
        0,
        Math.min(1, (current - index * unitsPerHeart) / unitsPerHeart)
    ));
}

/** Renderiza a vida usando uma camada preta e outra colorida para cada coração. */
export class HeartHealthView {
    private readonly hearts: HeartLayers[] = [];

    constructor(
        private readonly scene: Scene,
        private readonly x: number,
        private readonly y: number
    ) {}

    update(current: number, max: number) {
        const fillLevels = getHeartFillLevels(current, max);
        this.ensureHeartCount(fillLevels.length);

        for (const [index, heart] of this.hearts.entries()) {
            const isActive = index < fillLevels.length;
            heart.empty.setVisible(isActive);
            heart.filled.setVisible(isActive && fillLevels[index] > 0);
            if (!isActive || fillLevels[index] === 0) continue;

            const fill = fillLevels[index];
            if (fill === 1) {
                heart.filled.setCrop();
            } else {
                heart.filled.setCrop(0, 0, heart.filled.width * fill, heart.filled.height);
            }
        }

        return this.getWidth(fillLevels.length);
    }

    private ensureHeartCount(count: number) {
        const { texture, width, height, spacing } = HUD_CONFIG.heart;
        while (this.hearts.length < count) {
            const index = this.hearts.length;
            const x = this.x + index * (width + spacing);
            const empty = this.scene.add.image(x, this.y, texture)
                .setOrigin(0, 0.5)
                .setDisplaySize(width, height)
                .setTint(0x000000);
            const filled = this.scene.add.image(x, this.y, texture)
                .setOrigin(0, 0.5)
                .setDisplaySize(width, height);
            this.hearts.push({ empty, filled });
        }
    }

    private getWidth(count: number) {
        const { width, spacing } = HUD_CONFIG.heart;
        return count === 0 ? 0 : count * width + (count - 1) * spacing;
    }
}
