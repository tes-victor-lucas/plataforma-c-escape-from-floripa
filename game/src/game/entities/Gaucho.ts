import { Physics, type Scene } from 'phaser';
import { Health } from '../combat/Health';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG } from '../config/combat';
import { getActorDepth, WORLD_CONFIG } from '../config/world';
import { playDroneExplosion } from '../effects/playDroneExplosion';
import { hasLineOfSight } from '../map/hasLineOfSight';
import type { CombatEnemy, EnemySpawn } from './CombatEnemy';
import type { Player } from './Player';

// Linhas do spritesheet LPC, com 8 frames cada.
const WALK_DIRECTIONS = ['up', 'left', 'down', 'right'] as const;

export type GauchoCallbacks = {
    onDefeated?: (x: number, y: number) => void;
    onStrike?: (target: Player) => void;
};

function createGauchoId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `gaucho-${crypto.randomUUID()}`;
    }
    return `gaucho-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Persegue como o drone, mas encosta e bate de perto em vez de atirar. */
export class Gaucho implements CombatEnemy {
    readonly kind = 'gaucho' as const;
    readonly id = createGauchoId();
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.gaucho.maxHealth);

    private readonly healthBar: Phaser.GameObjects.Graphics;
    private patrolDirection = 1;
    private isChasing = false;
    private attackCooldown = 0;
    private knockbackRemaining = 0;
    private hitFlashSequence = 0;

    constructor(
        private readonly scene: Scene,
        private readonly spawn: EnemySpawn,
        private readonly walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly callbacks: GauchoCallbacks = {}
    ) {
        const { gaucho } = WORLD_CONFIG;
        this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, gaucho.texture, 0)
            .setScale(gaucho.scale)
            .setDepth(10)
            .setCollideWorldBounds(true);
        this.configureBody();
        WALK_DIRECTIONS.forEach((direction, row) => {
            if (scene.anims.exists(`gaucho-walk-${direction}`)) return;
            scene.anims.create({
                key: `gaucho-walk-${direction}`,
                frames: scene.anims.generateFrameNumbers(gaucho.texture, { start: row * 8, end: row * 8 + 7 }),
                frameRate: 10,
                repeat: -1
            });
        });
        this.sprite.play('gaucho-walk-down');
        if (spawn.health !== undefined) {
            this.health.takeDamage(this.health.max - Math.max(1, spawn.health));
        }
        this.healthBar = scene.add.graphics().setDepth(25);
        this.drawHealthBar();
    }

    update(player?: Player, delta = 0) {
        if (!this.health.isAlive) return;
        const body = this.sprite.body;
        if (!(body instanceof Physics.Arcade.Body)) return;
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);

        this.knockbackRemaining = Math.max(0, this.knockbackRemaining - Math.max(0, delta));
        if (this.knockbackRemaining > 0) {
            this.drawHealthBar();
            return;
        }

        const { drone, gaucho } = WORLD_CONFIG;
        const target = player?.health.isAlive ? player.sprite.body?.center : undefined;
        const distance = target ? Math.hypot(target.x - body.center.x, target.y - body.center.y) : Infinity;
        const radius = this.isChasing ? drone.loseTargetRadius : drone.detectionRadius;
        this.isChasing = !!target && distance <= radius && hasLineOfSight(this.walls, body.center, target);

        if (this.isChasing && target && player) {
            const dx = target.x - body.center.x;
            const dy = target.y - body.center.y;
            if (distance > gaucho.stopDistance) {
                body.setVelocity(dx / distance * drone.chaseSpeed, dy / distance * drone.chaseSpeed);
            } else {
                body.setVelocity(0, 0);
            }
            this.playWalk(dx, dy);
            if (distance <= COMBAT_CONFIG.gaucho.range && this.attackCooldown === 0) {
                player.takeDamage(COMBAT_CONFIG.gaucho.damage);
                this.callbacks.onStrike?.(player);
                this.attackCooldown = COMBAT_CONFIG.gaucho.attackInterval;
            }
            this.drawHealthBar();
            return;
        }

        if (this.sprite.x <= this.spawn.patrolLeft || body.blocked.left) this.patrolDirection = 1;
        else if (this.sprite.x >= this.spawn.patrolRight || body.blocked.right) this.patrolDirection = -1;
        body.setVelocity(this.patrolDirection * drone.speed, 0);
        this.playWalk(this.patrolDirection, 0);
        this.drawHealthBar();
    }

    takeDamage(amount: number, impactDirection?: Readonly<{ x: number; y: number }>) {
        if (!this.health.isAlive) return 0;
        const previousHealth = this.health.current;
        this.health.takeDamage(amount);
        const damage = previousHealth - this.health.current;
        this.applyHitFeedback(impactDirection);
        if (this.health.isAlive) {
            this.drawHealthBar();
            return damage;
        }
        this.healthBar.clear();
        if (impactDirection) {
            // Mantém o quadro branco visível durante o hit-stop antes da explosão.
            this.scene.time.delayedCall(WORLD_CONFIG.feedback.hitStopDuration, () => this.finishDeath());
        } else {
            this.finishDeath();
        }
        return damage;
    }

    /** No convidado o `update` não roda, e este método é chamado a cada snapshot. */
    drawHealthBar() {
        const body = this.sprite.body;
        this.sprite.setDepth(getActorDepth(body instanceof Physics.Arcade.Body ? body.bottom : this.sprite.y));
        const { scale } = WORLD_CONFIG.gaucho;
        const width = 30 * scale;
        const x = this.sprite.x - width / 2;
        const y = this.sprite.y - 21 * scale;
        this.healthBar.clear();
        this.healthBar.fillStyle(0x00171b).fillRect(x, y, width, 5);
        this.healthBar.fillStyle(0xff5050)
            .fillRect(x + 1, y + 1, (width - 2) * this.health.current / this.health.max, 3);
    }

    private playWalk(dx: number, dy: number) {
        const direction = Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? 'left' : 'right')
            : (dy < 0 ? 'up' : 'down');
        this.sprite.play(`gaucho-walk-${direction}`, true);
    }

    private finishDeath() {
        if (!this.sprite.active) return;
        const { x, y } = this.sprite.body?.center ?? this.sprite;
        const sound = AUDIO_CONFIG.effects.droneExplosion;
        const shake = COMBAT_CONFIG.drone.deathShake;
        this.scene.cameras.main.shake(shake.duration, shake.intensity);
        this.scene.sound.play(sound.key, { volume: sound.volume });
        playDroneExplosion(this.scene, x, y);
        this.sprite.disableBody(true, true);
        this.callbacks.onDefeated?.(x, y);
    }

    private applyHitFeedback(impactDirection?: Readonly<{ x: number; y: number }>) {
        const { enemyHitFlashDuration, enemyKnockbackDuration, enemyKnockbackSpeed } = WORLD_CONFIG.feedback;
        const flashSequence = ++this.hitFlashSequence;
        this.sprite.setTint(0xffffff);
        this.sprite.setTintMode?.(Phaser.TintModes.FILL);
        this.scene.time.delayedCall(enemyHitFlashDuration, () => {
            if (this.sprite.active && flashSequence === this.hitFlashSequence) this.sprite.clearTint();
        });

        const body = this.sprite.body;
        if (!impactDirection || !(body instanceof Physics.Arcade.Body)) return;
        const length = Math.hypot(impactDirection.x, impactDirection.y);
        if (length === 0) return;
        this.knockbackRemaining = enemyKnockbackDuration;
        body.setVelocity(
            impactDirection.x / length * enemyKnockbackSpeed,
            impactDirection.y / length * enemyKnockbackSpeed
        );
    }

    private configureBody() {
        const body = this.sprite.body;
        if (!(body instanceof Physics.Arcade.Body)) return;
        const { hitbox } = WORLD_CONFIG.gaucho;
        body.setSize(hitbox.width, hitbox.height);
        body.setOffset(hitbox.offsetX, hitbox.offsetY);
        body.pushable = false;
        body.setAllowGravity(false);
    }
}
