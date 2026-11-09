import { Physics, type Scene } from 'phaser';
import { WORLD_CONFIG } from '../config/world';
import { COMBAT_CONFIG } from '../config/combat';
import { AUDIO_CONFIG } from '../config/audio';
import { Health } from '../combat/Health';
import type { Player } from './Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDroneExplosion } from '../effects/playDroneExplosion';
import type { CombatEnemy, EnemySpawn } from './CombatEnemy';

function createDroneId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `drone-${crypto.randomUUID()}`;
    }
    return `drone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Exibe e movimenta o drone inimigo na sala. */
export class Drone implements CombatEnemy {
    readonly kind = 'drone' as const;
    readonly id = createDroneId();
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.drone.maxHealth);

    private direction = 1;
    private isChasing = false;
    relentless = false;
    pathfinder?: CombatEnemy['pathfinder'];
    private readonly healthBar: Phaser.GameObjects.Graphics;
    private knockbackRemaining = 0;
    private hitFlashSequence = 0;

    constructor(
        private readonly scene: Scene,
        private readonly spawn: EnemySpawn,
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
        if (spawn.health !== undefined) {
            this.health.takeDamage(this.health.max - Math.max(1, spawn.health));
        }
        this.healthBar = scene.add.graphics().setDepth(25);
        this.drawHealthBar();
    }

    update(player?: Player, delta = 0) {
        if (!this.health.isAlive) return;
        const { drone } = WORLD_CONFIG;
        const body = this.sprite.body;

        if (!(body instanceof Physics.Arcade.Body)) {
            return;
        }

        this.knockbackRemaining = Math.max(0, this.knockbackRemaining - Math.max(0, delta));
        if (this.knockbackRemaining > 0) {
            this.drawHealthBar();
            return;
        }

        const target = player?.health.isAlive ? player.sprite.body?.center : undefined;
        const distance = target ? Math.hypot(target.x - body.center.x, target.y - body.center.y) : Infinity;
        // A margem de saída evita alternar entre patrulha e perseguição na borda do raio.
        const radius = this.isChasing ? drone.loseTargetRadius : drone.detectionRadius;
        this.isChasing = !!target
            && (this.relentless || (distance <= radius && hasLineOfSight(this.walls, body.center, target)));

        if (this.isChasing && target) {
            if (distance > drone.stopDistance) {
                const heading = (this.relentless ? this.pathfinder?.(body.center) : undefined)
                    ?? { x: (target.x - body.center.x) / distance, y: (target.y - body.center.y) / distance };
                body.setVelocity(heading.x * drone.chaseSpeed, heading.y * drone.chaseSpeed);
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

    takeDamage(amount: number, impactDirection?: Readonly<{ x: number; y: number }>) {
        if (!this.health.isAlive) return 0;
        const previousHealth = this.health.current;
        this.health.takeDamage(amount);
        const damage = previousHealth - this.health.current;
        this.applyHitFeedback(impactDirection);
        if (!this.health.isAlive) {
            this.healthBar.clear();
            if (impactDirection) {
                // Mantém o quadro branco visível durante o hit-stop antes da explosão.
                this.scene.time.delayedCall(
                    WORLD_CONFIG.feedback.hitStopDuration,
                    () => this.finishDeath()
                );
            } else {
                this.finishDeath();
            }
            return damage;
        }
        this.drawHealthBar();
        return damage;
    }

    private finishDeath() {
        if (!this.sprite.active) return;
        const position = this.sprite.body?.center ?? this.sprite;
        const sound = AUDIO_CONFIG.effects.droneExplosion;
        const shake = COMBAT_CONFIG.drone.deathShake;
        this.scene.cameras.main.shake(shake.duration, shake.intensity);
        this.scene.sound.play(sound.key, { volume: sound.volume });
        playDroneExplosion(this.scene, position.x, position.y);
        this.sprite.disableBody(true, true);
    }

    private applyHitFeedback(impactDirection?: Readonly<{ x: number; y: number }>) {
        const feedback = WORLD_CONFIG.feedback;
        const flashSequence = ++this.hitFlashSequence;
        this.sprite.setTint(0xffffff);
        this.sprite.setTintMode?.(Phaser.TintModes.FILL);
        this.scene.time.delayedCall(feedback.enemyHitFlashDuration, () => {
            if (this.sprite.active && flashSequence === this.hitFlashSequence) {
                this.sprite.clearTint();
            }
        });

        const body = this.sprite.body;
        if (!impactDirection || !(body instanceof Physics.Arcade.Body)) return;
        const length = Math.hypot(impactDirection.x, impactDirection.y);
        if (length === 0) return;

        this.knockbackRemaining = feedback.enemyKnockbackDuration;
        body.setVelocity(
            impactDirection.x / length * feedback.enemyKnockbackSpeed,
            impactDirection.y / length * feedback.enemyKnockbackSpeed
        );
    }

    drawHealthBar() {
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
            // Continua bloqueando o jogador, mas pode ser separado de outro drone.
            body.pushable = false;
            body.setAllowGravity(false);
        }
    }
}
