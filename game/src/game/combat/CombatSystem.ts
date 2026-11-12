import { Math as PhaserMath, type Physics, type Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { COMBAT_CONFIG, type EnemyKind } from '../config/combat';
import type { CombatEnemy } from '../entities/CombatEnemy';
import type { Player } from '../entities/Player';
import { hasLineOfSight } from '../map/hasLineOfSight';
import { playDamageNumber } from '../effects/playDamageNumber';
import { playSwordHit } from '../effects/playSwordHit';
import {
    playBeams,
    playExplosion,
    playLightning,
    playShockwave,
    playSlash,
    SPIN_SLASH_DURATION,
    SPIN_SLASH_START
} from '../effects/playAreaEffects';
import { WORLD_CONFIG } from '../config/world';
import { FLAME_SWORD } from '../config/items';
import { createItemTexture } from '../entities/WornItem';
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
    /** Tiro mirado no golem: ele fica de pé por cima de quiosques e pilares, então o tiro atravessa até ele. */
    passesWalls?: boolean;
};

/** Ligações opcionais do multiplayer; sem elas o combate segue como em uma partida solo. */
export type CombatNetwork = {
    isHost: boolean;
    getEnemyTarget(origin: { x: number; y: number }): Fighter | undefined;
    onEnemyShot(x: number, y: number, angle: number): void;
    onPlayerShot(x: number, y: number, angle: number, speed: number, color: number, pierces: number): void;
    onPlayerSwing(x: number, y: number, angle: number, flame?: boolean): void;
    onPlayerEffect(effect: PlayerEffect): void;
    onEnemyHit(enemy: CombatEnemy, damage: number, direction: { x: number; y: number }): void;
    /** Congelamento do cajado: o anfitrião para o inimigo de verdade e o parceiro vê o gelo. */
    onEnemyFreeze?(enemy: CombatEnemy, duration: number): void;
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
/** Quem atira: drones comuns e fortes. Inimigos sem `kind` são dublês de testes antigos e contam como drone. */
function isRangedEnemy(kind: EnemyKind | 'golem' | undefined) {
    return kind === undefined || kind === 'drone' || kind === 'heavy-drone';
}

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
    /** Recarga do golpe, separada da do tiro: com a espada flamejante os dois andam juntos. */
    private swingCooldown = 0;
    /** Espada flamejante vestida: golpe de dano médio nas salas com tiro. */
    private flameSword = false;
    private iceStaff = false;
    private iceCooldown = 0;
    /** Inimigos congelados pelo cajado e quanto falta, em ms, para voltarem a andar. */
    private readonly frozen = new Map<CombatEnemy, number>();
    private burnCooldown = 0;
    /** Inimigos em chamas pela carta Cajado de fogo: quanto falta da queimadura e do próximo tick. */
    private readonly burning = new Map<CombatEnemy, { remaining: number; tick: number }>();
    private pulseCooldown = 0;
    /** Crescimento do tiro normal pela sala atual (getPlayerShotMultipliers). */
    shotMultipliers = { damage: 1, speed: 1 };
    private chainCooldown = 0;
    private beamCooldown = 0;
    private spinCooldown = 0;
    private bombardCooldown = 0;
    /** Volta do Golpe giratório em andamento: quem já levou o corte nesta volta não leva de novo. */
    private spin?: { elapsed: number; hit: Set<CombatEnemy>; attackId: string };
    private beamAngle = 0;
    private orbitAngle = 0;
    private readonly orbitSparks: { core: Phaser.GameObjects.Arc; glow: Phaser.GameObjects.Arc }[] = [];
    private readonly orbitHits = new Map<CombatEnemy, number>();
    private network?: CombatNetwork;
    private partnerShots?: Physics.Arcade.Group;
    private readonly partnerShotStates = new Map<Physics.Arcade.Image, { lifetime: number; pierces: number; hit: Set<CombatEnemy> }>();

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        private readonly enemies: CombatEnemy[],
        private readonly walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly playerStats: PlayerUpgradeState = new PlayerUpgradeState(),
        private readonly tracker: RunTracker = runTracker,
        private readonly onEnemyKilled: () => void = () => undefined,
        private melee = false
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
                scene.physics.add.collider(
                    group,
                    wall,
                    (shot) => this.removeShot(shot as Physics.Arcade.Image),
                    (shot) => !this.projectiles.get(shot as Physics.Arcade.Image)?.passesWalls
                );
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
        const isRanged = isRangedEnemy(enemy.kind);
        this.enemyCooldowns.set(enemy, isRanged ? COMBAT_CONFIG.drone.fireInterval : 0);
        if (this.partnerShots) {
            this.scene.physics.add.overlap(enemy.sprite, this.partnerShots, (_target, shot) => {
                const projectile = shot as Physics.Arcade.Image;
                const state = this.partnerShotStates.get(projectile);
                if (!enemy.health.isAlive || !state || state.hit.has(enemy)) return;
                // Tiro perfurante do parceiro atravessa aqui também, como na tela de quem atirou.
                state.hit.add(enemy);
                if (state.pierces > 0) state.pierces -= 1;
                else this.removePartnerShot(projectile);
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
        for (const [shot, state] of this.partnerShotStates) {
            state.lifetime -= delta;
            if (state.lifetime <= 0) this.removePartnerShot(shot);
        }
        const isPlayerAlive = this.player.health.isAlive;
        // No multiplayer os inimigos continuam agindo enquanto o jogador local está caído.
        if (!isPlayerAlive && !this.network) return;

        this.playerCooldown = Math.max(0, this.playerCooldown - delta);
        this.swingCooldown = Math.max(0, this.swingCooldown - delta);
        let nearest: CombatEnemy | undefined;
        let nearestDistance = this.playerStats.range ** 2;

        this.updateFrozen(delta);
        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive) continue;
            const cooldown = Math.max(0, (this.enemyCooldowns.get(enemy) ?? 0) - delta);
            // Congelado não atira: a recarga fica parada até o gelo derreter.
            if (!this.frozen.has(enemy)) this.enemyCooldowns.set(enemy, cooldown);
            const origin = this.getCenter(enemy);
            if (this.network?.isHost && !this.frozen.has(enemy)) this.fireAtNearestPlayer(enemy, origin, cooldown);
            if (!isPlayerAlive) continue;
            const target = this.getCenter(this.player);
            const distance = (origin.x - target.x) ** 2 + (origin.y - target.y) ** 2;
            if (distance > Math.max(this.playerStats.range, COMBAT_CONFIG.drone.range) ** 2) continue;
            // O golem é gigante e fica por cima de quiosques, pilares e ônibus: o centro dele cai num tile que colide.
            if (enemy.kind !== 'golem' && !hasLineOfSight(this.walls, origin, target)) continue;

            if (distance <= nearestDistance) {
                nearest = enemy;
                nearestDistance = distance;
            }
            const isRanged = isRangedEnemy(enemy.kind);
            if (!this.network && isRanged && !this.frozen.has(enemy) && distance <= COMBAT_CONFIG.drone.range ** 2 && cooldown === 0) {
                this.fire(enemy, this.player, this.enemyShots, COMBAT_CONFIG.drone);
                this.enemyCooldowns.set(enemy, COMBAT_CONFIG.drone.fireInterval);
            }
        }
        this.updateBurning(delta);
        if (!isPlayerAlive) return;
        this.updateIceStaff(delta);
        this.updateBurnPulse(delta);
        // Na sala corpo a corpo o jogador só ataca com a espada, sem tiro nem companheiro.
        if (this.melee) {
            if (this.isSwingQueued && this.swingCooldown === 0) {
                this.isSwingQueued = false;
                this.swing();
            }
            this.updateHeldSword();
            return;
        }
        // Com a espada flamejante, o golpe guardado sai sem esperar o tiro.
        if (this.flameSword) {
            if (this.isSwingQueued && this.swingCooldown === 0) {
                this.isSwingQueued = false;
                this.swing();
            }
            this.updateHeldSword();
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
        this.updateSpinSlash(delta);
        this.updateBombard(delta);
    }

    /** Golpe giratório: a lâmina dá uma volta e fere cada inimigo do raio quando passa por ele. */
    private updateSpinSlash(delta: number) {
        const { spinRadius, spinInterval, spinDamageRatio, damage } = this.playerStats;
        if (spinRadius <= 0) return;
        const center = this.getCenter(this.player);
        if (!this.spin) {
            this.spinCooldown -= delta;
            if (this.spinCooldown > 0) return;
            this.spinCooldown = spinInterval;
            const attackId = createProjectileId(this.tracker.snapshot().runId);
            this.tracker.registerProjectile(attackId);
            this.spin = { elapsed: 0, hit: new Set(), attackId };
            this.shareEffect({ effect: 'slash', ...center, radius: spinRadius, color: 0xdff6ff });
        }
        const spin = this.spin;
        spin.elapsed = Math.min(SPIN_SLASH_DURATION, spin.elapsed + delta);
        const swept = spin.elapsed / SPIN_SLASH_DURATION * Math.PI * 2;
        for (const enemy of this.enemies) {
            if (!enemy.health.isAlive || spin.hit.has(enemy)) continue;
            const target = this.getCenter(enemy);
            const dx = target.x - center.x;
            const dy = target.y - center.y;
            const distance = Math.hypot(dx, dy);
            if (distance > spinRadius) continue;
            const angle = ((Math.atan2(dy, dx) - SPIN_SLASH_START) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            if (angle > swept) continue;
            spin.hit.add(enemy);
            this.hitEnemy(enemy, damage * spinDamageRatio, distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 1 }, spin.attackId);
        }
        if (spin.elapsed < SPIN_SLASH_DURATION) return;
        this.tracker.finalizeProjectile(spin.attackId);
        this.spin = undefined;
    }

    /** Bombardeio: explosões caem do alto sobre os inimigos mais perto, mesmo atrás de paredes. */
    private updateBombard(delta: number) {
        const { bombardTargets, bombardRadius, bombardRange, bombardInterval, bombardDamageRatio, damage } = this.playerStats;
        if (bombardTargets <= 0) return;
        this.bombardCooldown -= delta;
        if (this.bombardCooldown > 0) return;
        const origin = this.getCenter(this.player);
        const targets = this.enemies
            .filter((enemy) => enemy.health.isAlive)
            .map((enemy) => ({ center: this.getCenter(enemy), enemy }))
            .map((entry) => ({ ...entry, distance: Math.hypot(entry.center.x - origin.x, entry.center.y - origin.y) }))
            .filter(({ distance }) => distance <= bombardRange)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, bombardTargets);
        // Sem alvo, tenta de novo no próximo quadro em vez de gastar a recarga.
        if (targets.length === 0) return;
        this.bombardCooldown = bombardInterval;
        for (const { center } of targets) {
            this.shareEffect({ effect: 'explosion', ...center, radius: bombardRadius, color: 0xffb347 });
            this.damageArea(center, bombardRadius, damage * bombardDamageRatio, undefined, undefined, true, false);
        }
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
        // Com as Serras orbitais, cada faísca vira uma serra maior.
        const size = orbitDamageRatio >= 2 ? 1.6 : 1;
        this.orbitSparks.forEach((spark, index) => {
            const angle = this.orbitAngle + index * Math.PI * 2 / orbitCount;
            const x = center.x + Math.cos(angle) * orbitRadius;
            const y = center.y + Math.sin(angle) * orbitRadius;
            spark.glow.setPosition(x, y).setScale(size);
            spark.core.setPosition(x, y).setScale(size);
            for (const enemy of this.enemies) {
                if (!enemy.health.isAlive || this.orbitHits.has(enemy)) continue;
                const target = this.getCenter(enemy);
                if (Math.hypot(target.x - x, target.y - y) > 12 * size) continue;
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

    /** No convidado, o abate chega confirmado pelo anfitrião; a detonação sai das cartas de quem matou. */
    detonateConfirmedKill(enemy: CombatEnemy, attackId: string) {
        this.detonate(enemy, attackId);
    }

    private detonate(enemy: CombatEnemy, attackId: string) {
        const { deathBlastRadius, deathBlastDamageRatio, damage } = this.playerStats;
        if (deathBlastRadius <= 0) return;
        const center = this.getCenter(enemy);
        this.shareEffect({ effect: 'explosion', ...center, radius: deathBlastRadius, color: 0xff4f6d });
        // Quem morre na explosão não explode de novo: sem cadeia, a carta não limpa a horda inteira.
        this.damageArea(center, deathBlastRadius, damage * deathBlastDamageRatio, enemy, attackId, false);
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
            case 'slash': return playSlash(this.scene, effect.x, effect.y, effect.radius, effect.color);
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
        // A onda sai do jogador e atravessa obstáculos: pega quem está atrás de árvore, banco ou poste.
        this.damageArea(origin, pulseRadius, damage * pulseDamageRatio, undefined, undefined, true, false);
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
        attackId?: string,
        canDetonate = true,
        needsLineOfSight = true
    ) {
        const strike = (id: string) => {
            for (const enemy of this.enemies) {
                if (enemy === except || !enemy.health.isAlive) continue;
                const target = this.getCenter(enemy);
                const dx = target.x - origin.x;
                const dy = target.y - origin.y;
                const distance = Math.hypot(dx, dy);
                if (distance > radius || (needsLineOfSight && !hasLineOfSight(this.walls, origin, target))) continue;
                this.hitEnemy(enemy, damage, distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 1 }, id, canDetonate);
            }
        };
        if (attackId) strike(attackId);
        else this.withAttack(strike);
    }

    /** Dano fora do projétil (espada e área); no convidado, quem decide é o anfitrião. */
    private hitEnemy(
        enemy: CombatEnemy,
        damage: number,
        direction: { x: number; y: number },
        attackId: string,
        canDetonate = true
    ) {
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
            if (canDetonate) this.detonate(enemy, attackId);
        }
    }

    /** Rival da disputa pela vaga no TICEN: a espada também acerta o parceiro. */
    duelTarget?: Readonly<{ center: Readonly<{ x: number; y: number }>; isAlive: () => boolean; hit: (damage: number) => void }>;
    /** Especiais dos baús da disputa: cacete melhorado e giro de longo alcance. */
    swordDamageMultiplier = 1;
    swordRangeMultiplier = 1;
    swordFullCircle = false;

    /** Disputa pela última vaga: a dupla larga os tiros e os efeitos das cartas e passa a lutar de espada. */
    enterSwordDuel() {
        this.melee = true;
        this.clear();
        for (const spark of this.orbitSparks.splice(0)) {
            spark.core.destroy();
            spark.glow.destroy();
        }
        this.companion?.destroy();
        this.companion = undefined;
        this.equipSword();
    }

    /** Espada flamejante vestida ou guardada no inventário; na sala corpo a corpo vale a espada da própria sala. */
    setFlameSword(enabled: boolean) {
        if (this.melee || this.flameSword === enabled) return;
        this.flameSword = enabled;
        this.heldSword?.destroy();
        this.heldSword = undefined;
        if (!enabled) return;
        createItemTexture(this.scene, FLAME_SWORD);
        this.heldSword = this.scene.add.image(0, 0, FLAME_SWORD.texture).setOrigin(0.15, 0.85);
        this.updateHeldSword();
    }

    /** Cajado de gelo vestido: congela quem estiver em volta a cada recarga. */
    setIceStaff(enabled: boolean) {
        this.iceStaff = enabled;
    }

    /** Congelado pelo cajado: o mundo não move nem atualiza esse inimigo até o gelo derreter. */
    isFrozen(enemy: CombatEnemy) {
        return this.frozen.has(enemy);
    }

    /** Só lança quando há alguém no raio: sem inimigo perto, o cajado fica pronto esperando. */
    private updateIceStaff(delta: number) {
        // O item dos baús e a carta usam o mesmo gelo; com os dois, vale o raio maior.
        const cardRadius = this.playerStats.freezeRadius;
        if (!this.iceStaff && cardRadius <= 0) return;
        this.iceCooldown = Math.max(0, this.iceCooldown - delta);
        if (this.iceCooldown > 0) return;
        const { interval, freezeDuration, color } = COMBAT_CONFIG.iceStaff;
        const radius = Math.max(this.iceStaff ? COMBAT_CONFIG.iceStaff.radius : 0, cardRadius);
        const origin = this.getCenter(this.player);
        const targets = this.enemies.filter((enemy) => {
            if (!enemy.health.isAlive) return false;
            const center = this.getCenter(enemy);
            return Math.hypot(center.x - origin.x, center.y - origin.y) <= radius;
        });
        if (targets.length === 0) return;
        this.iceCooldown = interval;
        this.shareEffect({ effect: 'shockwave', ...origin, radius, color });
        for (const enemy of targets) {
            this.freezeEnemy(enemy, freezeDuration);
            this.network?.onEnemyFreeze?.(enemy, freezeDuration);
        }
    }

    /** Para o inimigo onde está; vale para o gelo deste jogador e para o do parceiro, vindo pela rede. */
    freezeEnemy(enemy: CombatEnemy, duration: number) {
        if (!enemy.health.isAlive) return;
        this.frozen.set(enemy, Math.max(duration, this.frozen.get(enemy) ?? 0));
        enemy.sprite.setVelocity(0, 0);
        enemy.sprite.anims?.pause();
    }

    /** Segura parado e azulado quem está congelado; ao derreter, volta a cor e a animação. */
    private updateFrozen(delta: number) {
        for (const [enemy, remaining] of this.frozen) {
            const left = remaining - delta;
            if (left <= 0 || !enemy.health.isAlive || !enemy.sprite.active) {
                this.frozen.delete(enemy);
                if (enemy.sprite.active) {
                    enemy.sprite.clearTint();
                    enemy.sprite.anims?.resume();
                }
                continue;
            }
            this.frozen.set(enemy, left);
            // O piscar de dano troca a cor; reaplicar a cada quadro mantém o gelo visível.
            // Modo SCREEN (4 em Phaser.TintModes): clareia para o azul-gelo até drones escuros, sem apagar o desenho.
            enemy.sprite.setVelocity(0, 0).setTint(COMBAT_CONFIG.iceStaff.color);
            enemy.sprite.setTintMode?.(4);
        }
    }

    /** Carta Cajado de fogo: espera alguém no raio e então põe fogo em todos em volta. */
    private updateBurnPulse(delta: number) {
        const { burnRadius, burnInterval, burnDuration } = this.playerStats;
        if (burnRadius <= 0) return;
        this.burnCooldown = Math.max(0, this.burnCooldown - delta);
        if (this.burnCooldown > 0) return;
        const origin = this.getCenter(this.player);
        const targets = this.enemies.filter((enemy) => {
            if (!enemy.health.isAlive) return false;
            const center = this.getCenter(enemy);
            return Math.hypot(center.x - origin.x, center.y - origin.y) <= burnRadius;
        });
        if (targets.length === 0) return;
        this.burnCooldown = burnInterval;
        this.shareEffect({ effect: 'shockwave', ...origin, radius: burnRadius, color: COMBAT_CONFIG.burn.color });
        const { tickInterval } = COMBAT_CONFIG.burn;
        // Pegar fogo de novo recomeça a queimadura; o primeiro tick vem só depois de meio segundo.
        for (const enemy of targets) this.burning.set(enemy, { remaining: burnDuration, tick: tickInterval });
    }

    /** Queimadura: um pedaço pequeno do dano a cada tick e uma brasa subindo do inimigo. */
    private updateBurning(delta: number) {
        const { tickInterval, color } = COMBAT_CONFIG.burn;
        const damage = this.playerStats.damage * this.playerStats.burnDamageRatio;
        for (const [enemy, burn] of this.burning) {
            if (!enemy.health.isAlive || !enemy.sprite.active) {
                this.burning.delete(enemy);
                continue;
            }
            burn.remaining -= delta;
            burn.tick -= delta;
            while (burn.tick <= 0 && enemy.health.isAlive) {
                burn.tick += tickInterval;
                // Sem direção de impacto: a queimadura não empurra o inimigo.
                this.withAttack((id) => this.hitEnemy(enemy, damage, { x: 0, y: 0 }, id));
                const center = this.getCenter(enemy);
                const ember = this.scene.add.circle(center.x + (Math.random() - 0.5) * 8, center.y - 4, 2, color).setDepth(15.1);
                this.scene.tweens.add({ targets: ember, y: ember.y - 12, alpha: 0, duration: 420, onComplete: () => ember.destroy() });
            }
            if (burn.remaining <= 0) this.burning.delete(enemy);
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
        if (this.swingCooldown > 0) {
            this.isSwingQueued ||= this.swingCooldown <= COMBAT_CONFIG.melee.bufferWindow;
            return false;
        }
        const { interval, damageMultiplier } = this.melee ? COMBAT_CONFIG.melee : COMBAT_CONFIG.flameSword;
        const range = COMBAT_CONFIG.melee.range * this.swordRangeMultiplier;
        const arc = this.swordFullCircle ? Math.PI * 2 : COMBAT_CONFIG.melee.arc;
        const swordDamage = this.playerStats.damage * damageMultiplier * this.swordDamageMultiplier;
        this.swingCooldown = interval;
        const origin = this.getCenter(this.player);
        const id = createProjectileId(this.tracker.snapshot().runId);
        this.tracker.registerProjectile(id);

        const hand = this.getHandPosition();
        this.heldSword.setVisible(false);
        this.playSwing(hand.x, hand.y, angle, () => this.heldSword?.setVisible(true), this.flameSword && !this.melee);
        this.network?.onPlayerSwing(hand.x, hand.y, angle, this.flameSword && !this.melee);

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
            // Acerto da espada flamejante explode numa labareda pequena em cima do inimigo.
            if (this.flameSword && !this.melee) playExplosion(this.scene, target.x, target.y, 10, COMBAT_CONFIG.burn.color);
            const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: Math.cos(angle), y: Math.sin(angle) };
            this.hitEnemy(enemy, swordDamage, direction, id);
        }
        const rival = this.duelTarget;
        if (rival?.isAlive()) {
            const dx = rival.center.x - origin.x;
            const dy = rival.center.y - origin.y;
            const turn = Math.atan2(dy, dx) - angle;
            if (Math.hypot(dx, dy) <= range && Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) <= arc / 2) {
                playSwordHit(this.scene, rival.center.x, rival.center.y);
                rival.hit(swordDamage);
            }
        }
        this.tracker.finalizeProjectile(id);
        return true;
    }

    /** Golpe do parceiro: apenas visual, o dano é resolvido no cliente de quem golpeou. */
    playPartnerSwing(x: number, y: number, angle: number, flame = false) {
        if (flame) createItemTexture(this.scene, FLAME_SWORD);
        this.playSwing(x, y, angle, undefined, flame);
    }

    private playSwing(x: number, y: number, angle: number, onComplete?: () => void, flame = false) {
        const { arc, swingDuration } = COMBAT_CONFIG.melee;
        // O ícone da espada aponta a lâmina para cima e à direita (-45°).
        const sword = this.scene.add.image(x, y - 2, flame ? FLAME_SWORD.texture : 'sword')
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
        if (flame) this.emitFlameTrail(x, y - 2, angle - arc / 2, angle + arc / 2, swingDuration, sword.displayWidth);
    }

    /**
     * Rastro de fogo do golpe: labaredas ao longo do arco, cada uma acesa quando a lâmina passa por ela.
     * Não depende da taxa de quadros: o golpe dura só 140 ms, e a 15 fps seriam duas chamas.
     */
    private emitFlameTrail(x: number, y: number, from: number, to: number, duration: number, reach: number) {
        const { trailColors, trailFlames } = COMBAT_CONFIG.flameSword;
        for (let index = 0; index < trailFlames; index += 1) {
            const progress = index / (trailFlames - 1);
            const angle = from + (to - from) * progress;
            // Duas por ponto: o miolo claro por cima de uma chama maior.
            for (const [radius, color] of [[4 + Math.random() * 2, trailColors[index % 2]], [2, trailColors[2]]] as const) {
                const flame = this.scene.add.circle(
                    x + Math.cos(angle) * reach * 0.85 + (Math.random() - 0.5) * 3,
                    y + Math.sin(angle) * reach * 0.85 + (Math.random() - 0.5) * 3,
                    radius,
                    color
                ).setDepth(15.1).setBlendMode(1).setVisible(false);
                this.scene.tweens.add({
                    targets: flame,
                    delay: progress * duration,
                    y: flame.y - 14 - Math.random() * 10,
                    scale: 0.2,
                    alpha: { from: 1, to: 0 },
                    duration: 480 + Math.random() * 200,
                    ease: 'Sine.Out',
                    onStart: () => flame.setVisible(true),
                    onComplete: () => flame.destroy()
                });
            }
        }
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
        for (const shot of this.partnerShotStates.keys()) this.removePartnerShot(shot);
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
    spawnPartnerShot(x: number, y: number, angle: number, speed: number, color: number, pierces = 0) {
        if (!this.partnerShots) return;
        const shot = this.partnerShots.create(x, y, 'combat-projectile-rounded') as Physics.Arcade.Image;
        this.configureShot(shot, angle, speed, color);
        this.partnerShotStates.set(shot, { lifetime: COMBAT_CONFIG.projectile.lifetime, pierces, hit: new Set() });
    }

    private fireAtNearestPlayer(enemy: CombatEnemy, origin: { x: number; y: number }, cooldown: number) {
        const isRanged = isRangedEnemy(enemy.kind);
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
        this.partnerShotStates.delete(shot);
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
            damage: this.playerStats.damage * this.shotMultipliers.damage,
            projectileSpeed: this.playerStats.projectileSpeed * this.shotMultipliers.speed,
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
                this.playerStats.piercingTargets,
                target.kind === 'golem'
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
        remainingPierces: number,
        passesWalls = false
    ) {
        const shot = group.create(origin.x, origin.y, 'combat-projectile-rounded') as Physics.Arcade.Image;
        const id = createProjectileId(this.tracker.snapshot().runId);
        this.configureShot(shot, angle, weapon.projectileSpeed, weapon.color);
        if (group === this.playerShots) {
            this.network?.onPlayerShot(origin.x, origin.y, angle, weapon.projectileSpeed, weapon.color, remainingPierces);
        }
        this.projectiles.set(shot, {
            id,
            lifetime: COMBAT_CONFIG.projectile.lifetime,
            damage: weapon.damage,
            remainingPierces,
            hitEnemies: new Set(),
            passesWalls
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
