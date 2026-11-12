import type { Scene } from 'phaser';
import { Health } from '../combat/Health';
import { COMBAT_CONFIG } from '../config/combat';
import { getActorDepth, WORLD_CONFIG } from '../config/world';
import type { RemotePlayerState } from '../network/protocol';
import { CHARACTERS, isCharacterId, type CharacterId } from '../config/characters';
import { createWalkAnimations, walkAnimationKey, type Direction } from './PlayerAnimations';
import { decodeWornItems, ITEMS, type ItemId } from '../config/items';
import { attachWornItem } from './WornItem';

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
    private characterId: CharacterId = 'padrao';
    private orbitCount = 0;
    private orbitRadius = 0;
    private readonly orbitSparks: Phaser.GameObjects.Arc[] = [];
    private hasCompanion = false;
    private companion?: Phaser.GameObjects.Sprite;
    /** Itens que o parceiro está vestindo, desenhados aqui como no personagem dele. */
    private wornMask = 0;
    private readonly wornItems = new Map<ItemId, () => void>();

    constructor(scene: Scene, x: number, y: number, onDamage: (amount: number) => void) {
        const { player } = WORLD_CONFIG;
        createWalkAnimations(scene, CHARACTERS.padrao.texture);
        this.sprite = scene.add.sprite(x, y, CHARACTERS.padrao.texture, player.initialFrame)
            .setScale(player.scale * CHARACTERS.padrao.scaleMultiplier)
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
        this.orbitCount = state.orbitCount ?? 0;
        this.orbitRadius = state.orbitRadius ?? 0;
        this.hasCompanion = state.companion ?? false;
        this.applyWorn(state.worn ?? 0);
        // Cliente antigo não envia o personagem: o parceiro continua no padrão.
        if (isCharacterId(state.character) && state.character !== this.characterId) {
            this.characterId = state.character;
            createWalkAnimations(this.sprite.scene, CHARACTERS[state.character].texture);
            this.sprite.setTexture(CHARACTERS[state.character].texture, WORLD_CONFIG.player.initialFrame);
            this.sprite.setScale(WORLD_CONFIG.player.scale * CHARACTERS[state.character].scaleMultiplier);
        }
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
        this.sprite.setDepth(getActorDepth(this.center.y));

        const isAlive = this.health.isAlive;
        this.sprite.setAngle(isAlive ? 0 : 90);
        if (isAlive && distance > 1) {
            this.sprite.anims.play(walkAnimationKey(CHARACTERS[this.characterId].texture, this.facing), true);
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
        this.updateCardVisuals();
    }

    /** Mesmo visual das faíscas e do drone do CombatSystem, só que em volta do parceiro. */
    private updateCardVisuals() {
        const scene = this.sprite.scene;
        while (this.orbitSparks.length < this.orbitCount * 2) {
            this.orbitSparks.push(
                scene.add.circle(0, 0, 11, 0x5ce5f1, 0.4).setDepth(14).setBlendMode(1),
                scene.add.circle(0, 0, 5, 0xe8ffff).setDepth(15)
            );
        }
        // Cerca de uma volta a cada 1,6 s, como no jogador local.
        const turn = scene.time.now * 0.004;
        this.orbitSparks.forEach((spark, index) => {
            const slot = Math.floor(index / 2);
            const angle = turn + slot * Math.PI * 2 / Math.max(1, this.orbitCount);
            spark.setVisible(slot < this.orbitCount)
                .setPosition(this.center.x + Math.cos(angle) * this.orbitRadius, this.center.y + Math.sin(angle) * this.orbitRadius);
        });

        if (this.hasCompanion && !this.companion) {
            this.companion = scene.add.sprite(this.center.x - 18, this.center.y - 18, WORLD_CONFIG.drone.texture, 0)
                .setScale(WORLD_CONFIG.drone.scale * 0.48).setTint(0x8affc1).setDepth(9);
        }
        this.companion?.setVisible(this.hasCompanion).setPosition(
            Phaser.Math.Linear(this.companion.x, this.center.x - 18, 0.15),
            Phaser.Math.Linear(this.companion.y, this.center.y - 18, 0.15)
        );
    }

    /** Veste e tira só o que mudou; o estado chega 20 vezes por segundo. */
    private applyWorn(mask: number) {
        if (mask === this.wornMask) return;
        this.wornMask = mask;
        const wanted = decodeWornItems(mask);
        for (const [id, detach] of this.wornItems) {
            if (wanted.includes(id)) continue;
            detach();
            this.wornItems.delete(id);
        }
        for (const id of wanted) {
            if (!this.wornItems.has(id)) this.wornItems.set(id, attachWornItem(this.sprite.scene, this.sprite, ITEMS[id], true));
        }
    }

    destroy() {
        for (const detach of this.wornItems.values()) detach();
        this.wornItems.clear();
        for (const spark of this.orbitSparks) spark.destroy();
        this.companion?.destroy();
        this.bar.destroy();
        this.sprite.destroy();
    }
}
