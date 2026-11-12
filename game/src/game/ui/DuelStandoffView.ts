import type { Scene } from 'phaser';
import { CHARACTERS } from '../config/characters';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { WALK_FRAMES } from '../entities/PlayerAnimations';
import { EASE_IN_OUT, EASE_OUT, prefersReducedMotion } from './easing';

// Faixa dos olhos no frame de 38 px: 22 de largura centrada no rosto e 7 de altura centrada nos olhos.
const FRAME = 38;
const CROP = { width: 22, height: 7 };
const SCALE = 27;
const STRIP_HEIGHT = CROP.height * SCALE;
// No fim, as pálpebras deixam só esta fresta aberta em volta dos olhos.
const SLIT = 3 * SCALE;
// O zoom lento faz o rosto passar da faixa: as pálpebras já nascem cobrindo essa sobra por fora.
const OVERFLOW = 24;
const DEPTH = 300;
// Faroeste: o rosto contra a areia clara, e o resto da tela escuro.
const SAND = 0xc9a46a;
const NIGHT = 0x120a05;
// Raio do confronto: do canto de baixo à esquerda ao de cima à direita, em zigue-zague.
// Dobras fixas, e não sorteadas, para a cena ser igual nas duas telas: [fração do caminho, desvio perpendicular em px].
const BOLT_KINKS: readonly (readonly [number, number])[] = [
    [0.08, 34], [0.16, -22], [0.24, 48], [0.31, -40], [0.4, 22], [0.47, -55], [0.55, 30],
    [0.63, -26], [0.7, 52], [0.78, -38], [0.86, 24], [0.93, -18]
];
const BOLT = { color: 0xe90931, core: 0xffe2e6, strike: 1250, draw: 220 };
const VS_COLOR = '#2f6bff';

/** Pontos do raio na tela, com as pontas um pouco para fora para ele atravessar a tela inteira. */
export function getBoltPoints(width: number, height: number) {
    const start = { x: -20, y: height + 20 };
    const end = { x: width + 20, y: -20 };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normal = { x: (start.y - end.y) / length, y: (end.x - start.x) / length };
    return [start, ...BOLT_KINKS.map(([along, offset]) => ({
        x: start.x + (end.x - start.x) * along + normal.x * offset,
        y: start.y + (end.y - start.y) * along + normal.y * offset
    })), end];
}

/** Trecho do caminho já percorrido, de 0 a 1, cortando o último segmento no meio se preciso. */
export function getPartialPath(points: readonly Readonly<{ x: number; y: number }>[], progress: number) {
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let remaining = Math.max(0, Math.min(1, progress)) * lengths.reduce((sum, length) => sum + length, 0);
    const path = [points[0]];
    for (const [index, length] of lengths.entries()) {
        const from = points[index];
        const to = points[index + 1];
        if (remaining >= length) {
            path.push(to);
            remaining -= length;
            continue;
        }
        if (remaining > 0) path.push({ x: from.x + (to.x - from.x) * remaining / length, y: from.y + (to.y - from.y) * remaining / length });
        break;
    }
    return path;
}

/**
 * Close de duelo antes da disputa: duas faixas com os olhos de cada um contra a areia, entrando de lados opostos,
 * apertando até virar uma fresta, e o "1 X 1" por cima. Cada cliente toca a sua; não depende de rede.
 */
export class DuelStandoffView {
    /** Com movimento reduzido: nada desliza nem cresce, a fresta já nasce fechada e não há clarão. */
    private readonly reduce = prefersReducedMotion();

    constructor(private readonly scene: Scene, private readonly textures: readonly [string, string]) {}

    play(onDone: () => void) {
        const { scene } = this;
        const parts: Phaser.GameObjects.GameObject[] = [];
        const background = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, NIGHT).setDepth(DEPTH).setAlpha(0);
        parts.push(background);
        scene.tweens.add({ targets: background, alpha: 1, duration: 150, ease: EASE_OUT });
        this.textures.forEach((texture, index) => parts.push(...this.playStrip(texture, index)));
        parts.push(this.playBolt());
        const title = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'VS', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '88px',
            color: VS_COLOR,
            stroke: '#120a05',
            strokeThickness: 12
        }).setOrigin(0.5).setDepth(DEPTH + 6).setResolution(2).setScale(this.reduce ? 1 : 0.9).setAlpha(0);
        parts.push(title);
        // Nada surge do zero: o VS chega de 90% junto com a opacidade, logo depois do raio, sem quique.
        scene.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 200, delay: BOLT.strike + BOLT.draw, ease: EASE_OUT });
        scene.time.delayedCall(2500, () => {
            if (!this.reduce) scene.cameras.main.flash(180, 255, 255, 255);
            scene.tweens.add({
                targets: parts,
                alpha: 0,
                duration: 260,
                ease: EASE_OUT,
                onComplete: () => {
                    for (const part of parts) part.destroy();
                    onDone();
                }
            });
        });
    }

    /** O raio corta a tela quando as pálpebras terminam de fechar: desenha de ponta a ponta, com brilho e um tremor. */
    private playBolt() {
        const { scene } = this;
        const points = getBoltPoints(GAME_WIDTH, GAME_HEIGHT);
        const bolt = scene.add.graphics().setDepth(DEPTH + 5);
        const draw = (progress: number) => {
            // O Phaser só lê x e y de cada ponto; a conversão é só de tipo.
            const path = getPartialPath(points, progress) as Phaser.Math.Vector2[];
            bolt.clear();
            if (path.length < 2) return;
            // Halo largo e transparente por baixo, núcleo claro por cima: lê como luz, não como risco.
            bolt.lineStyle(22, BOLT.color, 0.3).strokePoints(path);
            bolt.lineStyle(8, BOLT.color, 1).strokePoints(path);
            bolt.lineStyle(3, BOLT.core, 1).strokePoints(path);
        };
        if (this.reduce) {
            draw(1);
            bolt.setAlpha(0);
            scene.tweens.add({ targets: bolt, alpha: 1, duration: 200, delay: BOLT.strike, ease: EASE_OUT });
            return bolt;
        }
        const strike = { progress: 0 };
        scene.tweens.add({
            targets: strike,
            progress: 1,
            duration: BOLT.draw,
            delay: BOLT.strike,
            ease: EASE_OUT,
            onUpdate: () => draw(strike.progress),
            onComplete: () => scene.cameras.main.shake(140, 0.006)
        });
        return bolt;
    }

    /** Uma faixa: areia, o rosto de frente recortado nos olhos e ampliado, as pálpebras e de quem é. */
    private playStrip(texture: string, index: number) {
        const { scene } = this;
        const eyesY = Object.values(CHARACTERS).find((character) => character.texture === texture)?.eyesY ?? CHARACTERS.padrao.eyesY;
        const cropX = (FRAME - CROP.width) / 2;
        const cropY = Math.round(eyesY - CROP.height / 2);
        const centerY = GAME_HEIGHT / 2 + (index === 0 ? -1 : 1) * (STRIP_HEIGHT / 2 + 14);
        const enterFrom = index === 0 ? -GAME_WIDTH : GAME_WIDTH;
        const delay = 120 + index * 160;
        const startX = GAME_WIDTH / 2 + (this.reduce ? 0 : enterFrom);
        const sand = scene.add.rectangle(startX, centerY, GAME_WIDTH, STRIP_HEIGHT, SAND).setDepth(DEPTH + 1);
        // Origem na linha dos olhos: eles ficam no meio da faixa, onde a fresta fecha, e o zoom cresce a partir deles.
        const face = scene.add.image(startX, centerY, texture, WALK_FRAMES.down[0])
            .setCrop(cropX, cropY, CROP.width, CROP.height)
            .setOrigin((cropX + CROP.width / 2) / FRAME, eyesY / FRAME)
            .setScale(SCALE)
            .setDepth(DEPTH + 2);
        if (this.reduce) {
            sand.setAlpha(0);
            face.setAlpha(0);
            scene.tweens.add({ targets: [sand, face], alpha: 1, duration: 200, delay, ease: EASE_OUT });
        } else {
            scene.tweens.add({ targets: [sand, face], x: GAME_WIDTH / 2, duration: 380, delay, ease: EASE_OUT });
            // Zoom contínuo, como a câmera chegando perto: linear, sem acelerar nem frear.
            scene.tweens.add({ targets: face, scale: SCALE * 1.08, duration: 2200, delay: 400, ease: 'Linear' });
        }
        // Pálpebras: cobrem a faixa de cima e de baixo e fecham devagar até sobrar a fresta dos olhos.
        const lidHeight = (STRIP_HEIGHT - SLIT) / 2;
        // Presas na borda da faixa, com altura zero, crescem para dentro: nunca invadem a outra faixa.
        const fullHeight = lidHeight + OVERFLOW;
        const lids = [-1, 1].map((side) => scene.add.rectangle(GAME_WIDTH / 2, centerY + side * (STRIP_HEIGHT / 2 + OVERFLOW), GAME_WIDTH, fullHeight, NIGHT)
            .setOrigin(0.5, side < 0 ? 0 : 1)
            .setScale(1, this.reduce ? 1 : OVERFLOW / fullHeight)
            .setDepth(DEPTH + 3));
        // As pálpebras se mexem com tudo já na tela: ida e volta forte, devagar no começo e no fim.
        if (!this.reduce) scene.tweens.add({ targets: lids, scaleY: 1, duration: 700, delay: 700, ease: EASE_IN_OUT });
        // Cada um no seu lado do raio: VOCÊ em cima à esquerda, PARCEIRO embaixo à direita, longe do corte.
        const label = scene.add.text(
            index === 0 ? 24 : GAME_WIDTH - 24,
            centerY + (index === 0 ? -STRIP_HEIGHT / 2 + 4 : STRIP_HEIGHT / 2 - 4),
            index === 0 ? 'VOCÊ' : 'PARCEIRO',
            { fontFamily: 'PixelGamer, monospace', fontSize: '18px', color: '#f4efe6' }
        ).setOrigin(index === 0 ? 0 : 1, index === 0 ? 0 : 1).setDepth(DEPTH + 6).setResolution(2).setAlpha(0);
        scene.tweens.add({ targets: label, alpha: 1, duration: 200, delay: delay + 380, ease: EASE_OUT });
        return [sand, face, ...lids, label];
    }
}
