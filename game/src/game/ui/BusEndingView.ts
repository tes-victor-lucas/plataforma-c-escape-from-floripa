import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { TICEN_ESCAPE } from '../config/ticen';
import { WALK_FRAMES, walkAnimationKey } from '../entities/PlayerAnimations';

const DEPTH = 400;

/**
 * Final solo dentro do 763.2, desenhado no HUD por cima de tudo: o jogador entra pela porta da frente,
 * senta e a cidade começa a correr pela janela. Termina com a tela preta, para o mundo mostrar a partida.
 */
export class BusEndingView {
    private readonly curtain: Phaser.GameObjects.Rectangle;
    private readonly objects: Phaser.GameObjects.GameObject[] = [];

    constructor(private readonly scene: Scene, private readonly playerTexture: string) {
        this.curtain = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000).setOrigin(0).setDepth(DEPTH + 1).setAlpha(0);
    }

    play(onDark: () => void) {
        this.scene.tweens.add({ targets: this.curtain, alpha: 1, duration: 350, onComplete: () => this.board(onDark) });
    }

    /** Some com a tela preta e com o interior, mostrando o mundo de novo. */
    reveal() {
        for (const object of this.objects) object.destroy();
        this.scene.tweens.add({ targets: this.curtain, alpha: 0, duration: 350, onComplete: () => this.curtain.destroy() });
    }

    private board(onDark: () => void) {
        const { interior } = TICEN_ESCAPE;
        const scale = interior.scale;
        const sky = this.scene.add.image(0, 0, interior.skyTexture).setOrigin(0).setScale(scale).setDepth(DEPTH - 0.1);
        const view = this.scene.add.tileSprite(0, 0, GAME_WIDTH / scale, GAME_HEIGHT / scale, interior.viewTexture)
            .setOrigin(0).setScale(scale).setDepth(DEPTH);
        const room = this.scene.add.image(0, 0, interior.texture).setOrigin(0).setScale(scale).setDepth(DEPTH + 0.1);
        // Passageiros por cima dos bancos e abaixo do jogador, que passa na frente deles pelo corredor.
        const passengers = this.scene.add.image(0, 0, interior.passengersTexture).setOrigin(0).setScale(scale).setDepth(DEPTH + 0.35);
        this.objects.push(sky, passengers, ...this.floatDust());
        // Entra pela porta da frente (direita) andando para o fundo do ônibus.
        // No corredor ele passa na frente dos bancos; ao sentar, fica entre o encosto dele e o banco da frente.
        const player = this.scene.add.sprite(GAME_WIDTH + 60, interior.floorY * scale, this.playerTexture, WALK_FRAMES.left[0])
            .setOrigin(0.5, 1).setScale(interior.playerScale).setDepth(DEPTH + 0.4);
        const front = this.scene.add.image(0, 0, interior.frontTexture).setOrigin(0).setScale(scale).setDepth(DEPTH + 0.3);
        this.objects.push(view, room, player, front);
        this.scene.tweens.add({ targets: this.curtain, alpha: 0, duration: 350 });
        player.play(walkAnimationKey(this.playerTexture, 'left'));
        this.scene.tweens.add({
            targets: player,
            x: interior.seatX * scale,
            duration: interior.walkTime,
            onComplete: () => {
                // Vira para a frente do ônibus e senta: o banco cobre as pernas.
                player.anims.stop();
                player.setFrame(WALK_FRAMES.right[0]).setDepth(DEPTH + 0.2);
                this.scene.tweens.add({
                    targets: player,
                    y: interior.seatedFeetY * scale,
                    duration: 180,
                    ease: 'Quad.easeOut',
                    onComplete: () => this.scene.time.delayedCall(interior.seatedPause, () => this.depart(view, onDark))
                });
            }
        });
    }

    /** Poeira vermelha flutuando nos feixes de luz que entram pelas janelas. */
    private floatDust() {
        const { scale } = TICEN_ESCAPE.interior;
        return Array.from({ length: 26 }, () => {
            const x = (40 + Math.random() * 170) * scale;
            const y = (40 + Math.random() * 110) * scale;
            const mote = this.scene.add.rectangle(x, y, scale, scale, 0xff6070, 0.5 + Math.random() * 0.4).setDepth(DEPTH + 0.15);
            this.scene.tweens.add({
                targets: mote,
                x: x - (8 + Math.random() * 12) * scale,
                y: y + (4 + Math.random() * 8) * scale,
                alpha: 0.1,
                duration: 2500 + Math.random() * 2500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            return mote;
        });
    }

    /** O ônibus sai: a cidade acelera para trás na janela e o chão treme de leve. */
    private depart(view: Phaser.GameObjects.TileSprite, onDark: () => void) {
        const { departTime } = TICEN_ESCAPE.interior;
        this.scene.cameras.main.shake(departTime, 0.0015);
        this.scene.tweens.add({ targets: view, tilePositionX: GAME_WIDTH * 1.4, duration: departTime, ease: 'Quad.easeIn' });
        this.scene.tweens.add({
            targets: this.curtain,
            alpha: 1,
            delay: departTime - 400,
            duration: 400,
            onComplete: onDark
        });
    }
}
