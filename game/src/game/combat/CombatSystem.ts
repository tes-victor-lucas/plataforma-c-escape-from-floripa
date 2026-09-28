import type { Physics, Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG } from '../config/combat';
import type { Drone } from '../entities/Drone';
import type { Player } from '../entities/Player';
import { hasLineOfSight } from '../map/hasLineOfSight';

type Fighter = Player | Drone;
type Weapon = typeof COMBAT_CONFIG.player | typeof COMBAT_CONFIG.drone;

/** Disparos automáticos, colisões e duração dos projéteis da sala. */
export class CombatSystem {
    private readonly playerShots: Physics.Arcade.Group;
    private readonly enemyShots: Physics.Arcade.Group;
    private readonly projectiles = new Map<Physics.Arcade.Image, number>();
    private playerCooldown = 0;
    private readonly droneCooldowns = new Map<Drone, number>();

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        private readonly drones: Drone[],
        private readonly walls: Phaser.Tilemaps.TilemapLayer[]
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
            if (!(shot as Physics.Arcade.Image).active || !drone.health.isAlive) return;
            this.removeShot(shot as Physics.Arcade.Image);
            drone.takeDamage(COMBAT_CONFIG.player.damage);
        });
    }

    update(delta: number) {
        for (const [shot, lifetime] of this.projectiles) {
            const remaining = lifetime - delta;
            if (remaining <= 0 || !this.scene.physics.world.bounds.contains(shot.x, shot.y)) {
                this.removeShot(shot);
            } else {
                this.projectiles.set(shot, remaining);
            }
        }
        if (!this.player.health.isAlive) return;

        this.playerCooldown = Math.max(0, this.playerCooldown - delta);
        let nearest: Drone | undefined;
        let nearestDistance = COMBAT_CONFIG.player.range ** 2;

        for (const drone of this.drones) {
            if (!drone.health.isAlive) continue;
            const cooldown = Math.max(0, (this.droneCooldowns.get(drone) ?? 0) - delta);
            this.droneCooldowns.set(drone, cooldown);
            const origin = this.getCenter(drone);
            const target = this.getCenter(this.player);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance > Math.max(COMBAT_CONFIG.player.range, COMBAT_CONFIG.drone.range) ** 2) continue;
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
            this.fire(this.player, nearest, this.playerShots, COMBAT_CONFIG.player);
            this.playerCooldown = COMBAT_CONFIG.player.fireInterval;
        }
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
        const shot = group.create(origin.x, origin.y, 'combat-projectile-rounded') as Physics.Arcade.Image;
        const { width, height, scale } = COMBAT_CONFIG.projectile;
        shot.setDepth(15).setTint(weapon.color);
        shot.setScale(scale).setRotation(angle);
        // Arcade usa caixas alinhadas aos eixos: ajusta a caixa à rotação visual.
        shot.setBodySize(
            Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height,
            Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height
        );
        shot.setVelocity(Math.cos(angle) * weapon.projectileSpeed, Math.sin(angle) * weapon.projectileSpeed);
        this.projectiles.set(shot, COMBAT_CONFIG.projectile.lifetime);
        const sound = source === this.player ? AUDIO_CONFIG.effects.playerShot : AUDIO_CONFIG.effects.enemyShot;
        this.scene.sound.play(sound.key, { volume: sound.volume });
    }

    private removeShot(shot: Physics.Arcade.Image) {
        this.projectiles.delete(shot);
        shot.destroy();
    }
}
