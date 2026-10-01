import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { UpgradeCardDefinition } from '../upgrades';

const DEPTH = 180;
const CARD_WIDTH = 178;
const CARD_HEIGHT = 220;
const CARD_Y = 282;
const CARD_X = [248, GAME_WIDTH / 2, GAME_WIDTH - 248] as const;

const PALETTES = {
    stat: {
        background: 0x082b50,
        hover: 0x0d3f75,
        border: 0x3189ff,
        accent: '#65b0ff',
        label: 'UPGRADE'
    },
    ability: {
        background: 0x2f154d,
        hover: 0x48206f,
        border: 0xa855f7,
        accent: '#d99aff',
        label: 'HABILIDADE'
    }
} as const;

/** Exibe três cartas e encerra somente depois que uma delas for escolhida. */
export class UpgradeSelectionView {
    private readonly root: Phaser.GameObjects.Container;
    private selected = false;

    constructor(
        private readonly scene: Scene,
        private readonly cards: readonly UpgradeCardDefinition[]
    ) {
        this.root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    }

    play(onSelect: (card: UpgradeCardDefinition) => void) {
        const dim = this.scene.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x000000,
            0.58
        );
        const title = this.scene.add.text(GAME_WIDTH / 2, 54, 'ESCOLHA UM APRIMORAMENTO', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '28px',
            color: '#ffffff'
        }).setOrigin(0.5);
        const hint = this.scene.add.text(GAME_WIDTH / 2, 94, 'Selecione uma carta para continuar', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '15px',
            color: '#b8c3cc'
        }).setOrigin(0.5);

        this.root.add([dim, title, hint]);
        this.cards.forEach((card, index) => {
            this.root.add(this.createCard(card, CARD_X[index], (selected) => {
                if (this.selected) return;
                this.selected = true;
                this.scene.tweens.add({
                    targets: this.root,
                    alpha: 0,
                    duration: 140,
                    onComplete: () => {
                        this.root.destroy(true);
                        onSelect(selected);
                    }
                });
            }));
        });

        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 180, ease: 'Sine.Out' });
    }

    private createCard(
        card: UpgradeCardDefinition,
        x: number,
        select: (card: UpgradeCardDefinition) => void
    ) {
        const palette = PALETTES[card.kind];
        const cardContainer = this.scene.add.container(x, CARD_Y);
        const background = this.scene.add
            .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, palette.background, 0.97)
            .setStrokeStyle(3, palette.border)
            .setInteractive({ useHandCursor: true });
        const kind = this.scene.add.text(0, -87, palette.label, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '13px',
            color: palette.accent
        }).setOrigin(0.5);
        const title = this.scene.add.text(0, -53, card.title, {
            fontFamily: 'monospace',
            fontStyle: 'bold',
            fontSize: '18px',
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: CARD_WIDTH - 22, useAdvancedWrap: true }
        }).setOrigin(0.5);
        const description = this.scene.add.text(0, 10, card.description, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#e6edf3',
            align: 'center',
            lineSpacing: 3,
            wordWrap: { width: CARD_WIDTH - 24, useAdvancedWrap: true }
        }).setOrigin(0.5);
        const footer = this.scene.add.text(0, 88, 'CLIQUE PARA ESCOLHER', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '10px',
            color: palette.accent
        }).setOrigin(0.5);

        cardContainer.add([background, kind, title, description, footer]);
        background.on('pointerover', () => {
            background.setFillStyle(palette.hover, 1);
            this.scene.tweens.killTweensOf(cardContainer);
            this.scene.tweens.add({ targets: cardContainer, scale: 1.025, duration: 90 });
        });
        background.on('pointerout', () => {
            background.setFillStyle(palette.background, 0.97);
            this.scene.tweens.killTweensOf(cardContainer);
            this.scene.tweens.add({ targets: cardContainer, scale: 1, duration: 90 });
        });
        background.once('pointerup', () => select(card));

        return cardContainer;
    }
}
