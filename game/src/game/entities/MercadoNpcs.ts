import type { Scene } from 'phaser';
import { MERCADO_NPCS } from '../config/mercado';
import { getActorDepth } from '../config/world';

type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Quem o skatista pode atropelar: corpo físico e dano, como o Player. */
export interface SkaterTarget {
    readonly sprite: { readonly body: Rect | null };
    takeDamage(amount: number): void;
}

type Skater = {
    sprite: Phaser.GameObjects.Sprite;
    toY: number;
    direction: 1 | -1;
    delay: number;
    animation: string;
    leaving: boolean;
};

type MerchantPose = 'frente' | 'costas' | 'lado' | 'arruma-costas' | 'arruma-frente';
const MERCHANT_POSES: readonly MerchantPose[] = ['frente', 'costas', 'lado', 'arruma-costas', 'arruma-frente'];

type Waypoint = Readonly<{ x: number; y: number; wait: number; pose?: MerchantPose }>;

type Merchant = {
    sprite: Phaser.GameObjects.Sprite;
    row: number;
    stallX: number;
    route: readonly Waypoint[];
    index: number;
    wait: number;
};

/** Trabalha atrás do balcão e, se a banca tem lateral livre, contorna para arrumar a frente. */
export function createMerchantRoute(col: number, side: number): Waypoint[] {
    const { behindY, frontY, workTime } = MERCADO_NPCS.merchants;
    const stallX = col * 16;
    const centerX = stallX + 24;
    const route: Waypoint[] = [
        { x: centerX - 10, y: behindY, wait: workTime.behind[0], pose: 'arruma-frente' },
        { x: centerX + 10, y: behindY, wait: workTime.behind[1], pose: 'arruma-frente' }
    ];
    if (side === 0) return route;
    const sideX = side < 0 ? stallX - 8 : stallX + 56;
    return [
        ...route,
        { x: sideX, y: behindY, wait: 0 },
        { x: sideX, y: frontY, wait: 0 },
        { x: centerX, y: frontY, wait: workTime.front, pose: 'arruma-costas' },
        { x: sideX, y: frontY, wait: 0 },
        { x: sideX, y: behindY, wait: 0 }
    ];
}

// Acima dos guarda-sóis (20): o casal está sentado à frente da sombrinha.
const SEATED_DEPTH = 21;
// Quem senta com quem: as quatro pessoas da folha combinadas de jeitos diferentes.
const COUPLE_PAIRS = [[0, 1], [2, 3], [1, 2], [3, 0]] as const;

type Couple = {
    people: { sprite: Phaser.GameObjects.Sprite; row: number }[];
    center: Point;
    fleeing: boolean;
};

/** Skatistas que cruzam a rua no início, comerciantes nas bancas e os casais que fogem da briga. */
export class MercadoNpcs {
    private readonly skaters: Skater[] = [];
    private readonly merchants: Merchant[] = [];
    private readonly couples: Couple[] = [];
    /** A tela de derrota troca o título quando quem matou foi um skatista. */
    hasRunOverPlayer = false;

    /** `withSkaters` falso ao voltar do interior do mercado: a travessia só acontece na chegada. */
    constructor(private readonly scene: Scene, withSkaters = true) {
        const { skaters, merchants, couple } = MERCADO_NPCS;
        if (withSkaters) skaters.paths.forEach((path, index) => {
            const direction = path.toY > path.fromY ? 1 : -1;
            const key = `skatista-${index}-${direction > 0 ? 'down' : 'up'}`;
            const first = index * 4 + (direction > 0 ? 0 : 2);
            if (!scene.anims.exists(key)) {
                scene.anims.create({
                    key,
                    frames: scene.anims.generateFrameNumbers(skaters.texture, { start: first, end: first + 1 }),
                    frameRate: 4,
                    repeat: -1
                });
            }
            const sprite = scene.add.sprite(path.x, path.fromY, skaters.texture, first)
                .setOrigin(0.5, 1)
                .setScale(skaters.scale)
                .setDepth(getActorDepth(path.fromY));
            this.skaters.push({ sprite, toY: path.toY, direction, delay: path.delay, animation: key, leaving: false });
        });

        for (let row = 0; row < 2; row += 1) {
            MERCHANT_POSES.forEach((pose, poseIndex) => {
                const key = `comerciante-${row}-${pose}`;
                if (scene.anims.exists(key)) return;
                const first = row * 10 + poseIndex * 2;
                scene.anims.create({
                    key,
                    frames: scene.anims.generateFrameNumbers(merchants.texture, { start: first, end: first + 1 }),
                    // Andar e trabalhar sem pressa.
                    frameRate: pose.startsWith('arruma') ? 2 : 4,
                    repeat: -1
                });
            });
        }
        merchants.stalls.forEach(({ col, side }, index) => {
            const route = createMerchantRoute(col, side);
            const row = index % 2;
            const sprite = scene.add.sprite(route[0].x, route[0].y, merchants.texture, row * 10)
                .setOrigin(0.5, 1)
                .setDepth(getActorDepth(route[0].y));
            sprite.play(`comerciante-${row}-arruma-frente`);
            // Começam em momentos diferentes, para não andarem em coro.
            this.merchants.push({ sprite, row, stallX: col * 16, route, index: 0, wait: 600 + index * 900 });
        });
        this.merchants.forEach((merchant) => this.cropBehindCounter(merchant));

        for (let row = 0; row < couple.people; row += 1) {
            const key = `casal-${row}-corre`;
            if (scene.anims.exists(key)) continue;
            scene.anims.create({
                key,
                frames: scene.anims.generateFrameNumbers(couple.texture, { start: row * 3 + 1, end: row * 3 + 2 }),
                frameRate: 10,
                repeat: -1
            });
        }
        couple.tables.forEach(({ col, row }, index) => {
            const x0 = col * 16;
            const y0 = row * 16;
            const pair = COUPLE_PAIRS[index % COUPLE_PAIRS.length];
            this.couples.push({
                center: { x: x0 + couple.centerOffset.x, y: y0 + couple.centerOffset.y },
                fleeing: false,
                people: couple.seatOffsets.map((seat, seatIndex) => ({
                    row: pair[seatIndex],
                    sprite: scene.add.sprite(x0 + seat.x, y0 + seat.y, couple.texture, pair[seatIndex] * 3)
                        .setOrigin(0.5, 1)
                        .setFlipX(seat.flipX)
                        .setDepth(SEATED_DEPTH)
                }))
            });
        });
    }

    /** A horda espera os skatistas sumirem. */
    get isCrossing() {
        return this.skaters.length > 0;
    }

    update(delta: number, player: SkaterTarget | undefined, enemies: readonly Readonly<{ sprite: Point; health: { isAlive: boolean } }>[]) {
        this.updateSkaters(delta, player);
        this.updateMerchants(delta);
        this.updateCouples(delta, player, enemies);
    }

    private updateMerchants(delta: number) {
        const { speed } = MERCADO_NPCS.merchants;
        for (const merchant of this.merchants) {
            const { sprite } = merchant;
            if (merchant.wait > 0) {
                merchant.wait -= delta;
                continue;
            }
            const target = merchant.route[merchant.index];
            const dx = target.x - sprite.x;
            const dy = target.y - sprite.y;
            const distance = Math.hypot(dx, dy);
            const step = speed * delta / 1000;
            if (distance <= step) {
                sprite.setPosition(target.x, target.y);
                merchant.wait = target.wait;
                merchant.index = (merchant.index + 1) % merchant.route.length;
                if (target.pose) sprite.setFlipX(false).play(`comerciante-${merchant.row}-${target.pose}`, true);
            } else {
                sprite.setPosition(sprite.x + dx / distance * step, sprite.y + dy / distance * step);
                const pose: MerchantPose = Math.abs(dx) > Math.abs(dy) ? 'lado' : dy > 0 ? 'frente' : 'costas';
                sprite.setFlipX(pose === 'lado' && dx < 0).play(`comerciante-${merchant.row}-${pose}`, true);
            }
            sprite.setDepth(getActorDepth(sprite.y));
            this.cropBehindCounter(merchant);
        }
    }

    /** Atrás do balcão só aparece do balcão para cima. */
    private cropBehindCounter({ sprite, stallX }: Merchant) {
        const { frameWidth, frameHeight, counterTopY, counterBottomY } = MERCADO_NPCS.merchants;
        const isBehind = sprite.y < counterBottomY && sprite.x > stallX && sprite.x < stallX + 48;
        const hidden = isBehind ? Math.max(0, sprite.y - counterTopY) : 0;
        if (hidden > 0) sprite.setCrop(0, 0, frameWidth, frameHeight - hidden);
        else sprite.setCrop();
    }

    private updateSkaters(delta: number, player: SkaterTarget | undefined) {
        const { speed, damage, hitbox, fadeDuration } = MERCADO_NPCS.skaters;
        const body = player?.sprite.body;
        for (const skater of [...this.skaters]) {
            if (skater.delay > 0) {
                skater.delay -= delta;
                continue;
            }
            const { sprite } = skater;
            if (!sprite.anims.isPlaying) sprite.play(skater.animation);
            sprite.y += skater.direction * speed * delta / 1000;
            sprite.setDepth(getActorDepth(sprite.y));
            if (body && !skater.leaving && overlaps(body, {
                x: sprite.x - hitbox.width / 2,
                y: sprite.y - hitbox.height,
                width: hitbox.width,
                height: hitbox.height
            })) {
                this.hasRunOverPlayer = true;
                player?.takeDamage(damage);
            }
            const arrived = skater.direction > 0 ? sprite.y >= skater.toY : sprite.y <= skater.toY;
            if (arrived && !skater.leaving) {
                // Some entrando no mercado ou saindo pela borda de baixo.
                skater.leaving = true;
                this.scene.tweens.add({
                    targets: sprite,
                    alpha: 0,
                    duration: fadeDuration,
                    onComplete: () => {
                        sprite.destroy();
                        this.skaters.splice(this.skaters.indexOf(skater), 1);
                    }
                });
            }
        }
    }

    private updateCouples(
        delta: number,
        player: SkaterTarget | undefined,
        enemies: readonly Readonly<{ sprite: Point; health: { isAlive: boolean } }>[]
    ) {
        const { playerDistance, enemyDistance, runSpeed, fadeDuration } = MERCADO_NPCS.couple;
        const body = player?.sprite.body;
        const playerCenter = body ? { x: body.x + body.width / 2, y: body.y + body.height / 2 } : undefined;
        for (const couple of this.couples) {
            if (couple.fleeing) {
                for (const { sprite } of couple.people) {
                    sprite.x += (sprite.flipX ? -1 : 1) * runSpeed * delta / 1000;
                    sprite.setDepth(getActorDepth(sprite.y));
                }
                continue;
            }
            if (!playerCenter || distance(playerCenter, couple.center) > playerDistance) continue;
            if (!enemies.some((enemy) => enemy.health.isAlive && distance(enemy.sprite, couple.center) <= enemyDistance)) continue;

            couple.fleeing = true;
            // Correm para o lado oposto ao do jogador.
            const runLeft = playerCenter.x > couple.center.x;
            for (const person of couple.people) {
                person.sprite.setFlipX(runLeft).play(`casal-${person.row}-corre`);
                this.scene.tweens.add({
                    targets: person.sprite,
                    alpha: 0,
                    duration: fadeDuration,
                    onComplete: () => {
                        person.sprite.destroy();
                        couple.people = couple.people.filter((other) => other !== person);
                    }
                });
            }
        }
    }

    destroy() {
        const people = this.couples.flatMap((couple) => couple.people.map(({ sprite }) => sprite));
        this.scene.tweens.killTweensOf([...this.skaters.map(({ sprite }) => sprite), ...people]);
        for (const { sprite } of this.skaters) sprite.destroy();
        for (const sprite of [...this.merchants.map(({ sprite }) => sprite), ...people]) sprite.destroy();
        this.skaters.length = 0;
        this.merchants.length = 0;
        this.couples.length = 0;
    }
}

function overlaps(a: Rect, b: Rect) {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function distance(a: Point, b: Point) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
