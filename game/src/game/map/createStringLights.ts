import type { Scene } from 'phaser';
import { STRING_LIGHTS } from '../config/tchay';

// Acima dos personagens (10) e dos telhados (20): o varal passa por cima de tudo na rua.
const STRING_LIGHTS_DEPTH = 21;

/** Varal de lâmpadas: fio caindo em curva entre os pontos e lâmpadas quentes com brilho. */
export function createStringLights(scene: Scene, config = STRING_LIGHTS) {
    const wire = scene.add.graphics().setDepth(STRING_LIGHTS_DEPTH);
    const glow = scene.add.graphics().setDepth(STRING_LIGHTS_DEPTH).setBlendMode(1);
    const bulbs = scene.add.graphics().setDepth(STRING_LIGHTS_DEPTH);
    wire.lineStyle(1, 0x1a1a1a, 0.9);
    const { points, sagBase, sagPerPixel, bulbSpacing, color } = config;
    for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const sag = sagBase + length * sagPerPixel;
        const steps = Math.max(2, Math.round(length / 4));
        const at = (t: number) => ({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t + sag * 4 * t * (1 - t)
        });
        wire.beginPath();
        wire.moveTo(a.x, a.y);
        for (let s = 1; s <= steps; s += 1) {
            const p = at(s / steps);
            wire.lineTo(p.x, p.y);
        }
        wire.strokePath();
        const count = Math.floor(length / bulbSpacing);
        for (let k = 1; k < count; k += 1) {
            const p = at(k / count);
            glow.fillStyle(color, 0.18).fillCircle(p.x, p.y + 1, 4);
            bulbs.fillStyle(color, 1).fillRect(Math.round(p.x) - 1, Math.round(p.y), 2, 2);
        }
    }
    // Gancho de metal onde o fio se prende na parede.
    for (const point of points) {
        if (point.anchor !== 'gancho') continue;
        wire.fillStyle(0x1a1a1a, 1).fillRect(point.x - 2, point.y - 3, 4, 3);
        wire.fillStyle(0x6a7078, 1).fillRect(point.x - 1, point.y - 2, 2, 1);
    }
    // Brilho respirando devagar, como lâmpadas de festa.
    scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.6 }, duration: 1_400, yoyo: true, repeat: -1 });
    return [wire, glow, bulbs];
}
