import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { UpgradeCardDefinition } from '../upgrades';

const DEPTH = 180;
const CARD_WIDTH = 176;
const CARD_HEIGHT = 246;
const CARD_Y = 286;
const DEFAULT_CARD_CENTER_DISTANCE = 210;
const CARD_BACKGROUND = 0x0c1219;
const CARD_HOVER_BACKGROUND = 0x121b25;

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
        const icon = this.createIcon(card.id, palette.border).setPosition(0, -38);
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

    /** Ícones geométricos e sem textura mantêm todas as cartas na mesma linguagem visual. */
    private createIcon(id: string, color: number) {
        const icon = this.scene.add.graphics();
        icon.lineStyle(3, color, 1);
        icon.fillStyle(color, 1);

        switch (id) {
            case 'attack-range':
                icon.strokeCircle(0, 0, 22).strokeCircle(0, 0, 11);
                this.drawLine(icon, -29, 0, -17, 0);
                this.drawLine(icon, 17, 0, 29, 0);
                this.drawLine(icon, 0, -29, 0, -17);
                this.drawLine(icon, 0, 17, 0, 29);
                break;
            case 'projectile-speed':
                this.drawBullet(icon, 4, 0);
                this.drawLine(icon, -29, -10, -14, -10);
                this.drawLine(icon, -34, 0, -14, 0);
                this.drawLine(icon, -29, 10, -14, 10);
                break;
            case 'projectile-damage':
                this.drawImpact(icon);
                break;
            case 'fire-rate':
                this.drawBullet(icon, 9, -15, 0.7);
                this.drawBullet(icon, 2, 0, 0.7);
                this.drawBullet(icon, 9, 15, 0.7);
                this.drawLine(icon, -30, -15, -13, -15);
                this.drawLine(icon, -36, 0, -20, 0);
                this.drawLine(icon, -30, 15, -13, 15);
                break;
            case 'double-shot':
                this.drawBullet(icon, 5, -11, 0.85);
                this.drawBullet(icon, 5, 11, 0.85);
                this.drawLine(icon, -30, -11, -14, -11);
                this.drawLine(icon, -30, 11, -14, 11);
                break;
            case 'piercing-shot':
                icon.strokeCircle(-3, 0, 21).strokeCircle(-3, 0, 11);
                this.drawBullet(icon, 14, 0, 0.72);
                this.drawLine(icon, -32, 0, -15, 0);
                break;
            case 'companion-drone':
                this.drawDrone(icon);
                break;
            case 'max-health':
                this.drawHeart(icon);
                icon.fillStyle(CARD_BACKGROUND, 1).fillRect(-3, -7, 6, 22).fillRect(-11, 1, 22, 6);
                break;
            case 'emergency-repair':
                this.drawHeart(icon);
                icon.fillStyle(CARD_BACKGROUND, 1).fillRect(-3, -7, 6, 22).fillRect(-11, 1, 22, 6);
                this.drawLine(icon, 17, 13, 29, 25);
                break;
            case 'gin-tropical':
                this.drawDrink(icon, true);
                break;
            case 'gin-melancia':
                this.drawDrink(icon, false);
                icon.strokeCircle(19, -16, 7);
                break;
            case 'cookie-magico':
                icon.strokeCircle(0, 0, 25);
                icon.fillCircle(-10, -8, 3).fillCircle(9, -11, 3).fillCircle(12, 8, 3).fillCircle(-8, 11, 3);
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

    private drawLine(graphics: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number) {
        graphics.beginPath().moveTo(x1, y1).lineTo(x2, y2).strokePath();
    }

    private drawBullet(
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

    private drawImpact(graphics: Phaser.GameObjects.Graphics) {
        const points = Array.from({ length: 16 }, (_, index) => {
            const angle = -Math.PI / 2 + index * Math.PI / 8;
            const radius = index % 2 === 0 ? 27 : 12;
            return new Phaser.Math.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
        });
        graphics.strokePoints(points, true);
    }

    private drawDrone(graphics: Phaser.GameObjects.Graphics) {
        graphics.strokeRect(-15, -13, 30, 26);
        graphics.strokeRect(-7, -5, 14, 10);
        graphics.fillRect(-31, -8, 12, 7).fillRect(19, -8, 12, 7);
        this.drawLine(graphics, -19, -5, -15, -5);
        this.drawLine(graphics, 15, -5, 19, -5);
        this.drawLine(graphics, -9, 13, -17, 24);
        this.drawLine(graphics, 9, 13, 17, 24);
    }

    private drawHeart(graphics: Phaser.GameObjects.Graphics) {
        graphics
            .fillRect(-20, -16, 14, 9)
            .fillRect(6, -16, 14, 9)
            .fillRect(-25, -7, 50, 13)
            .fillRect(-18, 6, 36, 9)
            .fillRect(-10, 15, 20, 8);
    }

    private drawDrink(graphics: Phaser.GameObjects.Graphics, garnish: boolean) {
        graphics.beginPath();
        graphics.moveTo(-21, -18);
        graphics.lineTo(21, -18);
        graphics.lineTo(10, 9);
        graphics.lineTo(-10, 9);
        graphics.closePath().strokePath();
        this.drawLine(graphics, 0, 9, 0, 24);
        this.drawLine(graphics, -14, 24, 14, 24);
        if (garnish) {
            this.drawLine(graphics, 8, -18, 22, -28);
            graphics.strokeCircle(25, -30, 5);
        }
    }
}
