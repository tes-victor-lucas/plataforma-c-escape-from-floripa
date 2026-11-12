import { Physics, type Scene } from 'phaser';
import { Health } from '../combat/Health';
import { AUDIO_CONFIG } from '../config/audio';
import { countThresholdsCrossed, getGolemStage, TOPAZIO_BOSS } from '../config/ticen';
import { getActorDepth, WORLD_CONFIG } from '../config/world';
import { playExplosion, playShockwave } from '../effects/playAreaEffects';
import type { CombatEnemy } from './CombatEnemy';
import type { Player } from './Player';

type Point = Readonly<{ x: number; y: number }>;
type Action = 'walk' | 'slam' | 'spin' | 'fetch' | 'hold' | 'roar' | 'dead';
type TicenBus = Readonly<{ route: number; col: number; row: number }>;

// Linhas da folha (assets/topazio/gen_golem.py): estágio * 3 + animação; 13 é a morte.
const ROW_IDLE = 0;
const ROW_WALK = 1;
const ROW_SLAM = 2;
const ROW_DEATH = 13;
// Giro: uma coluna por estágio de rachadura.
const ROW_SPIN_FRONT = 14;
const ROW_SPIN_BACK = 15;
const ROAR_THRESHOLDS = TOPAZIO_BOSS.roar.cutscenes.map(({ at }) => at);

/** Chefe final do TICEN: cadeia de topázios, giro com estilhaços e ônibus arremessados. */
export class TopazioGolem implements CombatEnemy {
    readonly kind = 'golem' as const;
    readonly id = 'topazio-golem';
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(TOPAZIO_BOSS.maxHealth);
    relentless = true;

    private action: Action = 'walk';
    private actionTime = 0;
    private restTimer: number = TOPAZIO_BOSS.firstRest;
    private animTime = 0;
    private stage = 0;
    private nextAttack: 'slam' | 'spin' = 'slam';
    private hasSlammed = false;
    private spinBursts = 0;
    private busesThrown = 0;
    private roarsDone = 0;
    private readonly activeSpikes = new Set<Point>();
    private sweepBack?: Phaser.GameObjects.Graphics;
    private sweepFront?: Phaser.GameObjects.Graphics;
    private lastGhostAt = -Infinity;
    private spinSound?: Phaser.Sound.BaseSound;
    private readonly buses: TicenBus[] = [...TOPAZIO_BOSS.buses];
    private fetching?: TicenBus;
    private heldBus?: Phaser.GameObjects.Image;
    private busMarker?: Phaser.GameObjects.Graphics;
    private hitFlashSequence = 0;
    private readonly shards: Physics.Arcade.Group;

    constructor(
        private readonly scene: Scene,
        private readonly player: Player,
        walls: Phaser.Tilemaps.TilemapLayer[],
        private readonly busLayer: Phaser.Tilemaps.TilemapLayer | undefined,
        private readonly busTexture: string,
        private readonly onDefeated: () => void,
        private readonly onRoar: (caption: string) => void
    ) {
        const { spawn, texture, hitbox } = TOPAZIO_BOSS;
        this.sprite = scene.physics.add.sprite(spawn.x, spawn.y, texture, 0).setDepth(TOPAZIO_BOSS.depth);
        const body = this.sprite.body;
        if (body instanceof Physics.Arcade.Body) {
            body.setSize(hitbox.width, hitbox.height).setOffset(hitbox.offsetX, hitbox.offsetY);
            body.pushable = false;
            body.setAllowGravity(false);
        }
        this.shards = scene.physics.add.group({ allowGravity: false });
        for (const wall of walls) scene.physics.add.collider(this.shards, wall, (shard) => shard.destroy());
        scene.physics.add.overlap(player.sprite, this.shards, (_target, shard) => {
            if (!(shard as Phaser.GameObjects.GameObject).active) return;
            shard.destroy();
            player.takeDamage(TOPAZIO_BOSS.spin.damage);
        });
        this.updateFrame();
    }

    get isThrowingBus() {
        return this.action === 'fetch' || this.action === 'hold';
    }

    update(player?: Player, delta = 0) {
        if (!this.health.isAlive) return;
        const body = this.sprite.body;
        if (!(body instanceof Physics.Arcade.Body)) return;
        this.actionTime += delta;
        this.animTime += delta;
        const target = player?.health.isAlive ? player.sprite.body?.center ?? player.sprite : undefined;
        if (player && target && this.scene.physics.overlap(this.sprite, player.sprite)) {
            player.takeDamage(TOPAZIO_BOSS.contactDamage);
        }
        body.setVelocity(0, 0);
        this.hitBySpikes();
        switch (this.action) {
            case 'walk': this.updateWalk(body, target, delta); break;
            case 'slam': this.updateSlam(target); break;
            case 'spin': this.updateSpin(body, target); break;
            case 'fetch': this.updateFetch(body); break;
            case 'hold': this.updateHold(target); break;
        }
        const { left, right, top, bottom } = TOPAZIO_BOSS.bounds;
        this.sprite.setPosition(
            Math.min(right, Math.max(left, this.sprite.x)),
            Math.min(bottom, Math.max(top, this.sprite.y))
        );
        // Enquanto sobe da baia, o ônibus segue o tween; depois acompanha o golem.
        if (this.action === 'hold' && this.actionTime >= TOPAZIO_BOSS.bus.liftTime) this.heldBus?.setPosition(this.sprite.x, this.sprite.y - 64);
        this.updateFrame();
    }

    takeDamage(amount: number) {
        if (!this.health.isAlive) return 0;
        const previous = this.health.current;
        this.health.takeDamage(amount);
        // Os ônibus e as cutscenes que faltam acontecem antes do fim: só o 763.2 pode sobrar no TICEN.
        if (!this.health.isAlive && (this.buses.length > 0 || this.isThrowingBus || this.roarsDone < ROAR_THRESHOLDS.length)) {
            this.health.current = 1;
        }
        this.flashHit();
        const stage = getGolemStage(this.health.current, this.health.max);
        if (stage > this.stage) {
            this.stage = stage;
            this.scene.cameras.main.shake(180, 0.006);
            playShockwave(this.scene, this.sprite.x, this.sprite.y, 70, 0x6ee2ff);
        }
        if (!this.health.isAlive) this.finishDeath();
        return previous - this.health.current;
    }

    /** A vida do chefe aparece na barra do topo da tela. */
    drawHealthBar() {}

    /**
     * Rugido das cutscenes (70% e 40%): ergue os braços, carrega o núcleo e bate no chão com uma onda dupla.
     * Roda por tempo, porque o mundo fica parado enquanto a câmera mostra o golem.
     */
    playRoar(duration: number) {
        const { x, y } = this.sprite;
        const raised = (this.stage * 3 + ROW_SLAM) * 4;
        this.sprite.setFrame(raised + 1);
        const { key, volume } = AUDIO_CONFIG.effects.golemRoar;
        this.scene.sound.play(key, { volume });
        this.scene.tweens.add({ targets: this.sprite, scaleX: 1.08, scaleY: 1.08, duration: duration * 0.35, yoyo: true, ease: 'Sine.easeInOut' });
        this.scene.time.delayedCall(duration * 0.45, () => {
            this.sprite.setFrame(raised + 2);
            this.scene.cameras.main.shake(450, 0.014);
            this.scene.cameras.main.flash(160, 110, 226, 255);
            playShockwave(this.scene, x, y + 30, 90, 0x6ee2ff);
            playShockwave(this.scene, x, y + 30, 140, 0xf29b38);
        });
        this.scene.time.delayedCall(duration * 0.6, () => this.sprite.setFrame(raised + 3));
        this.scene.time.delayedCall(duration, () => {
            this.sprite.setScale(1);
            this.finishAttack();
        });
    }

    private startAction(action: Action) {
        this.action = action;
        this.actionTime = 0;
        this.animTime = 0;
    }

    private get isRoarPending() {
        return this.roarsDone < countThresholdsCrossed(this.health.current, this.health.max, ROAR_THRESHOLDS);
    }

    private updateWalk(body: Physics.Arcade.Body, target: Point | undefined, delta: number) {
        // A cutscene vem antes de tudo, mas espera o último ônibus ou a última cadeia terminar: ela congela o jogador.
        if (this.isRoarPending) {
            if (this.actionTime < TOPAZIO_BOSS.roar.calmBefore) return;
            const { caption } = TOPAZIO_BOSS.roar.cutscenes[this.roarsDone];
            this.roarsDone += 1;
            this.startAction('roar');
            this.onRoar(caption);
            return;
        }
        if (this.busesThrown + (this.fetching ? 1 : 0) < countThresholdsCrossed(this.health.current, this.health.max, TOPAZIO_BOSS.busThresholds)
            && this.buses.length > 0) {
            this.startFetch();
            return;
        }
        if (!target) return;
        this.restTimer -= delta;
        if (this.restTimer <= 0) {
            this.startAction(this.nextAttack);
            this.hasSlammed = false;
            this.spinBursts = 0;
            if (this.nextAttack === 'spin') {
                // O som tem a duração do giro; guardado para parar se ele morrer girando.
                const { key, volume } = AUDIO_CONFIG.effects.golemSpin;
                this.spinSound = this.scene.sound.add(key, { volume });
                this.spinSound.once('complete', () => this.spinSound?.destroy());
                this.spinSound.play();
            }
            // Mais pancadas do que giros; nunca dois giros seguidos.
            this.nextAttack = this.nextAttack === 'spin' || Math.random() < 0.6 ? 'slam' : 'spin';
            return;
        }
        const dx = target.x - this.sprite.x;
        const dy = target.y - this.sprite.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 40) body.setVelocity(dx / distance * TOPAZIO_BOSS.speed, dy / distance * TOPAZIO_BOSS.speed);
    }

    private finishAttack() {
        this.restTimer = TOPAZIO_BOSS.rest[this.stage];
        this.startAction('walk');
    }

    private updateSlam(target: Point | undefined) {
        const { windup, recover } = TOPAZIO_BOSS.slam;
        if (!this.hasSlammed && this.actionTime >= windup) {
            this.hasSlammed = true;
            const { key, volume } = AUDIO_CONFIG.effects.golemSlam;
            this.scene.sound.play(key, { volume });
            const feet = { x: this.sprite.x, y: this.sprite.y + TOPAZIO_BOSS.feetOffset - 8 };
            this.scene.cameras.main.shake(140, 0.005);
            playShockwave(this.scene, feet.x, feet.y, 40, 0xffa040);
            if (target) this.eruptChains(feet, target);
        }
        if (this.actionTime >= windup + recover) this.finishAttack();
    }

    /** Topázios brotam um atrás do outro numa linha até o jogador; da metade da vida em diante são três linhas. */
    private eruptChains(origin: Point, target: Point) {
        const { spikeCount, spikeInterval, spikeSpacing, spread } = TOPAZIO_BOSS.slam;
        const aim = Math.atan2(target.y - origin.y, target.x - origin.x);
        for (const angle of [aim - spread, aim, aim + spread]) {
            for (let step = 1; step <= spikeCount; step += 1) {
                this.scene.time.delayedCall(step * spikeInterval, () => this.eruptSpike(
                    origin.x + Math.cos(angle) * step * spikeSpacing,
                    origin.y + Math.sin(angle) * step * spikeSpacing
                ));
            }
        }
    }

    private eruptSpike(x: number, y: number) {
        if (!this.scene.physics.world.bounds.contains(x, y)) return;
        const { shardTexture } = TOPAZIO_BOSS;
        const { spikeLifetime } = TOPAZIO_BOSS.slam;
        // Três estilhaços do projétil, de pé: um alto no meio e dois menores inclinados.
        const parts = [
            this.scene.add.image(x - 6, y, shardTexture, 1).setScale(1.4),
            this.scene.add.image(x + 6, y, shardTexture, 3).setScale(1.4),
            this.scene.add.image(x, y, shardTexture, 2).setScale(2.4)
        ];
        for (const part of parts) {
            part.setOrigin(0.5, 0.85).setDepth(getActorDepth(y)).setScale(part.scaleX, 0);
            this.scene.tweens.add({ targets: part, scaleY: part.scaleX, duration: 90, ease: 'Back.easeOut' });
        }
        // Machuca enquanto estiver de pé; no fim volta para dentro do chão, sem esmaecer.
        const spike = { x, y: y - 6 };
        this.activeSpikes.add(spike);
        this.hitBySpikes();
        this.scene.time.delayedCall(spikeLifetime, () => {
            this.activeSpikes.delete(spike);
            this.scene.tweens.add({ targets: parts, scaleY: 0, duration: 90, ease: 'Quad.easeIn', onComplete: () => parts.forEach((part) => part.destroy()) });
        });
    }

    private hitBySpikes() {
        if (!this.player.health.isAlive) return;
        const { spikeRadius, damage } = TOPAZIO_BOSS.slam;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        for (const spike of this.activeSpikes) {
            if (Math.hypot(center.x - spike.x, center.y - spike.y) <= spikeRadius) {
                this.player.takeDamage(damage);
                return;
            }
        }
    }

    private updateSpin(body: Physics.Arcade.Body, target: Point | undefined) {
        const { duration, burstInterval, chaseSpeed } = TOPAZIO_BOSS.spin;
        // Gira perseguindo o jogador, como o Garen e o Balmond; os estilhaços saem de onde ele estiver.
        if (target) {
            const dx = target.x - this.sprite.x;
            const dy = target.y - this.sprite.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 8) body.setVelocity(dx / distance * chaseSpeed, dy / distance * chaseSpeed);
        }
        while (this.spinBursts * burstInterval <= this.actionTime && this.actionTime < duration) {
            this.releaseShards(this.spinBursts);
            // Poeira no chão a cada rajada, como o anel sob o Garen e o Balmond girando.
            playShockwave(this.scene, this.sprite.x, this.sprite.y + TOPAZIO_BOSS.feetOffset - 4, 34, 0xf29b38);
            this.spinBursts += 1;
        }
        this.drawSweep();
        if (this.actionTime < duration) return;
        this.sweepBack?.clear();
        this.sweepFront?.clear();
        this.sprite.setScale(1);
        this.finishAttack();
    }

    /**
     * Varredura do giro (referência: Julgamento do Garen e Ciclone do Balmond): dois crescentes com rastro
     * seguem os punhos numa elipse achatada no chão. A metade da frente passa por cima do golem, a de trás por baixo.
     * Quem estiver dentro do raio da varredura leva dano, além dos estilhaços.
     */
    private drawSweep() {
        const { turnSpeed, sweepRadius, sweepDamage } = TOPAZIO_BOSS.spin;
        const { x } = this.sprite;
        const y = this.sprite.y + 16;
        this.sweepBack ??= this.scene.add.graphics().setDepth(TOPAZIO_BOSS.depth - 0.05).setBlendMode(1);
        this.sweepFront ??= this.scene.add.graphics().setDepth(TOPAZIO_BOSS.depth + 0.05).setBlendMode(1);
        for (const layer of [this.sweepBack, this.sweepFront]) layer.clear().setPosition(x, y).setScale(1, 0.45);
        // Disco de borrão: o golpe ocupa o círculo todo, como a lâmina girando rápido demais para ser vista.
        this.sweepBack.fillStyle(0xf29b38, 0.14).fillCircle(0, 0, sweepRadius + 4);
        this.sweepBack.fillStyle(0x6ee2ff, 0.08).fillCircle(0, 0, sweepRadius * 0.7);
        const angle = this.actionTime * turnSpeed;
        const segments = 14;
        const step = 0.2;
        for (const fist of [0, Math.PI]) {
            for (let index = 0; index < segments; index += 1) {
                const end = angle + fist - index * step;
                const middle = end - step / 2;
                const fade = 1 - index / segments;
                const layer = Math.sin(middle) > 0 ? this.sweepFront : this.sweepBack;
                layer.lineStyle(16 * fade + 3, 0xf29b38, 0.6 * fade).beginPath()
                    .arc(0, 0, sweepRadius, end - step, end).strokePath();
                layer.lineStyle(4 * fade + 1, 0x9ff0ff, 0.9 * fade).beginPath()
                    .arc(0, 0, sweepRadius - 3, end - step, end).strokePath();
            }
        }
        // Rastros do corpo: cópias ciano que somem, para o giro parecer rápido demais para o olho.
        if (this.actionTime - this.lastGhostAt >= 60) {
            this.lastGhostAt = this.actionTime;
            const ghost = this.scene.add.image(x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
                .setScale(this.sprite.scaleX, 1).setDepth(TOPAZIO_BOSS.depth - 0.02).setAlpha(0.35)
                .setTint(0x6ee2ff).setBlendMode(1);
            this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 200, onComplete: () => ghost.destroy() });
        }
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        if (this.player.health.isAlive && Math.hypot(center.x - x, (center.y - y) / 0.45) <= sweepRadius + 6) {
            this.player.takeDamage(sweepDamage);
        }
    }

    private releaseShards(burst: number) {
        const { shardsPerBurst, shardSpeed, shardLifetime } = TOPAZIO_BOSS.spin;
        for (let index = 0; index < shardsPerBurst; index += 1) {
            // Cada rajada gira um pouco: o jogador precisa achar a brecha que muda.
            const angle = index / shardsPerBurst * Math.PI * 2 + burst * 0.28;
            const shard = this.shards.create(this.sprite.x, this.sprite.y, TOPAZIO_BOSS.shardTexture, 0) as Physics.Arcade.Image;
            shard.setRotation(angle).setScale(1.3).setDepth(TOPAZIO_BOSS.depth + 0.1);
            shard.setVelocity(Math.cos(angle) * shardSpeed, Math.sin(angle) * shardSpeed);
            this.scene.time.delayedCall(shardLifetime, () => shard.destroy());
        }
    }

    private busCenter(bus: TicenBus) {
        const { frameWidth, frameHeight } = TOPAZIO_BOSS.bus;
        return { x: bus.col * 16 + frameWidth / 2, y: bus.row * 16 + frameHeight / 2 };
    }

    /** Vai até o ônibus mais perto, parando logo abaixo dele. */
    private startFetch() {
        const nearest = this.buses.reduce((best, bus) => {
            const a = this.busCenter(bus);
            const b = this.busCenter(best);
            return Math.hypot(a.x - this.sprite.x, a.y - this.sprite.y) < Math.hypot(b.x - this.sprite.x, b.y - this.sprite.y) ? bus : best;
        });
        this.buses.splice(this.buses.indexOf(nearest), 1);
        this.fetching = nearest;
        this.startAction('fetch');
    }

    private updateFetch(body: Physics.Arcade.Body) {
        const bus = this.fetching;
        if (!bus) return;
        const center = this.busCenter(bus);
        const goal = { x: center.x, y: center.y + 56 };
        const dx = goal.x - this.sprite.x;
        const dy = goal.y - this.sprite.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 8) {
            const speed = TOPAZIO_BOSS.bus.fetchSpeed;
            body.setVelocity(dx / distance * speed, dy / distance * speed);
            return;
        }
        this.liftBus(bus, center);
    }

    /** Tira o ônibus da baia (e a colisão dele) e ergue acima da cabeça. */
    private liftBus(bus: TicenBus, center: Point) {
        const { tilesWide, tilesHigh, frameWidth, frameHeight, liftTime } = TOPAZIO_BOSS.bus;
        for (let dy = 0; dy < tilesHigh; dy += 1) {
            for (let dx = 0; dx < tilesWide; dx += 1) this.busLayer?.removeTileAt(bus.col + dx, bus.row + dy);
        }
        const frame = `golem-bus-${bus.route}`;
        const texture = this.scene.textures.get(this.busTexture);
        if (!texture.has(frame)) texture.add(frame, 0, 0, bus.route * frameHeight, frameWidth, frameHeight);
        this.heldBus = this.scene.add.image(center.x, center.y, this.busTexture, frame).setDepth(21);
        this.busMarker = this.scene.add.graphics().setDepth(3);
        this.fetching = undefined;
        this.startAction('hold');
        this.scene.tweens.add({
            targets: this.heldBus,
            x: this.sprite.x,
            y: this.sprite.y - 64,
            angle: -8,
            duration: liftTime,
            ease: 'Quad.easeOut'
        });
    }

    /** Segura o ônibus mirando no jogador; o alvo no chão para de seguir na hora do arremesso. */
    private updateHold(target: Point | undefined) {
        const { liftTime, holdTime, radius } = TOPAZIO_BOSS.bus;
        if (target && this.busMarker) {
            const pulse = 0.35 + 0.25 * Math.sin(this.actionTime / 70);
            this.busMarker.clear()
                .fillStyle(0xff3048, pulse).fillEllipse(target.x, target.y + 6, radius * 2, radius)
                .lineStyle(2, 0xff3048, 0.9).strokeEllipse(target.x, target.y + 6, radius * 2, radius);
            this.busMarker.setData('target', { x: target.x, y: target.y });
        }
        if (this.actionTime < liftTime + holdTime) return;
        this.throwBus();
    }

    private throwBus() {
        const image = this.heldBus;
        const marker = this.busMarker;
        const target = (marker?.getData('target') as Point | undefined) ?? { x: this.sprite.x, y: this.sprite.y + 80 };
        this.heldBus = undefined;
        this.busMarker = undefined;
        // Conta já no arremesso: durante o voo ele não pode sair atrás do próximo.
        this.busesThrown += 1;
        this.finishAttack();
        if (!image) return;
        const { flightTime, radius, damage } = TOPAZIO_BOSS.bus;
        this.scene.tweens.add({
            targets: image,
            x: target.x,
            y: target.y,
            angle: 180 + (target.x < this.sprite.x ? -20 : 20),
            duration: flightTime,
            ease: 'Quad.easeIn',
            onComplete: () => {
                marker?.destroy();
                this.scene.cameras.main.shake(260, 0.012);
                playExplosion(this.scene, target.x, target.y, radius, 0xffa040);
                playShockwave(this.scene, target.x, target.y, radius * 1.4, 0x6ee2ff);
                const center = this.player.sprite.body?.center ?? this.player.sprite;
                if (this.player.health.isAlive && Math.hypot(center.x - target.x, center.y - target.y) <= radius) {
                    this.player.takeDamage(damage);
                }
                this.scene.tweens.add({ targets: image, alpha: 0, scale: 0.6, duration: 320, onComplete: () => image.destroy() });
            }
        });
    }

    private updateFrame() {
        const { frameDuration } = TOPAZIO_BOSS;
        const column = Math.floor(this.animTime / frameDuration) % 4;
        const base = this.stage * 3;
        let row = base + ROW_IDLE;
        let frameColumn = column;
        if (this.action === 'walk' || this.action === 'fetch') {
            const body = this.sprite.body;
            const isMoving = body instanceof Physics.Arcade.Body && (body.velocity.x !== 0 || body.velocity.y !== 0);
            row = base + (isMoving ? ROW_WALK : ROW_IDLE);
        } else if (this.action === 'slam') {
            row = base + ROW_SLAM;
            // Ergue os braços durante a preparação e fica no chão depois da pancada.
            frameColumn = this.hasSlammed ? 3 : this.actionTime < TOPAZIO_BOSS.slam.windup / 2 ? 0 : 1;
        } else if (this.action === 'hold') {
            row = base + ROW_SLAM;
            frameColumn = 1;
        } else if (this.action === 'spin') {
            // Pião em pé: gira no eixo vertical alternando frente e costas e afinando de perfil.
            const facing = Math.cos(this.actionTime * TOPAZIO_BOSS.spin.turnSpeed);
            this.sprite.setScale(Math.max(0.18, Math.abs(facing)), 1);
            row = facing >= 0 ? ROW_SPIN_FRONT : ROW_SPIN_BACK;
            frameColumn = this.stage;
        } else if (this.action === 'roar') {
            return;
        }
        this.sprite.setFrame(row * 4 + frameColumn);
    }

    private flashHit() {
        const sequence = ++this.hitFlashSequence;
        this.sprite.setTint(0xffffff);
        this.sprite.setTintMode?.(Phaser.TintModes.FILL);
        this.scene.time.delayedCall(WORLD_CONFIG.feedback.enemyHitFlashDuration, () => {
            if (this.sprite.active && sequence === this.hitFlashSequence) this.sprite.clearTint();
        });
    }

    private finishDeath() {
        this.startAction('dead');
        this.spinSound?.stop();
        this.sweepBack?.clear();
        this.sweepFront?.clear();
        this.sprite.setScale(1).clearTint();
        const body = this.sprite.body;
        if (body instanceof Physics.Arcade.Body) body.enable = false;
        this.scene.cameras.main.shake(600, 0.012);
        playShockwave(this.scene, this.sprite.x, this.sprite.y, 90, 0x6ee2ff);
        // Os quadros da morte avançam aqui, porque o update para quando a vida acaba.
        for (let column = 0; column < 4; column += 1) {
            this.scene.time.delayedCall(column * 180, () => {
                if (this.sprite.active) this.sprite.setFrame(ROW_DEATH * 4 + column);
            });
        }
        this.scene.tweens.add({ targets: this.sprite, alpha: 0, delay: 800, duration: 400, onComplete: () => this.sprite.destroy() });
        this.onDefeated();
    }
}
