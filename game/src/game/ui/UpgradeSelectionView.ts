import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { UpgradeCardDefinition } from '../upgrades';
import { createUpgradeIcon } from './UpgradeIcon';

const DEPTH = 180;
const CARD_WIDTH = 176;
const CARD_HEIGHT = 246;
const CARD_Y = 286;
const DEFAULT_CARD_CENTER_DISTANCE = 210;
const CARD_BACKGROUND = 0x0c1219;
const CARD_HOVER_BACKGROUND = 0x121b25;
const ITEM_IMAGE_SIZE = 58;

const PALETTES = {
    stat: {
        border: 0x78dce8,
        accent: '#78dce8',
        label: 'UPGRADE'
    },
    ability: {
        border: 0xa98bfa,
        accent: '#a98bfa',
        label: 'HABILIDADE'
    },
    yellow: {
        border: 0xf6c85f,
        accent: '#f6c85f',
        label: 'BEBIDA'
    },
    red: {
        border: 0xff7b7b,
        accent: '#ff7b7b',
        label: 'BEBIDA'
    },
    mystery: {
        border: 0xa98bfa,
        accent: '#a98bfa',
        label: 'COMIDA'
    }
} as const;

type SelectionCard = Readonly<{
    id: string;
    kind: 'stat' | 'ability';
    title: string;
    description: string;
    theme?: keyof typeof PALETTES;
    label?: string;
    texture?: string;
}>;

type SelectionViewOptions = Readonly<{
    title?: string;
    hint?: string;
    cardCenterDistance?: number;
}>;

/** Exibe três cartas e encerra somente depois que uma delas for escolhida. */
export class UpgradeSelectionView<Card extends SelectionCard = UpgradeCardDefinition> {
    private readonly root: Phaser.GameObjects.Container;
    private selected = false;

    constructor(
        private readonly scene: Scene,
        private readonly cards: readonly Card[],
        private readonly options: SelectionViewOptions = {}
    ) {
        this.root = scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
    }

    play(onSelect: (card: Card) => void) {
        const dim = this.scene.add.rectangle(
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2,
            GAME_WIDTH,
            GAME_HEIGHT,
            0x05080d,
            0.88
        );
        const title = this.scene.add.text(
            GAME_WIDTH / 2,
            this.options.hint ? 52 : 62,
            this.options.title ?? 'ESCOLHA UM APRIMORAMENTO',
            {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '27px',
                color: '#f4f0e8',
                align: 'center'
            }
        ).setOrigin(0.5);

        this.root.add([dim, title]);

        if (this.options.hint) {
            const hint = this.scene.add.text(GAME_WIDTH / 2, 86, this.options.hint, {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '11px',
                color: '#8e99a6'
            }).setOrigin(0.5);
            this.root.add(hint);
        }

        const centerDistance = this.options.cardCenterDistance ?? DEFAULT_CARD_CENTER_DISTANCE;
        const cardX = [
            GAME_WIDTH / 2 - centerDistance,
            GAME_WIDTH / 2,
            GAME_WIDTH / 2 + centerDistance
        ];
        this.cards.forEach((card, index) => {
            this.root.add(this.createCard(card, cardX[index], (selected) => {
                if (this.selected) return;
                this.selected = true;
                this.scene.tweens.add({
                    targets: this.root,
                    alpha: 0,
                    duration: 120,
                    onComplete: () => {
                        this.root.destroy(true);
                        onSelect(selected);
                    }
                });
            }));
        });

        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 150, ease: 'Sine.Out' });
    }

    private createCard(card: Card, x: number, select: (card: Card) => void) {
        const palette = PALETTES[card.theme ?? card.kind];
        const cardContainer = this.scene.add.container(x, CARD_Y);
        const background = this.scene.add
            .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, CARD_BACKGROUND, 1)
            .setStrokeStyle(2, palette.border)
            .setInteractive({ useHandCursor: true });
        const kind = this.scene.add.text(0, -99, card.label ?? palette.label, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '12px',
            color: palette.accent,
            letterSpacing: 1
        }).setOrigin(0.5);
        const icon = card.texture
            ? this.createItemImage(card.texture)
            : createUpgradeIcon(this.scene, card.id, palette.border, CARD_BACKGROUND)
                .setPosition(0, -38);
        const title = this.scene.add.text(0, 29, card.title.toUpperCase(), {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '16px',
            color: '#f4f0e8',
            align: 'center',
            lineSpacing: 1,
            wordWrap: { width: CARD_WIDTH - 22, useAdvancedWrap: true }
        }).setOrigin(0.5);
        const description = this.scene.add.text(0, 76, card.description, {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#c8ced6',
            align: 'center',
            lineSpacing: 2,
            wordWrap: { width: CARD_WIDTH - 24, useAdvancedWrap: true }
        }).setOrigin(0.5);

        cardContainer.add([background, kind, icon, title, description]);
        background.on('pointerover', () => {
            background.setFillStyle(CARD_HOVER_BACKGROUND, 1).setStrokeStyle(3, palette.border);
            this.scene.tweens.killTweensOf(cardContainer);
            this.scene.tweens.add({ targets: cardContainer, scale: 1.015, duration: 80 });
        });
        background.on('pointerout', () => {
            background.setFillStyle(CARD_BACKGROUND, 1).setStrokeStyle(2, palette.border);
            this.scene.tweens.killTweensOf(cardContainer);
            this.scene.tweens.add({ targets: cardContainer, scale: 1, duration: 80 });
        });
        background.once('pointerup', () => select(card));

        return cardContainer;
    }

    /** Os itens têm tamanhos diferentes; a escala os encaixa sem deformar a arte. */
    private createItemImage(texture: string) {
        const image = this.scene.add.image(0, -38, texture);
        return image.setScale(Math.min(ITEM_IMAGE_SIZE / image.width, ITEM_IMAGE_SIZE / image.height));
    }

}
