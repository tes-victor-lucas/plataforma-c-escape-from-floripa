import { Physics, type Scene } from 'phaser';
import { Health } from '../combat/Health';
import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import { hasLineOfSight } from '../map/hasLineOfSight';
import type { CombatEnemy, EnemySpawn } from './CombatEnemy';
import {
    directionFromVector,
    enemyFrame,
    enemyWalkFrames,
    type EnemyDirection
} from './EnemyAnimation';
import type { Player } from './Player';

type ScooterState = 'approach' | 'windup' | 'charge' | 'recover';

function createScooterId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `scooter-${crypto.randomUUID()}`;
    }
    return `scooter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Patinete autônomo que avisa, trava a direção e investe contra o jogador. */
export class Patinete implements CombatEnemy {
    readonly kind = 'scooter' as const;
    readonly id = createScooterId();
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.scooter.maxHealth);

    private readonly healthBar: Phaser.GameObjects.Graphics;
    private state: ScooterState = 'approach';
    relentless = false;
    pathfinder?: CombatEnemy['pathfinder'];
    private stateTimer = 0;
    private direction: EnemyDirection = 'down';
    private chargeVector = { x: 0, y: 1 };
    private patrolDirection = 1;
    private hitFlashSequence = 0;

    constructor(
        private readonly scene: Scene,
        private readonly spawn: EnemySpawn,
        private readonly walls: Phaser.Tilemaps.TilemapLayer[]
    ) {
        const config = WORLD_CONFIG.scooter;
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

        const target = player?.health.isAlive ? player.sprite.body?.center : undefined;
        const origin = body.center;
        const dx = target ? target.x - origin.x : 0;
        const dy = target ? target.y - origin.y : 0;
        const distance = target ? Math.hypot(dx, dy) : Infinity;

        if (this.state === 'windup') {
            body.setVelocity(0, 0);
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'charge';
                this.stateTimer = COMBAT_CONFIG.scooter.chargeDuration;
                this.sprite.setFrame(enemyFrame(this.direction, 5));
            }
            this.drawHealthBar();
            return;
        }

        if (this.state === 'charge') {
            this.stateTimer -= delta;
            body.setVelocity(
                this.chargeVector.x * COMBAT_CONFIG.scooter.chargeSpeed,
                this.chargeVector.y * COMBAT_CONFIG.scooter.chargeSpeed
            );
            if (target && distance <= COMBAT_CONFIG.scooter.impactDistance) {
                player?.takeDamage(COMBAT_CONFIG.scooter.contactDamage);
                this.startRecovery();
            } else if (
                this.stateTimer <= 0
                || body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down
            ) {
                this.startRecovery();
            }
            this.drawHealthBar();
            return;
        }

        if (this.state === 'recover') {
            body.setVelocity(0, 0);
            this.stateTimer -= delta;
            if (this.stateTimer <= 0) {
                this.state = 'approach';
                this.playMovement();
            }
            this.drawHealthBar();
            return;
        }

        if (
            target
            && (this.relentless || (
                distance <= COMBAT_CONFIG.scooter.detectionRadius
                && hasLineOfSight(this.walls, origin, target)
            ))
        ) {
            const heading = this.relentless ? this.pathfinder?.(origin) : undefined;
            this.direction = directionFromVector(heading?.x ?? dx, heading?.y ?? dy, this.direction);
            // Na horda ele pode estar atrás de um obstáculo: só investe com caminho livre.
            if (
                distance <= COMBAT_CONFIG.scooter.chargeRange
                && (!this.relentless || hasLineOfSight(this.walls, origin, target))
            ) {
                const length = Math.max(1, distance);
                this.chargeVector = { x: dx / length, y: dy / length };
                this.state = 'windup';
                this.stateTimer = COMBAT_CONFIG.scooter.chargeWindup;
                body.setVelocity(0, 0);
                this.sprite.anims.stop();
                this.sprite.setFrame(enemyFrame(this.direction, 4));
            } else {
                const move = heading ?? { x: dx / distance, y: dy / distance };
                body.setVelocity(
                    move.x * COMBAT_CONFIG.scooter.approachSpeed,
                    move.y * COMBAT_CONFIG.scooter.approachSpeed
                );
                this.playMovement();
            }
        } else {
            if (this.sprite.x <= this.spawn.patrolLeft || body.blocked.left) this.patrolDirection = 1;
            else if (this.sprite.x >= this.spawn.patrolRight || body.blocked.right) this.patrolDirection = -1;
            this.direction = this.patrolDirection < 0 ? 'left' : 'right';
            body.setVelocity(this.patrolDirection * COMBAT_CONFIG.scooter.approachSpeed * 0.55, 0);
            this.playMovement();
        }
        this.drawHealthBar();
    }

    takeDamage(amount: number) {
        if (!this.health.isAlive) return 0;
        const previousHealth = this.health.current;
        this.health.takeDamage(amount);
        const damage = previousHealth - this.health.current;
        this.flashHit();
        if (!this.health.isAlive) this.finishDeath();
        else this.drawHealthBar();
        return damage;
    }

    private startRecovery() {
        this.state = 'recover';
        this.stateTimer = COMBAT_CONFIG.scooter.recoveryDuration;
        this.sprite.setVelocity(0, 0);
        this.sprite.anims.stop();
        this.sprite.setFrame(enemyFrame(this.direction, 6));
    }

    private playMovement() {
        this.sprite.play(`scooter-move-${this.direction}`, true);
    }

    private createAnimations() {
        for (const direction of ['down', 'left', 'right', 'up'] as const) {
            const key = `scooter-move-${direction}`;
            if (this.scene.anims.exists(key)) continue;
            this.scene.anims.create({
                key,
                frames: enemyWalkFrames(direction).map((frame) => ({
                    key: WORLD_CONFIG.scooter.texture,
                    frame
                })),
                frameRate: 10,
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
        this.scene.cameras.main.shake(90, 0.0025);
        this.scene.tweens.add({
            targets: this.sprite,
            alpha: 0,
            delay: 280,
            duration: 220,
            onComplete: () => this.sprite.destroy()
        });
    }

    private flashHit() {
        const sequence = ++this.hitFlashSequence;
        this.sprite.setTint(0xffffff);
        this.sprite.setTintMode?.(Phaser.TintModes.FILL);
        this.scene.time.delayedCall(WORLD_CONFIG.feedback.enemyHitFlashDuration, () => {
            if (this.sprite.active && sequence === this.hitFlashSequence) this.sprite.clearTint();
        });
    }

    drawHealthBar() {
        const width = 27;
        const x = this.sprite.x - width / 2;
        const y = this.sprite.y - 18;
        this.healthBar.clear();
        this.healthBar.fillStyle(0x00171b).fillRect(x, y, width, 5);
        this.healthBar.fillStyle(0xff5050)
            .fillRect(x + 1, y + 1, (width - 2) * this.health.current / this.health.max, 3);
    }

    private configureBody() {
        const body = this.sprite.body;
        if (!(body instanceof Physics.Arcade.Body)) return;
        const { hitbox } = WORLD_CONFIG.scooter;
        body.setSize(hitbox.width, hitbox.height);
        body.setOffset(hitbox.offsetX, hitbox.offsetY);
        body.pushable = false;
        body.setAllowGravity(false);
    }
}
