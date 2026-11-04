import type { Scene } from 'phaser';
import { Health } from '../combat/Health';
import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import type { RemotePlayerState } from '../network/protocol';
import type { Direction } from './Player';

/** Barra sobre a cabeça, usada para a vida do parceiro e para a ajuda ao caído. */
export function drawPlayerBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    ratio: number,
    color: number
) {
    const width = 26;
    graphics.clear();
    graphics.fillStyle(0x00171b).fillRect(x - width / 2, y, width, 5);
    graphics.fillStyle(color).fillRect(x - width / 2 + 1, y + 1, (width - 2) * ratio, 3);
}

/** Representação interpolada de um jogador controlado por outro cliente. */
export class RemotePlayer {
    readonly sprite: Phaser.GameObjects.Sprite;
    readonly health = new Health(COMBAT_CONFIG.player.maxHealth);
    /** Inimigos no anfitrião miram aqui e entregam o dano por `onDamage`. */
    readonly target;
    private readonly bar: Phaser.GameObjects.Graphics;
    private readonly center = { x: 0, y: 0 };
    private position: { x: number; y: number };
    private lastSequence = -1;
    private facing: Direction = 'down';
    private reviveProgress = 0;
    revivesLeft: number = COMBAT_CONFIG.multiplayer.maxRevives;

    constructor(scene: Scene, x: number, y: number, onDamage: (amount: number) => void) {
        const { player } = WORLD_CONFIG;
        this.sprite = scene.add.sprite(x, y, player.texture, player.initialFrame)
            .setScale(player.scale)
            .setDepth(9)
            .setTint(0x66ccff);
        this.bar = scene.add.graphics().setDepth(25);
        this.position = { x, y };
        this.target = {
            health: this.health,
            sprite: { body: { center: this.center } },
            takeDamage: onDamage
        };
    }

    get isAlive() {
        return this.health.isAlive;
    }

    /** Posição dos pés, a mesma referência usada pelas colisões do jogador local. */
    get feet() {
        return this.center;
    }

    applyState(state: RemotePlayerState) {
        if (state.sequence <= this.lastSequence) return;
        this.lastSequence = state.sequence;
        this.position = { x: state.x, y: state.y };
        this.facing = state.facing;
        this.health.restore(state.health, state.maxHealth);
        this.reviveProgress = state.reviveProgress;
        this.revivesLeft = state.revivesLeft;
    }

    update(feetOffset: { x: number; y: number }) {
        const distance = Phaser.Math.Distance.Between(
            this.sprite.x,
            this.sprite.y,
            this.position.x,
            this.position.y
        );
        this.sprite.setPosition(
            Phaser.Math.Linear(this.sprite.x, this.position.x, 0.35),
            Phaser.Math.Linear(this.sprite.y, this.position.y, 0.35)
        );
        this.center.x = this.sprite.x + feetOffset.x;
        this.center.y = this.sprite.y + feetOffset.y;

        const isAlive = this.health.isAlive;
        this.sprite.setAngle(isAlive ? 0 : 90);
        if (isAlive && distance > 1) {
            this.sprite.anims.play(`player-walk-${this.facing}`, true);
        } else {
            this.sprite.anims.stop();
        }
        drawPlayerBar(
            this.bar,
            this.sprite.x,
            this.sprite.y - 24,
            isAlive ? this.health.current / this.health.max : this.reviveProgress,
            isAlive ? 0x5ce5f1 : 0x8affc1
        );
    }

    destroy() {
        this.bar.destroy();
        this.sprite.destroy();
    }
}
