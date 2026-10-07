import type { Scene } from 'phaser';
import { WORLD_CONFIG } from '../config/world';
import type { Direction } from './Player';

/** Representação interpolada de um jogador controlado por outro cliente. */
export class RemotePlayer {
    readonly sprite: Phaser.GameObjects.Sprite;
    private target: { x: number; y: number };
    private lastSequence = -1;
    private facing: Direction = 'down';

    constructor(scene: Scene, x: number, y: number) {
        const { player } = WORLD_CONFIG;
        this.sprite = scene.add.sprite(x, y, player.texture, player.initialFrame)
            .setScale(player.scale)
            .setDepth(9)
            .setTint(0x66ccff);
        this.target = { x, y };
    }

    applyState(sequence: number, x: number, y: number, facing: Direction) {
        if (sequence <= this.lastSequence) return;
        this.lastSequence = sequence;
        this.target = { x, y };
        this.facing = facing;
    }

    update() {
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x,
            this.sprite.y,
            this.target.x,
            this.target.y
        );
        this.sprite.setPosition(
            Phaser.Math.Linear(this.sprite.x, this.target.x, 0.35),
            Phaser.Math.Linear(this.sprite.y, this.target.y, 0.35)
        );

        if (distance > 1) {
            this.sprite.anims.play(`player-walk-${this.facing}`, true);
        } else {
            this.sprite.anims.stop();
        }
    }

    destroy() {
        this.sprite.destroy();
    }
}
