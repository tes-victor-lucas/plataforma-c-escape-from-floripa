import type { Scene } from 'phaser';
import { WORLD_CONFIG } from '../config/world';

/** Exibe e movimenta o drone inimigo na sala. */
export class Drone {
    readonly sprite: Phaser.Physics.Arcade.Sprite;

    private direction = 1;

    constructor(private readonly scene: Scene) {
        const { drone } = WORLD_CONFIG;
        this.sprite = scene.physics.add.sprite(drone.x, drone.y, drone.texture, 0);
        this.sprite.setScale(drone.scale);
        this.sprite.setDepth(10);
        this.sprite.setCollideWorldBounds(true);
        this.configureBody();
    }

    update() {
        const { drone } = WORLD_CONFIG;
        const body = this.sprite.body;

        if (!(body instanceof Phaser.Physics.Arcade.Body)) {
            return;
        }

        if (
            this.sprite.x <= drone.patrolLeft
            || body.blocked.left
        ) {
            this.direction = 1;
        } else if (
            this.sprite.x >= drone.patrolRight
            || body.blocked.right
        ) {
            this.direction = -1;
        }

        body.setVelocityX(this.direction * drone.speed);
        this.sprite.setFlipX(this.direction < 0);
    }

    private configureBody() {
        const body = this.sprite.body;

        if (body) {
            body.setSize(24, 20);
            body.setOffset(4, 14);
            body.setImmovable(true);
            body.setAllowGravity(false);
        }
    }
}