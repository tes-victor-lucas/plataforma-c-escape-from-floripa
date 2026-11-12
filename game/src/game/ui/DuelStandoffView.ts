import type { Scene } from 'phaser';
import { CHARACTERS } from '../config/characters';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { WALK_FRAMES } from '../entities/PlayerAnimations';

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

/**
 * Close de duelo antes da disputa: duas faixas com os olhos de cada um contra a areia, entrando de lados opostos,
 * apertando até virar uma fresta, e o "1 X 1" por cima. Cada cliente toca a sua; não depende de rede.
 */
export class DuelStandoffView {
    constructor(private readonly scene: Scene, private readonly textures: readonly [string, string]) {}

    play(onDone: () => void) {
        const { scene } = this;
        const parts: Phaser.GameObjects.GameObject[] = [];
        const background = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, NIGHT).setDepth(DEPTH).setAlpha(0);
        parts.push(background);
        scene.tweens.add({ targets: background, alpha: 1, duration: 150 });
        this.textures.forEach((texture, index) => parts.push(...this.playStrip(texture, index)));
        const title = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '1 X 1', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '56px',
            color: '#f4efe6',
            stroke: '#120a05',
            strokeThickness: 10
        }).setOrigin(0.5).setDepth(DEPTH + 5).setResolution(2).setScale(0);
        parts.push(title);
        scene.tweens.add({ targets: title, scale: 1, duration: 220, delay: 1300, ease: 'Back.easeOut' });
        scene.time.delayedCall(2500, () => {
            scene.cameras.main.flash(180, 255, 255, 255);
            scene.tweens.add({
                targets: parts,
                alpha: 0,
                duration: 260,
                onComplete: () => {
                    for (const part of parts) part.destroy();
                    onDone();
                }
            });
        });
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
        const sand = scene.add.rectangle(GAME_WIDTH / 2 + enterFrom, centerY, GAME_WIDTH, STRIP_HEIGHT, SAND).setDepth(DEPTH + 1);
        // Origem na linha dos olhos: eles ficam no meio da faixa, onde a fresta fecha, e o zoom cresce a partir deles.
        const face = scene.add.image(GAME_WIDTH / 2 + enterFrom, centerY, texture, WALK_FRAMES.down[0])
            .setCrop(cropX, cropY, CROP.width, CROP.height)
            .setOrigin((cropX + CROP.width / 2) / FRAME, eyesY / FRAME)
            .setScale(SCALE)
            .setDepth(DEPTH + 2);
        scene.tweens.add({ targets: [sand, face], x: GAME_WIDTH / 2, duration: 380, delay, ease: 'Cubic.easeOut' });
        scene.tweens.add({ targets: face, scale: SCALE * 1.08, duration: 2200, delay: 400 });
        // Pálpebras: cobrem a faixa de cima e de baixo e fecham devagar até sobrar a fresta dos olhos.
        const lidHeight = (STRIP_HEIGHT - SLIT) / 2;
        // Presas na borda da faixa, com altura zero, crescem para dentro: nunca invadem a outra faixa.
        const fullHeight = lidHeight + OVERFLOW;
        const lids = [-1, 1].map((side) => scene.add.rectangle(GAME_WIDTH / 2, centerY + side * (STRIP_HEIGHT / 2 + OVERFLOW), GAME_WIDTH, fullHeight, NIGHT)
            .setOrigin(0.5, side < 0 ? 0 : 1)
            .setScale(1, OVERFLOW / fullHeight)
            .setDepth(DEPTH + 3));
        scene.tweens.add({ targets: lids, scaleY: 1, duration: 700, delay: 700, ease: 'Sine.easeInOut' });
        const label = scene.add.text(24, centerY + (index === 0 ? -STRIP_HEIGHT / 2 + 4 : STRIP_HEIGHT / 2 - 4), index === 0 ? 'VOCÊ' : 'PARCEIRO', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '18px',
            color: '#f4efe6'
        }).setOrigin(0, index === 0 ? 0 : 1).setDepth(DEPTH + 4).setResolution(2).setAlpha(0);
        scene.tweens.add({ targets: label, alpha: 1, duration: 200, delay: delay + 380 });
        return [sand, face, ...lids, label];
    }
}
