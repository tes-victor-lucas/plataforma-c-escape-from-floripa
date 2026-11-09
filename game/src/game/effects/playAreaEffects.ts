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
