import { Math as PhaserMath, type Physics, type Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG } from '../config/combat';
import type { Drone } from '../entities/Drone';
import type { Player } from '../entities/Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDamageNumber } from '../effects/playDamageNumber';
import { WORLD_CONFIG } from '../config/world';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';

type Fighter = Player | Drone;
type Weapon = {
    damage: number;
    range: number;
    fireInterval: number;
    projectileSpeed: number;
    color: number;
};

type ProjectileState = {
    lifetime: number;
    damage: number;
    remainingPierces: number;
    hitDrones: Set<Drone>;
};

/** Disparos automáticos, colisões e duração dos projéteis da sala. */
export class CombatSystem {
    private readonly playerShots: Physics.Arcade.Group;
    private readonly enemyShots: Physics.Arcade.Group;
    private readonly projectiles = new Map<Physics.Arcade.Image, ProjectileState>();
    private playerCooldown = 0;
    private readonly droneCooldowns = new Map<Drone, number>();
    private companion?: Phaser.GameObjects.Sprite;
    private companionCooldown = 0;

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        private readonly drones: Drone[],
        private readonly walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly playerStats: PlayerUpgradeState = new PlayerUpgradeState()
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
        for (const drone of drones) {
            this.registerDrone(drone);
        }
        scene.physics.add.overlap(player.sprite, this.enemyShots, (_target, shot) => {
            if (!(shot as Physics.Arcade.Image).active || !player.health.isAlive) return;
            this.removeShot(shot as Physics.Arcade.Image);
            player.takeDamage(COMBAT_CONFIG.drone.damage);
        });
    }

    registerDrone(drone: Drone) {
        if (this.droneCooldowns.has(drone)) return;
        // Dá tempo de reagir também aos inimigos de uma nova onda.
        this.droneCooldowns.set(drone, COMBAT_CONFIG.drone.fireInterval);
        // Arcade entrega o sprite antes do membro do grupo no callback.
        this.scene.physics.add.overlap(drone.sprite, this.playerShots, (_target, shot) => {
            const projectile = shot as Physics.Arcade.Image;
            const state = this.projectiles.get(projectile);
            if (!projectile.active || !drone.health.isAlive || !state || state.hitDrones.has(drone)) return;

            state.hitDrones.add(drone);
            const damage = Math.min(state.damage, drone.health.current);
            const center = this.getCenter(drone);
            drone.takeDamage(state.damage);
            playDamageNumber(this.scene, center.x, center.y, damage);
            if (state.remainingPierces > 0) {
                state.remainingPierces -= 1;
            } else {
                this.removeShot(projectile);
            }
        });
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
        let nearest: Drone | undefined;
        let nearestDistance = this.playerStats.range ** 2;

        for (const drone of this.drones) {
            if (!drone.health.isAlive) continue;
            const cooldown = Math.max(0, (this.droneCooldowns.get(drone) ?? 0) - delta);
            this.droneCooldowns.set(drone, cooldown);
            const origin = this.getCenter(drone);
            const target = this.getCenter(this.player);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance > Math.max(this.playerStats.range, COMBAT_CONFIG.drone.range) ** 2) continue;
            if (!hasLineOfSight(this.walls, origin, target)) continue;

            if (distance <= nearestDistance) {
                nearest = drone;
                nearestDistance = distance;
            }
            if (distance <= COMBAT_CONFIG.drone.range ** 2 && cooldown === 0) {
                this.fire(drone, this.player, this.enemyShots, COMBAT_CONFIG.drone);
                this.droneCooldowns.set(drone, COMBAT_CONFIG.drone.fireInterval);
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

    private firePlayer(target: Drone) {
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
        const { width, height, scale } = COMBAT_CONFIG.projectile;
        shot.setDepth(15).setTint(weapon.color);
        shot.setScale(scale).setRotation(angle);
        shot.setBodySize(
            Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height,
            Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height
        );
        shot.setVelocity(Math.cos(angle) * weapon.projectileSpeed, Math.sin(angle) * weapon.projectileSpeed);
        this.projectiles.set(shot, {
            lifetime: COMBAT_CONFIG.projectile.lifetime,
            damage: weapon.damage,
            remainingPierces,
            hitDrones: new Set()
        });
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

        const ratio = 0.4;
        const origin = { x: this.companion.x, y: this.companion.y };
        const target = this.findNearestDrone(origin, this.playerStats.range * ratio);
        if (!target) return;
        const destination = this.getCenter(target);
        const angle = Math.atan2(destination.y - origin.y, destination.x - origin.x);
        const weapon: Weapon = {
            range: this.playerStats.range * ratio,
            damage: this.playerStats.damage * ratio,
            projectileSpeed: this.playerStats.projectileSpeed * ratio,
            fireInterval: this.playerStats.fireInterval / ratio,
            color: 0x39ff14
        };
        this.createProjectile(origin, angle, this.playerShots, weapon, 0);
        this.companionCooldown = weapon.fireInterval;
    }

    private findNearestDrone(origin: { x: number; y: number }, range: number) {
        let nearest: Drone | undefined;
        let nearestDistance = range ** 2;
        for (const drone of this.drones) {
            if (!drone.health.isAlive) continue;
            const target = this.getCenter(drone);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance <= nearestDistance && hasLineOfSight(this.walls, origin, target)) {
                nearest = drone;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private removeShot(shot: Physics.Arcade.Image) {
        this.projectiles.delete(shot);
        shot.destroy();
    }
}
