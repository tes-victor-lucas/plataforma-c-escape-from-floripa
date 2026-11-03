import { Physics, type Scene } from 'phaser';
import { Health } from '../combat/Health';
import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import { hasLineOfSight } from '../map/hasLineOfSight';
import type { CombatEnemy, EnemySpawn } from './CombatEnemy';
import {
    directionFromVector,
    directionVector,
    enemyFrame,
    enemyWalkFrames,
    type EnemyDirection
} from './EnemyAnimation';
import type { Player } from './Player';

type GuardState = 'approach' | 'windup' | 'recover';

function createGuardId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `guard-${crypto.randomUUID()}`;
    }
    return `guard-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isShieldedHit(
    direction: EnemyDirection,
    impactDirection?: Readonly<{ x: number; y: number }>
) {
    if (!impactDirection) return false;
    const length = Math.hypot(impactDirection.x, impactDirection.y);
    if (length === 0) return false;
    const facing = directionVector(direction);
    const dot = facing.x * impactDirection.x / length + facing.y * impactDirection.y / length;
    return dot <= COMBAT_CONFIG.guard.shieldArcDot;
}

/** Guarda blindado: avança com escudo frontal e ataca de perto após telegrafar. */
export class GuardaCyber implements CombatEnemy {
    readonly kind = 'guard' as const;
    readonly id = createGuardId();
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.guard.maxHealth);

    private readonly healthBar: Phaser.GameObjects.Graphics;
    private state: GuardState = 'approach';
    private stateTimer = 0;
    private attackCooldown = 0;
    private direction: EnemyDirection = 'down';
    private patrolDirection = 1;
    private hitFlashSequence = 0;

    constructor(
        private readonly scene: Scene,
        private readonly spawn: EnemySpawn,
        private readonly walls: Phaser.Tilemaps.TilemapLayer[]
    ) {
        const config = WORLD_CONFIG.guard;
        this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, config.texture, 0)
            .setScale(config.scale)
            .setDepth(10)
            .setCollideWorldBounds(true);
        this.configureBody();
        this.createAnimations();
        this.playMovement();
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

        const target = player?.health.isAlive ? player.sprite.body?.center : undefined;
        const origin = body.center;
        const dx = target ? target.x - origin.x : 0;
        const dy = target ? target.y - origin.y : 0;
        const distance = target ? Math.hypot(dx, dy) : Infinity;
        if (target) this.direction = directionFromVector(dx, dy, this.direction);

        if (this.state === 'windup') {
            body.setVelocity(0, 0);
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.sprite.setFrame(enemyFrame(this.direction, 6));
                if (player?.health.isAlive && distance <= COMBAT_CONFIG.guard.meleeRange + 8) {
                    player.takeDamage(COMBAT_CONFIG.guard.meleeDamage);
                }
                this.state = 'recover';
                this.stateTimer = COMBAT_CONFIG.guard.attackRecovery;
                this.attackCooldown = COMBAT_CONFIG.guard.attackCooldown;
            }
            this.drawHealthBar();
            return;
        }

        if (this.state === 'recover') {
            body.setVelocity(0, 0);
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) this.state = 'approach';
            this.drawHealthBar();
            return;
        }

        if (
            target
            && distance <= COMBAT_CONFIG.guard.detectionRadius
            && hasLineOfSight(this.walls, origin, target)
        ) {
            if (distance <= COMBAT_CONFIG.guard.meleeRange && this.attackCooldown === 0) {
                this.state = 'windup';
                this.stateTimer = COMBAT_CONFIG.guard.attackWindup;
                body.setVelocity(0, 0);
                this.sprite.anims.stop();
                this.sprite.setFrame(enemyFrame(this.direction, 5));
            } else if (distance > COMBAT_CONFIG.guard.stopDistance) {
                body.setVelocity(
                    dx / distance * COMBAT_CONFIG.guard.movementSpeed,
                    dy / distance * COMBAT_CONFIG.guard.movementSpeed
                );
                this.playMovement();
            } else {
                body.setVelocity(0, 0);
                this.sprite.anims.stop();
                this.sprite.setFrame(enemyFrame(this.direction, 4));
            }
        } else {
            if (this.sprite.x <= this.spawn.patrolLeft || body.blocked.left) this.patrolDirection = 1;
            else if (this.sprite.x >= this.spawn.patrolRight || body.blocked.right) this.patrolDirection = -1;
            this.direction = this.patrolDirection < 0 ? 'left' : 'right';
            body.setVelocity(this.patrolDirection * COMBAT_CONFIG.guard.movementSpeed * 0.6, 0);
            this.playMovement();
        }
        this.drawHealthBar();
    }

    takeDamage(amount: number, impactDirection?: Readonly<{ x: number; y: number }>) {
        if (!this.health.isAlive) return 0;
        const blocked = isShieldedHit(this.direction, impactDirection);
        const appliedAmount = blocked
            ? Math.max(1, Math.round(amount * COMBAT_CONFIG.guard.shieldDamageMultiplier))
            : amount;
        const previousHealth = this.health.current;
        this.health.takeDamage(appliedAmount);
        const damage = previousHealth - this.health.current;
        this.flashHit(blocked ? 0x63f3ff : 0xffffff);
        if (!this.health.isAlive) this.finishDeath();
        else this.drawHealthBar();
        return damage;
    }

    private playMovement() {
        this.sprite.play(`guard-move-${this.direction}`, true);
    }

    private createAnimations() {
        for (const direction of ['down', 'left', 'right', 'up'] as const) {
            const key = `guard-move-${direction}`;
            if (this.scene.anims.exists(key)) continue;
            this.scene.anims.create({
                key,
                frames: enemyWalkFrames(direction).map((frame) => ({
                    key: WORLD_CONFIG.guard.texture,
                    frame
                })),
                frameRate: 7,
                repeat: -1
            });
        }
    }

    private finishDeath() {
        this.healthBar.clear();
        this.sprite.anims.stop();
        this.sprite.setFrame(enemyFrame(this.direction, 7)).setVelocity(0, 0);
        const body = this.sprite.body;
        if (body instanceof Physics.Arcade.Body) body.enable = false;
        this.scene.cameras.main.shake(110, 0.003);
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            delay: 380,
            duration: 260,
            onComplete: () => this.sprite.destroy()
        });
    }

    private flashHit(color: number) {
        const sequence = ++this.hitFlashSequence;
        this.sprite.setTint(color);
        this.sprite.setTintMode?.(Phaser.TintModes.FILL);
        this.scene.time.delayedCall(WORLD_CONFIG.feedback.enemyHitFlashDuration, () => {
            if (this.sprite.active && sequence === this.hitFlashSequence) this.sprite.clearTint();
        });
    }

    private drawHealthBar() {
        const width = 31;
        const x = this.sprite.x - width / 2;
        const y = this.sprite.y - 19;
        this.healthBar.clear();
        this.healthBar.fillStyle(0x00171b).fillRect(x, y, width, 5);
        this.healthBar.fillStyle(0xff5050)
            .fillRect(x + 1, y + 1, (width - 2) * this.health.current / this.health.max, 3);
    }

    private configureBody() {
        const body = this.sprite.body;
        if (!(body instanceof Physics.Arcade.Body)) return;
        const { hitbox } = WORLD_CONFIG.guard;
        body.setSize(hitbox.width, hitbox.height);
        body.setOffset(hitbox.offsetX, hitbox.offsetY);
        body.pushable = false;
        body.setAllowGravity(false);
    }
}
