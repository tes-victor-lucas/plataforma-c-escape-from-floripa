import { Physics, type Scene } from 'phaser';
import { WORLD_CONFIG } from '../config/world';
import { COMBAT_CONFIG } from '../config/combat';
import { AUDIO_CONFIG } from '../config/audio';
import { Health } from '../combat/Health';
import type { Player } from './Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDroneExplosion } from '../effects/playDroneExplosion';

type DroneSpawn = { x: number; y: number; patrolLeft: number; patrolRight: number };

/** Exibe e movimenta o drone inimigo na sala. */
export class Drone {
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.drone.maxHealth);

    private direction = 1;
    private isChasing = false;
    private readonly healthBar: Phaser.GameObjects.Graphics;

    constructor(
        private readonly scene: Scene,
        private readonly spawn: DroneSpawn,
        private readonly walls: Phaser.Tilemaps.TilemapLayer[]
    ) {
        const { drone } = WORLD_CONFIG;
        this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, drone.texture, 0);
        this.sprite.setScale(drone.scale);
        this.sprite.setDepth(10);
        this.sprite.setCollideWorldBounds(true);
        this.configureBody();
        if (!scene.anims.exists('drone-hover')) {
            scene.anims.create({
                key: 'drone-hover',
                // A primeira linha tem seis frames; o frame 6 é transparente.
                frames: scene.anims.generateFrameNumbers(drone.texture, { start: 0, end: 5 }),
                frameRate: 10,
                repeat: -1
            });
        }
        this.sprite.play('drone-hover');
        this.healthBar = scene.add.graphics().setDepth(25);
        this.drawHealthBar();
    }

    update(player?: Player) {
        if (!this.health.isAlive) return;
        const { drone } = WORLD_CONFIG;
        const body = this.sprite.body;

        if (!(body instanceof Physics.Arcade.Body)) {
            return;
        }

        const target = player?.health.isAlive ? player.sprite.body?.center : undefined;
        const distance = target ? Math.hypot(target.x - body.center.x, target.y - body.center.y) : Infinity;
        // A margem de saída evita alternar entre patrulha e perseguição na borda do raio.
        const radius = this.isChasing ? drone.loseTargetRadius : drone.detectionRadius;
        this.isChasing = !!target && distance <= radius && hasLineOfSight(this.walls, body.center, target);

        if (this.isChasing && target) {
            if (distance > drone.stopDistance) {
                body.setVelocity(
                    (target.x - body.center.x) / distance * drone.chaseSpeed,
                    (target.y - body.center.y) / distance * drone.chaseSpeed
                );
            } else {
                body.setVelocity(0, 0);
            }
            // Mantém a orientação ao seguir quase verticalmente, sem espelhar a cada quadro.
            if (Math.abs(target.x - body.center.x) > 2) {
                this.sprite.setFlipX(target.x < body.center.x);
            }
            this.drawHealthBar();
            return;
        }

        if (
            this.sprite.x <= this.spawn.patrolLeft
            || body.blocked.left
        ) {
            this.direction = 1;
        } else if (
            this.sprite.x >= this.spawn.patrolRight
            || body.blocked.right
        ) {
            this.direction = -1;
        }

        body.setVelocity(this.direction * drone.speed, 0);
        this.sprite.setFlipX(this.direction < 0);
        this.drawHealthBar();
    }

    takeDamage(amount: number) {
        if (!this.health.isAlive) return;
        this.health.takeDamage(amount);
        if (!this.health.isAlive) {
            const position = this.sprite.body?.center ?? this.sprite;
            const sound = AUDIO_CONFIG.effects.droneExplosion;
            this.scene.sound.play(sound.key, { volume: sound.volume });
            playDroneExplosion(this.scene, position.x, position.y);
            this.sprite.disableBody(true, true);
            this.healthBar.clear();
            return;
        }
        this.drawHealthBar();
        this.sprite.setTint(0xffaaaa);
        this.scene.time.delayedCall(120, () => {
            if (this.sprite.active) this.sprite.clearTint();
        });
    }

    private drawHealthBar() {
        const width = 30 * WORLD_CONFIG.drone.scale;
        const x = this.sprite.x - width / 2;
        const y = this.sprite.y - 21 * WORLD_CONFIG.drone.scale;
        this.healthBar.clear();
        this.healthBar.fillStyle(0x00171b).fillRect(x, y, width, 5);
        this.healthBar.fillStyle(0xff5050).fillRect(x + 1, y + 1, (width - 2) * this.health.current / this.health.max, 3);
    }

    private configureBody() {
        const body = this.sprite.body;

        if (body instanceof Physics.Arcade.Body) {
            const { hitbox } = WORLD_CONFIG.drone;
            body.setSize(hitbox.width, hitbox.height);
            body.setOffset(hitbox.offsetX, hitbox.offsetY);
            body.setImmovable(true);
            body.setAllowGravity(false);
        }
    }
}
