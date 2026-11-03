import type { Scene } from 'phaser';

const DEFAULT_BACKGROUND = 0x0c1219;

function drawLine(
    graphics: Phaser.GameObjects.Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number
) {
    graphics.beginPath().moveTo(x1, y1).lineTo(x2, y2).strokePath();
}

function drawBullet(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    scale = 1
) {
    const halfHeight = 7 * scale;
    const left = x - 17 * scale;
    const bodyEnd = x + 8 * scale;
    graphics.beginPath();
    graphics.moveTo(left, y - halfHeight);
    graphics.lineTo(bodyEnd, y - halfHeight);
    graphics.lineTo(x + 18 * scale, y);
    graphics.lineTo(bodyEnd, y + halfHeight);
    graphics.lineTo(left, y + halfHeight);
    graphics.closePath().strokePath();
}

function drawImpact(graphics: Phaser.GameObjects.Graphics) {
    const points = Array.from({ length: 16 }, (_, index) => {
        const angle = -Math.PI / 2 + index * Math.PI / 8;
        const radius = index % 2 === 0 ? 27 : 12;
        return new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
    graphics.strokePoints(points, true);
}

function drawDrone(graphics: Phaser.GameObjects.Graphics) {
    graphics.strokeRect(-15, -13, 30, 26);
    graphics.strokeRect(-7, -5, 14, 10);
    graphics.fillRect(-31, -8, 12, 7).fillRect(19, -8, 12, 7);
    drawLine(graphics, -19, -5, -15, -5);
    drawLine(graphics, 15, -5, 19, -5);
    drawLine(graphics, -9, 13, -17, 24);
    drawLine(graphics, 9, 13, 17, 24);
}

function drawHeart(graphics: Phaser.GameObjects.Graphics) {
    graphics
        .fillRect(-20, -16, 14, 9)
        .fillRect(6, -16, 14, 9)
        .fillRect(-25, -7, 50, 13)
        .fillRect(-18, 6, 36, 9)
        .fillRect(-10, 15, 20, 8);
}

function drawDrink(graphics: Phaser.GameObjects.Graphics, garnish: boolean) {
    graphics.beginPath();
    graphics.moveTo(-21, -18);
    graphics.lineTo(21, -18);
    graphics.lineTo(10, 9);
    graphics.lineTo(-10, 9);
    graphics.closePath().strokePath();
    drawLine(graphics, 0, 9, 0, 24);
    drawLine(graphics, -14, 24, 14, 24);
    if (garnish) {
        drawLine(graphics, 8, -18, 22, -28);
        graphics.strokeCircle(25, -30, 5);
    }
}

/** Desenha o símbolo compartilhado pelas cartas e pelo resumo do menu de pausa. */
export function createUpgradeIcon(
    scene: Scene,
    id: string,
    color: number,
    backgroundColor = DEFAULT_BACKGROUND
) {
    const icon = scene.add.graphics();
    icon.lineStyle(3, color, 1);
    icon.fillStyle(color, 1);

    switch (id) {
        case 'attack-range':
            icon.strokeCircle(0, 0, 22).strokeCircle(0, 0, 11);
            drawLine(icon, -29, 0, -17, 0);
            drawLine(icon, 17, 0, 29, 0);
            drawLine(icon, 0, -29, 0, -17);
            drawLine(icon, 0, 17, 0, 29);
            break;
        case 'projectile-speed':
            drawBullet(icon, 4, 0);
            drawLine(icon, -29, -10, -14, -10);
            drawLine(icon, -34, 0, -14, 0);
            drawLine(icon, -29, 10, -14, 10);
            break;
        case 'projectile-damage':
            drawImpact(icon);
            break;
        case 'fire-rate':
            drawBullet(icon, 9, -15, 0.7);
            drawBullet(icon, 2, 0, 0.7);
            drawBullet(icon, 9, 15, 0.7);
            drawLine(icon, -30, -15, -13, -15);
            drawLine(icon, -36, 0, -20, 0);
            drawLine(icon, -30, 15, -13, 15);
            break;
        case 'double-shot':
            drawBullet(icon, 5, -11, 0.85);
            drawBullet(icon, 5, 11, 0.85);
            drawLine(icon, -30, -11, -14, -11);
            drawLine(icon, -30, 11, -14, 11);
            break;
        case 'piercing-shot':
            icon.strokeCircle(-3, 0, 21).strokeCircle(-3, 0, 11);
            drawBullet(icon, 14, 0, 0.72);
            drawLine(icon, -32, 0, -15, 0);
            break;
        case 'companion-drone':
            drawDrone(icon);
            break;
        case 'max-health':
            drawHeart(icon);
            icon.fillStyle(backgroundColor, 1)
                .fillRect(-3, -7, 6, 22)
                .fillRect(-11, 1, 22, 6);
            break;
        case 'emergency-repair':
            drawHeart(icon);
            icon.fillStyle(backgroundColor, 1)
                .fillRect(-3, -7, 6, 22)
                .fillRect(-11, 1, 22, 6);
            drawLine(icon, 17, 13, 29, 25);
            break;
        case 'gin-tropical':
            drawDrink(icon, true);
            break;
        case 'gin-melancia':
            drawDrink(icon, false);
            icon.strokeCircle(19, -16, 7);
            break;
        case 'cookie-magico':
            icon.strokeCircle(0, 0, 25);
            icon.fillCircle(-10, -8, 3)
                .fillCircle(9, -11, 3)
                .fillCircle(12, 8, 3)
                .fillCircle(-8, 11, 3);
            break;
        default:
            icon.beginPath();
            icon.moveTo(0, -25);
            icon.lineTo(25, 0);
            icon.lineTo(0, 25);
            icon.lineTo(-25, 0);
            icon.closePath().strokePath();
    }

    return icon;
}
