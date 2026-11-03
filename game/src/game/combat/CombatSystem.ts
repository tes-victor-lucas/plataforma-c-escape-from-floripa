import { Math as PhaserMath, type Physics, type Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG } from '../config/combat';
import type { CombatEnemy } from '../entities/CombatEnemy';
import type { Player } from '../entities/Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDamageNumber } from '../effects/playDamageNumber';
import { WORLD_CONFIG } from '../config/world';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import { runTracker, type RunTracker } from '../scoring/RunTracker';

type Fighter = Player | CombatEnemy;
type Weapon = {
    damage: number;
    range: number;
    fireInterval: number;
    projectileSpeed: number;
    color: number;
};

type ProjectileState = {
    id: string;
    lifetime: number;
    damage: number;
    remainingPierces: number;
    hitEnemies: Set<CombatEnemy>;
};

let fallbackProjectileSequence = 0;

/** Mantém a identidade do projétil única mesmo ao trocar de sala. */
export function createProjectileId(runId = 'untracked') {
    const uniquePart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${fallbackProjectileSequence++}`;
    return `${runId}:projectile-${uniquePart}`;
}

/** Disparos automáticos, colisões e duração dos projéteis da sala. */
export class CombatSystem {
    private readonly playerShots: Physics.Arcade.Group;
    private readonly enemyShots: Physics.Arcade.Group;
    private readonly projectiles = new Map<Physics.Arcade.Image, ProjectileState>();
    private playerCooldown = 0;
    private readonly enemyCooldowns = new Map<CombatEnemy, number>();
    private companion?: Phaser.GameObjects.Sprite;
    private companionCooldown = 0;

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        private readonly enemies: CombatEnemy[],
        private readonly walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly playerStats: PlayerUpgradeState = new PlayerUpgradeState(),
        private readonly tracker: RunTracker = runTracker,
        private readonly onEnemyKilled: () => void = () => undefined
    ) {
        const texture = 'combat-projectile-rounded';
        if (!scene.textures.exists(texture)) {
            const { width, height, cornerRadius } = COMBAT_CONFIG.projectile;
            const graphics = scene.add.graphics();
            graphics.fillStyle(0xffffff).fillRoundedRect(1, 1, width, height, cornerRadius);
            graphics.generateTexture(texture, width + 2, height + 2);
            graphics.destroy();
        }
        this.playerShots = scene.physics.add.group({ allowGravity: false });
        this.enemyShots = scene.physics.add.group({ allowGravity: false });

        for (const wall of walls) {
            for (const group of [this.playerShots, this.enemyShots]) {
                scene.physics.add.collider(group, wall, (shot) => this.removeShot(shot as Physics.Arcade.Image));
            }
        }
        for (const enemy of enemies) {
            this.registerEnemy(enemy);
        }
        scene.physics.add.overlap(player.sprite, this.enemyShots, (_target, shot) => {
            if (!(shot as Physics.Arcade.Image).active || !player.health.isAlive) return;
            this.removeShot(shot as Physics.Arcade.Image);
            player.takeDamage(COMBAT_CONFIG.drone.damage);
        });
    }

    registerEnemy(enemy: CombatEnemy) {
        if (this.enemyCooldowns.has(enemy)) return;
        // Inimigos sem `kind` são dublês de testes antigos e continuam como drones.
        const isRanged = enemy.kind === 'drone' || enemy.kind === undefined;
        this.enemyCooldowns.set(enemy, isRanged ? COMBAT_CONFIG.drone.fireInterval : 0);
        // Arcade entrega o sprite antes do membro do grupo no callback.
        this.scene.physics.add.overlap(enemy.sprite, this.playerShots, (_target, shot) => {
            const projectile = shot as Physics.Arcade.Image;
            const state = this.projectiles.get(projectile);
            if (!projectile.active || !enemy.health.isAlive || !state || state.hitEnemies.has(enemy)) return;

            state.hitEnemies.add(enemy);
            const previousHealth = enemy.health.current;
            const center = this.getCenter(enemy);
            const wasAlive = enemy.health.isAlive;
            const reportedDamage = enemy.takeDamage(state.damage, {
                x: Math.cos(projectile.rotation),
                y: Math.sin(projectile.rotation)
            });
            const damage = typeof reportedDamage === 'number'
                ? reportedDamage
                : previousHealth - enemy.health.current;
            if (wasAlive && !enemy.health.isAlive) {
                this.tracker.recordEnemyDeath(enemy.id, state.id);
                this.onEnemyKilled();
            }
            if (damage > 0) playDamageNumber(this.scene, center.x, center.y, damage);
            if (state.remainingPierces > 0) {
                state.remainingPierces -= 1;
            } else {
                this.removeShot(projectile);
            }
        });
    }

    /** Compatibilidade com chamadas e testes anteriores à introdução de tipos de inimigo. */
    registerDrone(enemy: CombatEnemy) {
        this.registerEnemy(enemy);
    }

    update(delta: number) {
        for (const [shot, state] of this.projectiles) {
            state.lifetime -= delta;
            if (state.lifetime <= 0 || !this.scene.physics.world.bounds.contains(shot.x, shot.y)) {
                this.removeShot(shot);
            }
        }
        if (!this.player.health.isAlive) return;

        this.playerCooldown = Math.max(0, this.playerCooldown - delta);
        let nearest: CombatEnemy | undefined;
        let nearestDistance = this.playerStats.range ** 2;

        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive) continue;
            const cooldown = Math.max(0, (this.enemyCooldowns.get(enemy) ?? 0) - delta);
            this.enemyCooldowns.set(enemy, cooldown);
            const origin = this.getCenter(enemy);
            const target = this.getCenter(this.player);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance > Math.max(this.playerStats.range, COMBAT_CONFIG.drone.range) ** 2) continue;
            if (!hasLineOfSight(this.walls, origin, target)) continue;

            if (distance <= nearestDistance) {
                nearest = enemy;
                nearestDistance = distance;
            }
            const isRanged = enemy.kind === 'drone' || enemy.kind === undefined;
            if (isRanged && distance <= COMBAT_CONFIG.drone.range ** 2 && cooldown === 0) {
                this.fire(enemy, this.player, this.enemyShots, COMBAT_CONFIG.drone);
                this.enemyCooldowns.set(enemy, COMBAT_CONFIG.drone.fireInterval);
            }
        }
        if (nearest && this.playerCooldown === 0) {
            this.firePlayer(nearest);
            this.playerCooldown = this.playerStats.fireInterval;
        }
        this.updateCompanion(delta);
    }

    clear() {
        for (const shot of this.projectiles.keys()) this.removeShot(shot);
    }

    private getCenter(fighter: Fighter) {
        return fighter.sprite.body!.center;
    }

    private fire(source: Fighter, target: Fighter, group: Physics.Arcade.Group, weapon: Weapon) {
        const origin = this.getCenter(source);
        const destination = this.getCenter(target);
        const angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
        this.createProjectile(origin, angle, group, weapon, 0);
        const sound = source === this.player ? AUDIO_CONFIG.effects.playerShot : AUDIO_CONFIG.effects.enemyShot;
        this.scene.sound.play(sound.key, { volume: sound.volume });
    }

    private firePlayer(target: CombatEnemy) {
        const origin = this.getCenter(this.player);
        const destination = this.getCenter(target);
        const angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
        const weapon: Weapon = {
            range: this.playerStats.range,
            damage: this.playerStats.damage,
            projectileSpeed: this.playerStats.projectileSpeed,
            fireInterval: this.playerStats.fireInterval,
            color: COMBAT_CONFIG.player.color
        };
        const spacing = 7;

        for (let index = 0; index < this.playerStats.projectileCount; index += 1) {
            const offset = (index - (this.playerStats.projectileCount - 1) / 2) * spacing;
            this.createProjectile(
                { x: origin.x - Math.sin(angle) * offset, y: origin.y + Math.cos(angle) * offset },
                angle,
                this.playerShots,
                weapon,
                this.playerStats.piercingTargets
            );
        }
        const sound = AUDIO_CONFIG.effects.playerShot;
        this.scene.sound.play(sound.key, { volume: sound.volume });
    }

    private createProjectile(
        origin: { x: number; y: number },
        angle: number,
        group: Physics.Arcade.Group,
        weapon: Weapon,
        remainingPierces: number
    ) {
        const shot = group.create(origin.x, origin.y, 'combat-projectile-rounded') as Physics.Arcade.Image;
        const id = createProjectileId(this.tracker.snapshot().runId);
        const { width, height, scale } = COMBAT_CONFIG.projectile;
        shot.setDepth(15).setTint(weapon.color);
        shot.setScale(scale).setRotation(angle);
        shot.setBodySize(
            Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height,
            Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height
        );
        shot.setVelocity(Math.cos(angle) * weapon.projectileSpeed, Math.sin(angle) * weapon.projectileSpeed);
        this.projectiles.set(shot, {
            id,
            lifetime: COMBAT_CONFIG.projectile.lifetime,
            damage: weapon.damage,
            remainingPierces,
            hitEnemies: new Set()
        });
        this.tracker.registerProjectile(id);
    }

    private updateCompanion(delta: number) {
        if (this.playerStats.companionCount === 0) return;
        const playerCenter = this.getCenter(this.player);
        if (!this.companion) {
            this.companion = this.scene.add.sprite(
                playerCenter.x - 18,
                playerCenter.y - 18,
                WORLD_CONFIG.drone.texture,
                0
            ).setScale(WORLD_CONFIG.drone.scale * 0.48).setTint(0x8affc1).setDepth(9);
        }

        const interpolation = 1 - Math.exp(-8 * delta / 1000);
        this.companion.setPosition(
            PhaserMath.Linear(this.companion.x, playerCenter.x - 18, interpolation),
            PhaserMath.Linear(this.companion.y, playerCenter.y - 18, interpolation)
        );
        this.companionCooldown = Math.max(0, this.companionCooldown - delta);
        if (this.companionCooldown > 0) return;

        const statRatio = this.playerStats.companionStatRatio;
        const damageRatio = this.playerStats.companionDamageRatio;
        if (statRatio <= 0 || damageRatio <= 0) return;
        const origin = { x: this.companion.x, y: this.companion.y };
        const target = this.findNearestEnemy(origin, this.playerStats.range * statRatio);
        if (!target) return;
        const destination = this.getCenter(target);
        const angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
        const weapon: Weapon = {
            range: this.playerStats.range * statRatio,
            damage: Math.max(1, Math.round(this.playerStats.damage * damageRatio)),
            projectileSpeed: this.playerStats.projectileSpeed * statRatio,
            fireInterval: this.playerStats.fireInterval / statRatio,
            color: 0x39ff14
        };
        this.createProjectile(origin, angle, this.playerShots, weapon, 0);
        this.companionCooldown = weapon.fireInterval;
    }

    private findNearestEnemy(origin: { x: number; y: number }, range: number) {
        let nearest: CombatEnemy | undefined;
        let nearestDistance = range ** 2;
        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive) continue;
            const target = this.getCenter(enemy);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance <= nearestDistance && hasLineOfSight(this.walls, origin, target)) {
                nearest = enemy;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private removeShot(shot: Physics.Arcade.Image) {
        const state = this.projectiles.get(shot);
        if (state) this.tracker.finalizeProjectile(state.id);
        this.projectiles.delete(shot);
        if (shot.active) shot.destroy();
    }
}
