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
        case 'heavy-rounds':
            drawImpact(icon);
            break;
        case 'fire-rate':
        case 'overclock':
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
        case 'shock-pulse':
        case 'nova-pulse':
            icon.fillCircle(0, 0, 5);
            icon.strokeCircle(0, 0, 14).strokeCircle(0, 0, 25);
            break;
        case 'blast-shot':
            drawBullet(icon, -12, 0, 0.6);
            icon.strokeCircle(16, 0, 9);
            drawLine(icon, 16, -20, 16, -14);
            drawLine(icon, 16, 14, 16, 20);
            drawLine(icon, 30, 0, 36, 0);
            drawLine(icon, 26, -10, 30, -14);
            drawLine(icon, 26, 10, 30, 14);
            break;
        case 'spark-orbit':
            icon.strokeCircle(0, 0, 20);
            icon.fillCircle(0, -20, 6).fillCircle(17, 10, 6).fillCircle(-17, 10, 6);
            break;
        case 'chain-lightning':
        case 'thunder-storm':
            icon.beginPath();
            icon.moveTo(6, -28);
            icon.lineTo(-10, 2);
            icon.lineTo(4, 2);
            icon.lineTo(-6, 28);
            icon.lineTo(14, -4);
            icon.lineTo(0, -4);
            icon.closePath().strokePath();
            break;
        case 'death-blast':
            drawImpact(icon);
            icon.fillCircle(0, 0, 6);
            break;
        case 'light-beams':
            for (let index = 0; index < 8; index += 1) {
                const angle = index * Math.PI / 4;
                drawLine(icon, Math.cos(angle) * 10, Math.sin(angle) * 10, Math.cos(angle) * 27, Math.sin(angle) * 27);
            }
            icon.fillCircle(0, 0, 5);
            break;
        case 'ice-staff':
            // Floco de neve: três traços cruzados com pontas em V.
            for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
                const x = Math.cos(angle) * 24;
                const y = Math.sin(angle) * 24;
                drawLine(icon, -x, -y, x, y);
            }
            icon.fillCircle(0, 0, 5);
            break;
        case 'fire-staff':
            // Cajado na diagonal com uma chama de três línguas na ponta.
            drawLine(icon, -16, 20, 8, -6);
            icon.fillCircle(11, -10, 7);
            icon.fillTriangle(5, -12, 11, -28, 17, -12);
            icon.fillTriangle(15, -10, 24, -20, 18, -4);
            icon.fillTriangle(4, -8, -2, -18, 8, -14);
            break;
        case 'spin-slash':
            // Meia-lua girando em volta de um ponto.
            icon.fillCircle(0, 0, 4);
            icon.beginPath().arc(0, 0, 24, -Math.PI * 0.95, Math.PI * 0.1).strokePath();
            icon.beginPath().arc(0, 0, 17, -Math.PI * 0.6, Math.PI * 0.1).strokePath();
            drawLine(icon, 24 * Math.cos(Math.PI * 0.1), 24 * Math.sin(Math.PI * 0.1), 17 * Math.cos(Math.PI * 0.1), 17 * Math.sin(Math.PI * 0.1));
            break;
        case 'saw-orbit':
            icon.strokeCircle(0, 0, 21);
            for (const angle of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
                const x = Math.cos(angle) * 21;
                const y = Math.sin(angle) * 21;
                icon.fillCircle(x, y, 6);
                for (let tooth = 0; tooth < 6; tooth += 1) {
                    const toothAngle = tooth * Math.PI / 3;
                    drawLine(icon, x + Math.cos(toothAngle) * 6, y + Math.sin(toothAngle) * 6, x + Math.cos(toothAngle) * 10, y + Math.sin(toothAngle) * 10);
                }
            }
            break;
        case 'spiral-volley':
            // Pontos que se afastam do centro girando: a espiral de fragmentos.
            icon.fillCircle(0, 0, 3);
            for (let index = 1; index <= 7; index += 1) {
                const angle = -Math.PI / 2 + index * Math.PI / 3.2;
                const reach = 6 + index * 3.3;
                icon.fillCircle(Math.cos(angle) * reach, Math.sin(angle) * reach, 1.5 + index * 0.45);
            }
            break;
        case 'bombard':
            // Bombas caindo sobre dois alvos.
            icon.strokeCircle(-12, 14, 9).strokeCircle(14, 10, 9);
            icon.fillCircle(-12, -14, 5).fillCircle(14, -18, 5);
            drawLine(icon, -12, -8, -12, 2);
            drawLine(icon, 14, -12, 14, -2);
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
