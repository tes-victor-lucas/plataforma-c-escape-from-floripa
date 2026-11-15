import type { Scene } from 'phaser';

type Point = Readonly<{ x: number; y: number }>;

// Phaser.BlendModes.ADD: cores somadas brilham sobre o mapa escuro.
const ADD_BLEND = 1;

function createLayer(scene: Scene, depth: number) {
    return scene.add.graphics().setDepth(depth).setBlendMode(ADD_BLEND);
}

/** Some com desaceleração forte: o golpe aparece inteiro e se dissolve. */
function fadeOut(scene: Scene, target: Phaser.GameObjects.Graphics, duration: number, scale?: number) {
    scene.tweens?.add({
        targets: target,
        alpha: 0,
        ...(scale === undefined ? {} : { scale }),
        duration,
        ease: 'Expo.easeOut',
        onComplete: () => target.destroy()
    });
}

/** Pulso de choque: disco translúcido com borda grossa que cresce a partir do jogador. */
export function playShockwave(scene: Scene, x: number, y: number, radius: number, color: number) {
    const wave = createLayer(scene, 9).setPosition(x, y).setScale(0.25);
    wave.fillStyle(color, 0.16).fillCircle(0, 0, radius);
    wave.lineStyle(7, color, 0.75).strokeCircle(0, 0, radius);
    wave.lineStyle(2, 0xffffff, 0.9).strokeCircle(0, 0, radius - 5);
    fadeOut(scene, wave, 420, 1);
}

/** Explosão: clarão branco, bola de fogo e estilhaços na borda. */
export function playExplosion(scene: Scene, x: number, y: number, radius: number, color: number) {
    const blast = createLayer(scene, 13).setPosition(x, y).setScale(0.35);
    blast.fillStyle(color, 0.45).fillCircle(0, 0, radius);
    blast.fillStyle(0xffffff, 0.85).fillCircle(0, 0, radius * 0.35);
    blast.lineStyle(4, color, 1).strokeCircle(0, 0, radius);
    blast.fillStyle(color, 1);
    for (let index = 0; index < 10; index += 1) {
        const angle = index * Math.PI / 5;
        blast.fillRect(Math.cos(angle) * radius * 1.15 - 2.5, Math.sin(angle) * radius * 1.15 - 2.5, 5, 5);
    }
    fadeOut(scene, blast, 340, 1.15);
}

/** Feixes de luz: halo largo, faixa colorida e núcleo branco em cada direção. */
export function playBeams(scene: Scene, origin: Point, angles: readonly number[], length: number, color: number) {
    const beams = createLayer(scene, 14);
    for (const [width, tint, alpha] of [[18, color, 0.22], [8, color, 0.65], [3, 0xffffff, 1]] as const) {
        beams.lineStyle(width, tint, alpha);
        for (const angle of angles) {
            beams.lineBetween(
                origin.x,
                origin.y,
                origin.x + Math.cos(angle) * length,
                origin.y + Math.sin(angle) * length
            );
        }
    }
    beams.fillStyle(0xffffff, 0.9).fillCircle(origin.x, origin.y, 9);
    fadeOut(scene, beams, 280);
}

/** Raio em cadeia: traço em zigue-zague passando por cada alvo, com clarão no impacto. */
export function playLightning(scene: Scene, points: readonly Point[], color: number, random = Math.random) {
    if (points.length < 2) return;
    const path: Point[] = [points[0]];
    for (let index = 1; index < points.length; index += 1) {
        const from = points[index - 1];
        const to = points[index];
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const normal = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
        for (let step = 1; step < 5; step += 1) {
            const offset = (random() - 0.5) * 16;
            path.push({
                x: from.x + (to.x - from.x) * step / 5 + normal.x * offset,
                y: from.y + (to.y - from.y) * step / 5 + normal.y * offset
            });
        }
        path.push(to);
    }
    const bolt = createLayer(scene, 14);
    for (const [width, tint, alpha] of [[10, color, 0.3], [4, color, 0.85], [1.5, 0xffffff, 1]] as const) {
        bolt.lineStyle(width, tint, alpha);
        for (let index = 1; index < path.length; index += 1) {
            bolt.lineBetween(path[index - 1].x, path[index - 1].y, path[index].x, path[index].y);
        }
    }
    for (const point of points.slice(1)) {
        bolt.fillStyle(color, 0.45).fillCircle(point.x, point.y, 13);
        bolt.fillStyle(0xffffff, 0.95).fillCircle(point.x, point.y, 5);
    }
    fadeOut(scene, bolt, 240);
}

/** Quanto a espiral do Golpe giratório leva para sair do jogador e chegar ao raio; o dano acompanha a lâmina. */
export const SPIN_SLASH_DURATION = 450;
/** A lâmina sai do alto e gira no sentido horário. */
export const SPIN_SLASH_START = -Math.PI / 2;
/** Voltas da espiral até chegar ao raio. */
const SPIN_SLASH_TURNS = 1.5;
const SPIN_SLASH_GLOW = 0xe90931;

/** Raio da lâmina no instante `progress` (0 a 1): sai do jogador e cresce até o raio da carta. */
export function spinSlashReach(radius: number, progress: number) {
    return radius * Math.min(1, Math.max(0, progress));
}

/** Golpe giratório: uma lâmina branca de borda vermelha acesa sai do jogador em espiral até o raio. */
export function playSlash(scene: Scene, x: number, y: number, radius: number, color: number) {
    const slash = createLayer(scene, 14).setPosition(x, y);
    const totalAngle = SPIN_SLASH_TURNS * Math.PI * 2;
    // A cauda acompanha a espiral por pouco mais de meia volta e afina até sumir.
    const tailAngle = Math.PI * 1.1;
    const segments = 22;
    const baseWidth = Math.max(6, radius * 0.08);
    const pointAt = (angle: number) => {
        const reach = Math.max(6, spinSlashReach(radius, angle / totalAngle));
        return { x: Math.cos(SPIN_SLASH_START + angle) * reach, y: Math.sin(SPIN_SLASH_START + angle) * reach };
    };
    const draw = (progress: number) => {
        slash.clear();
        const head = progress * totalAngle;
        const points = Array.from({ length: segments + 1 }, (_, index) =>
            pointAt(Math.max(0, head - tailAngle * (1 - index / segments))));
        // Halo vermelho largo, borda vermelha e núcleo branco: a ponta é grossa e a cauda some.
        for (const [scale, extra, tint, alpha] of [
            [2.4, 4, SPIN_SLASH_GLOW, 0.3],
            [1.35, 2, SPIN_SLASH_GLOW, 0.85],
            [0.65, 0, color, 1]
        ] as const) {
            for (let index = 1; index <= segments; index += 1) {
                const weight = index / segments;
                slash.lineStyle(baseWidth * weight * scale + extra * weight, tint, alpha * (0.35 + weight * 0.65));
                slash.lineBetween(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y);
            }
        }
        const tip = points[segments];
        slash.fillStyle(SPIN_SLASH_GLOW, 0.55).fillCircle(tip.x, tip.y, baseWidth * 1.3);
        slash.fillStyle(0xffffff, 1).fillCircle(tip.x, tip.y, baseWidth * 0.45);
        if (progress >= 1) {
            // Ao chegar ao raio, um anel vermelho marca o alcance do golpe.
            slash.lineStyle(3, SPIN_SLASH_GLOW, 0.7).strokeCircle(0, 0, radius);
            slash.lineStyle(1, 0xffffff, 0.6).strokeCircle(0, 0, radius - 2);
        }
    };
    if (!scene.tweens?.addCounter) {
        draw(1);
        return;
    }
    draw(0);
    scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: SPIN_SLASH_DURATION,
        ease: 'Linear',
        onUpdate: (tween) => draw(tween.getValue() ?? 0),
        onComplete: () => {
            draw(1);
            fadeOut(scene, slash, 220);
        }
    });
}
