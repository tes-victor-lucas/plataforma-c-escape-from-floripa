import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { UpgradeCardDefinition } from '../upgrades';
import { createUpgradeIcon } from './UpgradeIcon';
import { bindGamepadActions } from '../input/GamepadInput';
import { isTouchScreen } from '../input/TouchInput';

const DEPTH = 180;
const CARD_WIDTH = 176;
const CARD_HEIGHT = 246;
const CARD_Y = 286;
const DEFAULT_CARD_CENTER_DISTANCE = 210;
const CARD_BACKGROUND = 0x0c1219;
const CARD_HOVER_BACKGROUND = 0x121b25;
const ITEM_IMAGE_SIZE = 58;
const CARD_GAP = 14;

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

type RenderedSelectionCard = Readonly<{
    container: Phaser.GameObjects.Container;
    setFocused: (focused: boolean) => void;
    select: () => void;
}>;

/** Exibe três cartas e encerra somente depois que uma delas for escolhida. */
export class UpgradeSelectionView<Card extends SelectionCard = UpgradeCardDefinition> {
    private readonly root: Phaser.GameObjects.Container;
    private selected = false;
    private cardScale = 1;

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
        // Até três cartas, o espaçamento de sempre; com mais (a rodada do golem tem cinco), encolhem para caber na tela.
        const count = this.cards.length;
        this.cardScale = count > 3 ? Math.min(1, (GAME_WIDTH - 40) / (count * (CARD_WIDTH + CARD_GAP))) : 1;
        const step = count > 3 ? (CARD_WIDTH + CARD_GAP) * this.cardScale : centerDistance;
        const cardX = this.cards.map((_card, index) => GAME_WIDTH / 2 + (index - (count - 1) / 2) * step);
        let selectedIndex = 0;
        let cleanupInput = () => undefined;
        const renderedCards = this.cards.map((card, index) =>
            this.createCard(card, cardX[index], (selected) => {
                if (this.selected) return;
                this.selected = true;
                cleanupInput();
                this.scene.tweens.add({
                    targets: this.root,
                    alpha: 0,
                    duration: 120,
                    onComplete: () => {
                        this.root.destroy(true);
                        onSelect(selected);
                    }
                });
            }, () => {
                selectedIndex = index;
                updateFocus();
            }));
        const updateFocus = () => renderedCards.forEach((card, index) =>
            card.setFocused(index === selectedIndex));
        const move = (direction: number) => {
            selectedIndex = (selectedIndex + direction + renderedCards.length) % renderedCards.length;
            updateFocus();
        };
        const confirm = () => renderedCards[selectedIndex]?.select();

        this.root.add(renderedCards.map(({ container }) => container));
        const controls = this.scene.add.text(
            GAME_WIDTH / 2,
            438,
            isTouchScreen() ? 'TOQUE EM UMA CARTA PARA ESCOLHER' : '← → / DIRECIONAL   •   ENTER / BOTÃO PRINCIPAL',
            {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '11px',
                color: '#8e99a6'
            }
        ).setOrigin(0.5);
        this.root.add(controls);

        const keyboard = this.scene.input.keyboard;
        const previous = () => move(-1);
        const next = () => move(1);
        keyboard?.on('keydown-LEFT', previous);
        keyboard?.on('keydown-A', previous);
        keyboard?.on('keydown-RIGHT', next);
        keyboard?.on('keydown-D', next);
        keyboard?.on('keydown-ENTER', confirm);
        keyboard?.on('keydown-SPACE', confirm);
        const cleanupGamepad = bindGamepadActions(this.scene, {
            left: previous,
            right: next,
            confirm
        });
        cleanupInput = () => {
            cleanupGamepad();
            keyboard?.off('keydown-LEFT', previous);
            keyboard?.off('keydown-A', previous);
            keyboard?.off('keydown-RIGHT', next);
            keyboard?.off('keydown-D', next);
            keyboard?.off('keydown-ENTER', confirm);
            keyboard?.off('keydown-SPACE', confirm);
        };
        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupInput);
        updateFocus();

        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 150, ease: 'Sine.Out' });
    }

    private createCard(
        card: Card,
        x: number,
        select: (card: Card) => void,
        focus: () => void
    ): RenderedSelectionCard {
        const palette = PALETTES[card.theme ?? card.kind];
        const cardContainer = this.scene.add.container(x, CARD_Y);
        if (this.cardScale !== 1) cardContainer.setScale(this.cardScale);
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
        const setFocused = (focused: boolean) => {
            background
                .setFillStyle(focused ? CARD_HOVER_BACKGROUND : CARD_BACKGROUND, 1)
                .setStrokeStyle(focused ? 3 : 2, palette.border);
            this.scene.tweens.killTweensOf(cardContainer);
            this.scene.tweens.add({
                targets: cardContainer,
                scale: focused ? 1.015 : 1,
                duration: 80
            });
        };
        background.on('pointerover', focus);
        background.once('pointerup', () => select(card));

        return {
            container: cardContainer,
            setFocused,
            select: () => select(card)
        };
    }

    /** Os itens têm tamanhos diferentes; a escala os encaixa sem deformar a arte. */
    private createItemImage(texture: string) {
        const image = this.scene.add.image(0, -38, texture);
        return image.setScale(Math.min(ITEM_IMAGE_SIZE / image.width, ITEM_IMAGE_SIZE / image.height));
    }

}
