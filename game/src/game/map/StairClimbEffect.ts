import type { Scene } from 'phaser';
import { getStairProgress, type StairPassageArea } from './StairPassage';

/** Cria perspectiva e cadência visual sem mover o corpo físico do personagem. */
export class StairClimbEffect {
    private readonly shadow: Phaser.GameObjects.Ellipse;
    private readonly baseScaleX: number;
    private readonly baseScaleY: number;

    constructor(
        private readonly scene: Scene,
        private readonly sprite: Phaser.Physics.Arcade.Sprite,
        private readonly area: StairPassageArea
    ) {
        this.baseScaleX = sprite.scaleX;
        this.baseScaleY = sprite.scaleY;
        this.shadow = scene.add.ellipse(0, 0, 14, 5, 0x061521, 0.28)
            .setDepth(sprite.depth - 0.1)
            .setVisible(false);
    }

    update() {
        const center = this.sprite.body?.center ?? this.sprite;
        const progress = getStairProgress(center.x, center.y, this.area);

        if (progress === null) {
            this.sprite.setScale(this.baseScaleX, this.baseScaleY);
            this.shadow.setVisible(false);
            return;
        }

        const velocity = this.sprite.body?.velocity;
        const isMoving = velocity ? Math.hypot(velocity.x, velocity.y) > 5 : false;
        const stepPulse = isMoving ? Math.sin(this.scene.time.now / 85) * 0.012 : 0;
        const perspective = 1 - progress * 0.08 + stepPulse;

        this.sprite.setScale(this.baseScaleX * perspective, this.baseScaleY * perspective);
        this.shadow
            .setVisible(true)
            .setPosition(center.x, center.y + 4)
            .setScale(1 - progress * 0.18 + Math.abs(stepPulse) * 2, 1 - progress * 0.1)
            .setAlpha(0.28 - progress * 0.08);
    }

    destroy() {
        this.sprite.setScale(this.baseScaleX, this.baseScaleY);
        this.shadow.destroy();
    }
}
