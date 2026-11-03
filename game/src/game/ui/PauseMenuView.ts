import { Scene } from 'phaser';
import { getUpgradeCard } from '../upgrades/catalog';
import type { UpgradeProgress } from '../upgrades/types';
import { CleanOverlayMenu } from './CleanOverlayMenu';
import { CLEAN_MENU_COLORS } from './CleanOverlayMenu';
import { createUpgradeIcon } from './UpgradeIcon';

type PauseMenuViewOptions = {
    onContinue: () => void;
    onQuit: () => void;
    upgrades: UpgradeProgress;
};

const PANEL = { x: 244, y: 118, width: 401, height: 270 };
const UPGRADE_PANEL = { x: 54, y: PANEL.y, width: 174, height: PANEL.height };
const ICON_SIZE = 36;
const ICON_GAP = 9;
const ICON_COLUMNS = 3;
const UPGRADE_COLORS = { stat: 0x78dce8, ability: 0xa98bfa } as const;

export function getPauseUpgradeEntries(progress: UpgradeProgress) {
    return progress.map(([id, level]) => ({ card: getUpgradeCard(id), level }));
}

/** Overlay enxuto exibido enquanto a sala está pausada. */
export class PauseMenuView {
    constructor(
        private readonly scene: Scene,
        private readonly options: PauseMenuViewOptions
    ) {}

    create() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: PANEL,
            dimAlpha: 0.68
        });
        menu.addTitle('JOGO PAUSADO', 166, 'pause');
        menu.addButton('CONTINUAR', 237, this.options.onContinue, {
            width: 320,
            height: 42,
            fontSize: '22px'
        });
        menu.addButton('VOLTAR AO MENU', 292, this.options.onQuit, {
            width: 320,
            height: 42,
            fontSize: '20px'
        });
        menu.addControlHints([
            { key: 'P', label: 'CONTINUAR' },
            { key: 'ENTER', label: 'SELECIONAR' }
        ], 360);
        this.addUpgradePanel(menu);
        menu.enableKeyboardNavigation({ onCancel: this.options.onContinue });
        menu.fadeIn();
    }

    private addUpgradePanel(menu: CleanOverlayMenu) {
        const entries = getPauseUpgradeEntries(this.options.upgrades);
        const panel = this.scene.add.graphics();
        panel.fillStyle(CLEAN_MENU_COLORS.panel, 1)
            .fillRect(UPGRADE_PANEL.x, UPGRADE_PANEL.y, UPGRADE_PANEL.width, UPGRADE_PANEL.height);
        panel.lineStyle(2, CLEAN_MENU_COLORS.frame, 1)
            .strokeRect(UPGRADE_PANEL.x, UPGRADE_PANEL.y, UPGRADE_PANEL.width, UPGRADE_PANEL.height);
        const title = this.scene.add.text(
            UPGRADE_PANEL.x + UPGRADE_PANEL.width / 2,
            UPGRADE_PANEL.y + 22,
            'UPGRADES',
            {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '15px',
                color: CLEAN_MENU_COLORS.text
            }
        ).setOrigin(0.5).setResolution(2);
        menu.add([panel, title]);

        if (entries.length === 0) {
            const empty = this.scene.add.text(
                UPGRADE_PANEL.x + UPGRADE_PANEL.width / 2,
                UPGRADE_PANEL.y + UPGRADE_PANEL.height / 2,
                'NENHUM UPGRADE\nESCOLHIDO',
                {
                    fontFamily: 'PixelGamer, monospace',
                    fontSize: '11px',
                    color: CLEAN_MENU_COLORS.mutedText,
                    align: 'center',
                    lineSpacing: 5
                }
            ).setOrigin(0.5).setResolution(2);
            menu.add(empty);
            return;
        }

        const dividerY = UPGRADE_PANEL.y + 173;
        const divider = this.scene.add.graphics();
        divider.fillStyle(CLEAN_MENU_COLORS.frame, 0.45)
            .fillRect(UPGRADE_PANEL.x + 14, dividerY, UPGRADE_PANEL.width - 28, 1);
        const tooltipTitle = this.scene.add.text(
            UPGRADE_PANEL.x + UPGRADE_PANEL.width / 2,
            dividerY + 17,
            '',
            {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '11px',
                color: CLEAN_MENU_COLORS.text,
                align: 'center',
                wordWrap: { width: UPGRADE_PANEL.width - 22, useAdvancedWrap: true }
            }
        ).setOrigin(0.5, 0).setResolution(2).setVisible(false);
        const tooltipDescription = this.scene.add.text(
            UPGRADE_PANEL.x + UPGRADE_PANEL.width / 2,
            dividerY + 47,
            '',
            {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: CLEAN_MENU_COLORS.mutedText,
                align: 'center',
                lineSpacing: 1,
                wordWrap: { width: UPGRADE_PANEL.width - 22, useAdvancedWrap: true }
            }
        ).setOrigin(0.5, 0).setResolution(2).setVisible(false);
        menu.add([divider, tooltipTitle, tooltipDescription]);

        const rowWidth = ICON_COLUMNS * ICON_SIZE + (ICON_COLUMNS - 1) * ICON_GAP;
        const startX = UPGRADE_PANEL.x + (UPGRADE_PANEL.width - rowWidth) / 2 + ICON_SIZE / 2;
        const startY = UPGRADE_PANEL.y + 58;
        entries.forEach(({ card, level }, index) => {
            const column = index % ICON_COLUMNS;
            const row = Math.floor(index / ICON_COLUMNS);
            const x = startX + column * (ICON_SIZE + ICON_GAP);
            const y = startY + row * (ICON_SIZE + ICON_GAP);
            const color = UPGRADE_COLORS[card.kind];
            const square = this.scene.add.rectangle(
                x,
                y,
                ICON_SIZE,
                ICON_SIZE,
                CLEAN_MENU_COLORS.button,
                1
            ).setStrokeStyle(1, color).setInteractive({ useHandCursor: true });
            const icon = createUpgradeIcon(this.scene, card.id, color, CLEAN_MENU_COLORS.button)
                .setPosition(x, y)
                .setScale(0.42);
            const levelLabel = level > 1
                ? this.scene.add.text(x + 13, y - 13, `${level}`, {
                    fontFamily: 'PixelGamer, monospace',
                    fontSize: '9px',
                    color: '#ffffff',
                    backgroundColor: '#e90931',
                    padding: { x: 2, y: 1 }
                }).setOrigin(0.5).setResolution(2)
                : undefined;

            square.on('pointerover', () => {
                square.setFillStyle(CLEAN_MENU_COLORS.buttonHover, 1).setStrokeStyle(2, color);
                tooltipTitle
                    .setText(`${card.title.toUpperCase()}${level > 1 ? `  NÍVEL ${level}` : ''}`)
                    .setColor(card.kind === 'ability' ? '#a98bfa' : '#78dce8')
                    .setVisible(true);
                tooltipDescription.setText(card.description).setVisible(true);
            });
            square.on('pointerout', () => {
                square.setFillStyle(CLEAN_MENU_COLORS.button, 1).setStrokeStyle(1, color);
                tooltipTitle.setVisible(false);
                tooltipDescription.setVisible(false);
            });
            menu.add(levelLabel ? [square, icon, levelLabel] : [square, icon]);
        });
    }
}
