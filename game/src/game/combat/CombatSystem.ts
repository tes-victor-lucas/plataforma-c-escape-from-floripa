import { Math as PhaserMath, type Physics, type Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG } from '../config/combat';
import type { CombatEnemy } from '../entities/CombatEnemy';
import type { Player } from '../entities/Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDamageNumber } from '../effects/playDamageNumber';
import { playSwordHit } from '../effects/playSwordHit';
import { playBeams, playExplosion, playLightning, playShockwave } from '../effects/playAreaEffects';
import { WORLD_CONFIG } from '../config/world';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import { runTracker, type RunTracker } from '../scoring/RunTracker';
import type { PlayerEffect } from '../network/protocol';

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

/** Ligações opcionais do multiplayer; sem elas o combate segue como em uma partida solo. */
export type CombatNetwork = {
    isHost: boolean;
    getEnemyTarget(origin: { x: number; y: number }): Fighter | undefined;
    onEnemyShot(x: number, y: number, angle: number): void;
    onPlayerShot(x: number, y: number, angle: number, speed: number, color: number): void;
    onPlayerSwing(x: number, y: number, angle: number): void;
    onPlayerEffect(effect: PlayerEffect): void;
    onEnemyHit(enemy: CombatEnemy, damage: number, direction: { x: number; y: number }): void;
};

// Metade da largura do feixe de luz, em pixels do mundo.
const BEAM_HALF_WIDTH = 10;

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
    private playerFireRateMultiplier = 1;
    private readonly enemyCooldowns = new Map<CombatEnemy, number>();
    private companion?: Phaser.GameObjects.Sprite;
    private companionCooldown = 0;
    private heldSword?: Phaser.GameObjects.Image;
    private isSwingQueued = false;
    private pulseCooldown = 0;
    private chainCooldown = 0;
    private beamCooldown = 0;
    private beamAngle = 0;
    private orbitAngle = 0;
    private readonly orbitSparks: { core: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc }[] = [];
    private readonly orbitHits = new Map<CombatEnemy, number>();
    private network?: CombatNetwork;
    private partnerShots?: Physics.Arcade.Group;
    private readonly partnerShotLifetimes = new Map<Physics.Arcade.Image, number>();

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        private readonly enemies: CombatEnemy[],
        private readonly walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly playerStats: PlayerUpgradeState = new PlayerUpgradeState(),
        private readonly tracker: RunTracker = runTracker,
        private readonly onEnemyKilled: () => void = () => undefined,
        private readonly melee = false
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
        if (this.partnerShots) {
            this.scene.physics.add.overlap(enemy.sprite, this.partnerShots, (_target, shot) => {
                if (enemy.health.isAlive) this.removePartnerShot(shot as Physics.Arcade.Image);
            });
        }
        // Arcade entrega o sprite antes do membro do grupo no callback.
        this.scene.physics.add.overlap(enemy.sprite, this.playerShots, (_target, shot) => {
            const projectile = shot as Physics.Arcade.Image;
            const state = this.projectiles.get(projectile);
            if (!projectile.active || !enemy.health.isAlive || !state || state.hitEnemies.has(enemy)) return;

            state.hitEnemies.add(enemy);
            if (this.network && !this.network.isHost) {
                // Quem decide o dano é o anfitrião; a vida volta pelo próximo estado.
                this.network.onEnemyHit(enemy, state.damage, {
                    x: Math.cos(projectile.rotation),
                    y: Math.sin(projectile.rotation)
                });
                this.explode(enemy, state.damage, state.id);
                if (state.remainingPierces > 0) state.remainingPierces -= 1;
                else this.removeShot(projectile);
                return;
            }
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
                this.detonate(enemy, state.id);
            }
            if (damage > 0) playDamageNumber(this.scene, center.x, center.y, damage);
            this.explode(enemy, state.damage, state.id);
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
        for (const [shot, lifetime] of this.partnerShotLifetimes) {
            if (lifetime <= delta) this.removePartnerShot(shot);
            else this.partnerShotLifetimes.set(shot, lifetime - delta);
        }
        const isPlayerAlive = this.player.health.isAlive;
        // No multiplayer os inimigos continuam agindo enquanto o jogador local está caído.
        if (!isPlayerAlive && !this.network) return;

        this.playerCooldown = Math.max(0, this.playerCooldown - delta);
        let nearest: CombatEnemy | undefined;
        let nearestDistance = this.playerStats.range ** 2;

        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive) continue;
            const cooldown = Math.max(0, (this.enemyCooldowns.get(enemy) ?? 0) - delta);
            this.enemyCooldowns.set(enemy, cooldown);
            const origin = this.getCenter(enemy);
            if (this.network?.isHost) this.fireAtNearestPlayer(enemy, origin, cooldown);
            if (!isPlayerAlive) continue;
            const target = this.getCenter(this.player);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance > Math.max(this.playerStats.range, COMBAT_CONFIG.drone.range) ** 2) continue;
            if (!hasLineOfSight(this.walls, origin, target)) continue;

            if (distance <= nearestDistance) {
                nearest = enemy;
                nearestDistance = distance;
            }
            const isRanged = enemy.kind === 'drone' || enemy.kind === undefined;
            if (!this.network && isRanged && distance <= COMBAT_CONFIG.drone.range ** 2 && cooldown === 0) {
                this.fire(enemy, this.player, this.enemyShots, COMBAT_CONFIG.drone);
                this.enemyCooldowns.set(enemy, COMBAT_CONFIG.drone.fireInterval);
            }
        }
        if (!isPlayerAlive) return;
        // Na sala corpo a corpo o jogador só ataca com a espada, sem tiro nem companheiro.
        if (this.melee) {
            if (this.isSwingQueued && this.playerCooldown === 0) {
                this.isSwingQueued = false;
                this.swing();
            }
            this.updateHeldSword();
            return;
        }
        if (nearest && this.playerCooldown === 0) {
            this.firePlayer(nearest);
            this.playerCooldown = this.playerStats.fireInterval / this.playerFireRateMultiplier;
        }
        this.updateCompanion(delta);
        this.updatePulse(delta);
        this.updateOrbit(delta);
        this.updateChainLightning(delta);
        this.updateBeams(delta);
    }

    /** Faíscas orbitais: cada inimigo leva no máximo um toque por intervalo. */
    private updateOrbit(delta: number) {
        const { orbitCount, orbitRadius, orbitDamageRatio, orbitHitInterval, damage } = this.playerStats;
        if (orbitCount <= 0) return;
        while (this.orbitSparks.length < orbitCount) {
            this.orbitSparks.push({
                // Halo somado ao mapa e núcleo claro: a faísca brilha mesmo no escuro.
                glow: this.scene.add.circle(0, 0, 11, 0x5ce5f1, 0.4).setDepth(14).setBlendMode(1),
                core: this.scene.add.circle(0, 0, 5, 0xe8ffff).setDepth(15)
            });
        }
        // Cerca de uma volta a cada 1,6 s.
        this.orbitAngle += delta * 0.004;
        for (const [enemy, cooldown] of this.orbitHits) {
            if (cooldown <= delta) this.orbitHits.delete(enemy);
            else this.orbitHits.set(enemy, cooldown - delta);
        }
        const center = this.getCenter(this.player);
        this.orbitSparks.forEach((spark, index) => {
            const angle = this.orbitAngle + index * Math.PI * 2 / orbitCount;
            const x = center.x + Math.cos(angle) * orbitRadius;
            const y = center.y + Math.sin(angle) * orbitRadius;
            spark.glow.setPosition(x, y);
            spark.core.setPosition(x, y);
            for (const enemy of this.enemies) {
                if (!enemy.health.isAlive || this.orbitHits.has(enemy)) continue;
                const target = this.getCenter(enemy);
                if (Math.hypot(target.x - x, target.y - y) > 12) continue;
                this.orbitHits.set(enemy, orbitHitInterval);
                this.withAttack((id) => this.hitEnemy(enemy, damage * orbitDamageRatio, {
                    x: Math.cos(angle + Math.PI / 2),
                    y: Math.sin(angle + Math.PI / 2)
                }, id));
            }
        });
    }

    /** Raio em cadeia: nasce no inimigo mais perto à vista e salta para os vizinhos. */
    private updateChainLightning(delta: number) {
        const { chainJumps, chainInterval, chainRange, chainDamageRatio, damage, range } = this.playerStats;
        if (chainJumps <= 0) return;
        this.chainCooldown -= delta;
        if (this.chainCooldown > 0) return;
        const origin = this.getCenter(this.player);
        let current = this.findNearestEnemy(origin, range * 1.5);
        // Sem alvo, tenta de novo logo em vez de gastar a recarga inteira.
        if (!current) {
            this.chainCooldown = 200;
            return;
        }
        this.chainCooldown = chainInterval;
        const struck = new Set<CombatEnemy>();
        const path = [origin];
        this.withAttack((id) => {
            let from = origin;
            for (let jump = 0; jump < chainJumps && current; jump += 1) {
                const enemy: CombatEnemy = current;
                struck.add(enemy);
                const target = this.getCenter(enemy);
                const distance = Math.hypot(target.x - from.x, target.y - from.y) || 1;
                path.push(target);
                this.hitEnemy(enemy, damage * chainDamageRatio, {
                    x: (target.x - from.x) / distance,
                    y: (target.y - from.y) / distance
                }, id);
                from = target;
                current = this.findNearestEnemy(target, chainRange, struck);
            }
        });
        this.shareEffect({ effect: 'lightning', points: path, color: 0xfff27a });
    }

    /** Feixes de luz: atravessam a tela a partir do jogador e giram meio espaço a cada disparo. */
    private updateBeams(delta: number) {
        const { beamCount, beamLength, beamInterval, beamDamageRatio, damage } = this.playerStats;
        if (beamCount <= 0) return;
        this.beamCooldown -= delta;
        if (this.beamCooldown > 0 || !this.enemies.some((enemy) => enemy.health.isAlive)) return;
        this.beamCooldown = beamInterval;
        this.beamAngle += Math.PI / beamCount;
        const origin = this.getCenter(this.player);
        const angles = Array.from({ length: beamCount }, (_, index) => this.beamAngle + index * Math.PI * 2 / beamCount);
        this.shareEffect({ effect: 'beams', origin, angles, length: beamLength, color: 0x5ce5f1 });
        this.withAttack((id) => {
            const struck = new Set<CombatEnemy>();
            for (const angle of angles) {
                const direction = { x: Math.cos(angle), y: Math.sin(angle) };
                for (const enemy of this.enemies) {
                    if (!enemy.health.isAlive || struck.has(enemy)) continue;
                    const target = this.getCenter(enemy);
                    const along = (target.x - origin.x) * direction.x + (target.y - origin.y) * direction.y;
                    const across = Math.abs((target.x - origin.x) * direction.y - (target.y - origin.y) * direction.x);
                    if (along < 0 || along > beamLength || across > BEAM_HALF_WIDTH) continue;
                    struck.add(enemy);
                    this.hitEnemy(enemy, damage * beamDamageRatio, direction, id);
                }
            }
        });
        const sound = AUDIO_CONFIG.effects.playerShot;
        this.scene.sound.play(sound.key, { volume: sound.volume });
    }

    /** Detonação: o abatido explode; outra morte na explosão continua a cadeia. */
    private detonate(enemy: CombatEnemy, attackId: string) {
        const { deathBlastRadius, deathBlastDamageRatio, damage } = this.playerStats;
        if (deathBlastRadius <= 0) return;
        const center = this.getCenter(enemy);
        this.shareEffect({ effect: 'explosion', ...center, radius: deathBlastRadius, color: 0xff4f6d });
        this.damageArea(center, deathBlastRadius, damage * deathBlastDamageRatio, enemy, attackId);
    }

    private shareEffect(effect: PlayerEffect) {
        this.playPartnerEffect(effect);
        this.network?.onPlayerEffect(effect);
    }

    playPartnerEffect(effect: PlayerEffect) {
        switch (effect.effect) {
            case 'shockwave': return playShockwave(this.scene, effect.x, effect.y, effect.radius, effect.color);
            case 'explosion': return playExplosion(this.scene, effect.x, effect.y, effect.radius, effect.color);
            case 'lightning': return playLightning(this.scene, effect.points, effect.color);
            case 'beams': return playBeams(this.scene, effect.origin, effect.angles, effect.length, effect.color);
        }
    }

    /** Um ataque conta como um disparo para multi-kills. */
    private withAttack(strike: (id: string) => void) {
        const id = createProjectileId(this.tracker.snapshot().runId);
        this.tracker.registerProjectile(id);
        strike(id);
        this.tracker.finalizeProjectile(id);
    }

    /** Pulso de choque: atinge todos em volta do jogador, no ritmo da carta. */
    private updatePulse(delta: number) {
        const { pulseRadius, pulseInterval, pulseDamageRatio, damage } = this.playerStats;
        if (pulseRadius <= 0) return;
        this.pulseCooldown -= delta;
        if (this.pulseCooldown > 0) return;
        this.pulseCooldown = pulseInterval;
        const origin = this.getCenter(this.player);
        this.shareEffect({ effect: 'shockwave', ...origin, radius: pulseRadius, color: COMBAT_CONFIG.player.color });
        this.damageArea(origin, pulseRadius, damage * pulseDamageRatio);
    }

    /** Tiro explosivo: o inimigo atingido já levou o dano cheio, os vizinhos levam uma parte. */
    private explode(target: CombatEnemy, damage: number, attackId: string) {
        const { blastRadius, blastDamageRatio } = this.playerStats;
        if (blastRadius <= 0) return;
        const center = this.getCenter(target);
        this.shareEffect({ effect: 'explosion', ...center, radius: blastRadius, color: 0xff9a3c });
        this.damageArea(center, blastRadius, damage * blastDamageRatio, target, attackId);
    }

    private damageArea(
        origin: { x: number; y: number },
        radius: number,
        damage: number,
        except?: CombatEnemy,
        attackId?: string
    ) {
        const strike = (id: string) => {
            for (const enemy of this.enemies) {
                if (enemy === except || !enemy.health.isAlive) continue;
                const target = this.getCenter(enemy);
                const dx = target.x - origin.x;
                const dy = target.y - origin.y;
                const distance = Math.hypot(dx, dy);
                if (distance > radius || !hasLineOfSight(this.walls, origin, target)) continue;
                this.hitEnemy(enemy, damage, distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 1 }, id);
            }
        };
        if (attackId) strike(attackId);
        else this.withAttack(strike);
    }

    /** Dano fora do projétil (espada e área); no convidado, quem decide é o anfitrião. */
    private hitEnemy(enemy: CombatEnemy, damage: number, direction: { x: number; y: number }, attackId: string) {
        if (this.network && !this.network.isHost) {
            this.network.onEnemyHit(enemy, damage, direction);
            return;
        }
        const target = this.getCenter(enemy);
        const previousHealth = enemy.health.current;
        const reportedDamage = enemy.takeDamage(damage, direction);
        const dealt = typeof reportedDamage === 'number'
            ? reportedDamage
            : previousHealth - enemy.health.current;
        if (dealt > 0) playDamageNumber(this.scene, target.x, target.y, dealt);
        if (!enemy.health.isAlive) {
            this.tracker.recordEnemyDeath(enemy.id, attackId);
            this.onEnemyKilled();
            this.detonate(enemy, attackId);
        }
    }

    /** A espada coletada fica na mão do personagem até o próximo golpe. */
    equipSword() {
        if (!this.melee || this.heldSword) return;
        this.heldSword = this.scene.add.image(0, 0, 'sword').setOrigin(0.15, 0.85);
        this.updateHeldSword();
    }

    hasSword() {
        return this.heldSword !== undefined;
    }

    /** Golpe em arco para onde o personagem olha; cada golpe conta como um ataque para multi-kills. */
    swing(angle = this.getAimAngle()) {
        if (!this.heldSword || !this.player.health.isAlive) return false;
        if (this.playerCooldown > 0) {
            this.isSwingQueued ||= this.playerCooldown <= COMBAT_CONFIG.melee.bufferWindow;
            return false;
        }
        const { range, arc, interval, damageMultiplier } = COMBAT_CONFIG.melee;
        const swordDamage = this.playerStats.damage * damageMultiplier;
        this.playerCooldown = interval;
        const origin = this.getCenter(this.player);
        const id = createProjectileId(this.tracker.snapshot().runId);
        this.tracker.registerProjectile(id);

        const hand = this.getHandPosition();
        this.heldSword.setVisible(false);
        this.playSwing(hand.x, hand.y, angle, () => this.heldSword?.setVisible(true));
        this.network?.onPlayerSwing(hand.x, hand.y, angle);

        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive) continue;
            const target = { x: this.getCenter(enemy).x, y: this.getCenter(enemy).y };
            const dx = target.x - origin.x;
            const dy = target.y - origin.y;
            const distance = Math.hypot(dx, dy);
            const turn = Math.atan2(dy, dx) - angle;
            if (
                distance > range
                || Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) > arc / 2
                || !hasLineOfSight(this.walls, origin, target)
            ) continue;

            playSwordHit(this.scene, target.x, target.y);
            const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: Math.cos(angle), y: Math.sin(angle) };
            this.hitEnemy(enemy, swordDamage, direction, id);
        }
        this.tracker.finalizeProjectile(id);
        return true;
    }

    /** Golpe do parceiro: apenas visual, o dano é resolvido no cliente de quem golpeou. */
    playPartnerSwing(x: number, y: number, angle: number) {
        this.playSwing(x, y, angle);
    }

    private playSwing(x: number, y: number, angle: number, onComplete?: () => void) {
        const { arc, swingDuration } = COMBAT_CONFIG.melee;
        // O ícone da espada aponta a lâmina para cima e à direita (-45°).
        const sword = this.scene.add.image(x, y - 2, 'sword')
            .setOrigin(0.15, 0.85)
            .setDepth(15)
            .setRotation(angle - arc / 2 + Math.PI / 4);
        this.scene.tweens.add({
            targets: sword,
            rotation: angle + arc / 2 + Math.PI / 4,
            duration: swingDuration,
            ease: 'Quad.Out',
            onComplete: () => {
                sword.destroy();
                onComplete?.();
            }
        });
    }

    private getAimAngle() {
        const { x, y } = this.player.getAimDirection();
        return Math.atan2(y, x);
    }

    /** Usa o corpo físico, já movido neste quadro; o sprite só é sincronizado depois do update. */
    private getHandPosition() {
        const feet = this.getCenter(this.player);
        return { x: feet.x, y: feet.y - 6 };
    }

    private updateHeldSword() {
        if (!this.heldSword) return;
        const { x, y } = this.player.getAimDirection();
        const isFacingAway = y < 0 && Math.abs(x) < Math.abs(y);
        const side = x < 0 || (x === 0 && y < 0) ? -1 : 1;
        const hand = this.getHandPosition();
        // Escala negativa espelha em volta do cabo; de costas, a espada fica atrás do corpo.
        this.heldSword
            .setPosition(hand.x + side * 5, hand.y)
            .setScale(side * 0.7, 0.7)
            .setDepth(this.player.sprite.depth + (isFacingAway ? -0.0001 : 0.0001));
    }

    clear() {
        for (const shot of this.projectiles.keys()) this.removeShot(shot);
        for (const shot of this.partnerShotLifetimes.keys()) this.removePartnerShot(shot);
    }

    setPlayerFireRateMultiplier(multiplier: number) {
        const nextMultiplier = Math.max(0.01, multiplier);
        this.playerCooldown *= this.playerFireRateMultiplier / nextMultiplier;
        this.companionCooldown *= this.playerFireRateMultiplier / nextMultiplier;
        this.playerFireRateMultiplier = nextMultiplier;
    }

    /** Precisa vir antes dos inimigos, para eles também interceptarem os tiros do parceiro. */
    setNetwork(network: CombatNetwork) {
        this.network = network;
        const partnerShots = this.scene.physics.add.group({ allowGravity: false });
        this.partnerShots = partnerShots;
        for (const wall of this.walls) {
            this.scene.physics.add.collider(partnerShots, wall, (shot) =>
                this.removePartnerShot(shot as Physics.Arcade.Image));
        }
    }

    /** Tiro inimigo vindo do anfitrião: é real aqui, pois só atinge o jogador local. */
    spawnEnemyShot(x: number, y: number, angle: number) {
        this.createProjectile({ x, y }, angle, this.enemyShots, COMBAT_CONFIG.drone, 0);
        const sound = AUDIO_CONFIG.effects.enemyShot;
        this.scene.sound.play(sound.key, { volume: sound.volume });
    }

    /** Tiro do parceiro: apenas visual, o dano é resolvido no cliente de quem atirou. */
    spawnPartnerShot(x: number, y: number, angle: number, speed: number, color: number) {
        if (!this.partnerShots) return;
        const shot = this.partnerShots.create(x, y, 'combat-projectile-rounded') as Physics.Arcade.Image;
        this.configureShot(shot, angle, speed, color);
        this.partnerShotLifetimes.set(shot, COMBAT_CONFIG.projectile.lifetime);
    }

    private fireAtNearestPlayer(enemy: CombatEnemy, origin: { x: number; y: number }, cooldown: number) {
        const isRanged = enemy.kind === 'drone' || enemy.kind === undefined;
        if (!isRanged || cooldown > 0) return;
        const target = this.network?.getEnemyTarget(origin);
        const center = target?.sprite.body?.center;
        if (!target || !center) return;
        if ((origin.x - center.x) ** 2 + (origin.y - center.y) ** 2 > COMBAT_CONFIG.drone.range ** 2) return;
        if (!hasLineOfSight(this.walls, origin, center)) return;

        this.fire(enemy, target, this.enemyShots, COMBAT_CONFIG.drone);
        this.network?.onEnemyShot(origin.x, origin.y, Math.atan2(center.y - origin.y, center.x - origin.x));
        this.enemyCooldowns.set(enemy, COMBAT_CONFIG.drone.fireInterval);
    }

    private removePartnerShot(shot: Physics.Arcade.Image) {
        this.partnerShotLifetimes.delete(shot);
        if (shot.active) shot.destroy();
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
        this.configureShot(shot, angle, weapon.projectileSpeed, weapon.color);
        if (group === this.playerShots) {
            this.network?.onPlayerShot(origin.x, origin.y, angle, weapon.projectileSpeed, weapon.color);
        }
        this.projectiles.set(shot, {
            id,
            lifetime: COMBAT_CONFIG.projectile.lifetime,
            damage: weapon.damage,
            remainingPierces,
            hitEnemies: new Set()
        });
        this.tracker.registerProjectile(id);
    }

    private configureShot(shot: Physics.Arcade.Image, angle: number, speed: number, color: number) {
        const { width, height, scale } = COMBAT_CONFIG.projectile;
        shot.setDepth(15).setTint(color);
        shot.setScale(scale).setRotation(angle);
        shot.setBodySize(
            Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height,
            Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height
        );
        shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
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
        this.companionCooldown = weapon.fireInterval / this.playerFireRateMultiplier;
    }

    private findNearestEnemy(origin: { x: number; y: number }, range: number, except?: ReadonlySet<CombatEnemy>) {
        let nearest: CombatEnemy | undefined;
        let nearestDistance = range ** 2;
        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive || except?.has(enemy)) continue;
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
