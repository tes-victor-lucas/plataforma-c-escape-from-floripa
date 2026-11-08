import type { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';
import type { GameMode } from '../config/score';
import type { LeaderboardEntry } from '../scoring/ScoreApi';
import { formatElapsedTime } from '../scoring/ScoreCalculator';
import {
    CLEAN_MENU_COLORS,
    CleanOverlayMenu,
    drawCleanMenuBox,
    type CleanMenuBounds
} from './CleanOverlayMenu';

// Os números da PixelGamer são desenhos.
const TABLE_FONT = 'Pixeboy, monospace';
const PANEL = { x: 42, y: 26, width: 805, height: 448 };
const TABLE: CleanMenuBounds = { x: 62, y: 130, width: 765, height: 264 };
const CLOSE_BUTTON: CleanMenuBounds = { x: 805, y: 38, width: 28, height: 28 };
const TAB_Y = 107;
const TABS: readonly { mode: GameMode; label: string; bounds: CleanMenuBounds }[] = [
    { mode: 'SINGLE_PLAYER', label: 'SOLO', bounds: { x: GAME_WIDTH / 2 - 132, y: TAB_Y - 16, width: 126, height: 32 } },
    { mode: 'MULTIPLAYER', label: 'DUPLA', bounds: { x: GAME_WIDTH / 2 + 6, y: TAB_Y - 16, width: 126, height: 32 } }
];
const COLUMNS = [
    { x: 78, title: '#', color: CLEAN_MENU_COLORS.frameCss },
    { x: 125, title: 'JOGADOR', color: CLEAN_MENU_COLORS.text },
    { x: 345, title: 'PONTOS', color: CLEAN_MENU_COLORS.frameCss },
    { x: 450, title: 'TEMPO', color: CLEAN_MENU_COLORS.text },
    { x: 555, title: 'BAIXAS', color: CLEAN_MENU_COLORS.text },
    { x: 660, title: 'DATA', color: CLEAN_MENU_COLORS.mutedText }
] as const;

type RenderedTab = Readonly<{
    background: Phaser.GameObjects.Graphics;
    label: Phaser.GameObjects.Text;
}>;

export class LeaderboardView {
    private readonly content: Phaser.GameObjects.Text;
    private readonly columns: Phaser.GameObjects.Text[];
    private readonly tabs: RenderedTab[];

    constructor(private readonly scene: Scene, onClose: () => void, onSelectMode: (mode: GameMode) => void) {
        const menu = new CleanOverlayMenu(scene, {
            bounds: PANEL,
            dimAlpha: 0.72
        });
        menu.addTitle('PLACAR', 73, 'leaderboard');
        this.addCloseButton(menu, onClose);

        this.tabs = TABS.map(({ mode, label, bounds }) => {
            const background = scene.add.graphics();
            const text = scene.add.text(bounds.x + bounds.width / 2, TAB_Y, label, {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '16px',
                color: CLEAN_MENU_COLORS.text
            }).setOrigin(0.5).setResolution(2);
            const hitArea = scene.add.rectangle(
                bounds.x + bounds.width / 2,
                TAB_Y,
                bounds.width,
                bounds.height,
                0x000000,
                0
            ).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => onSelectMode(mode));
            menu.add([background, text, hitArea]);
            return { background, label: text };
        });

        const table = scene.add.graphics();
        drawCleanMenuBox(table, TABLE, CLEAN_MENU_COLORS.panel, CLEAN_MENU_COLORS.frame, 7, 2);
        table.fillStyle(CLEAN_MENU_COLORS.button, 1)
            .fillRect(TABLE.x + 3, TABLE.y + 5, TABLE.width - 6, 32);
        for (let row = 0; row < 10; row += 2) {
            table.fillStyle(CLEAN_MENU_COLORS.frame, 0.045)
                .fillRect(TABLE.x + 3, 172 + row * 21, TABLE.width - 6, 21);
        }
        menu.add(table);

        for (const { x, title } of COLUMNS) {
            menu.add(scene.add.text(x, 140, title, {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '12px',
                color: CLEAN_MENU_COLORS.mutedText
            }).setResolution(2));
        }
        this.content = scene.add.text(GAME_WIDTH / 2, 260, 'CARREGANDO PLACAR...', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '14px',
            color: CLEAN_MENU_COLORS.mutedText,
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setResolution(2);
        this.columns = COLUMNS.map(({ x, color }) => scene.add.text(x, 172, '', {
            fontFamily: TABLE_FONT,
            fontSize: '15px',
            color,
            lineSpacing: 6
        }).setResolution(2));
        menu.add([this.content, ...this.columns]);

        menu.addButton('VOLTAR AO MENU', 442, onClose, {
            width: 300,
            height: 38,
            fontSize: '18px'
        });
        menu.enableKeyboardNavigation({ onCancel: onClose });
        menu.fadeIn();
    }

    private addCloseButton(menu: CleanOverlayMenu, onClose: () => void) {
        const background = this.scene.add.graphics();
        const render = (hovered: boolean) => {
            background.clear();
            drawCleanMenuBox(
                background,
                CLOSE_BUTTON,
                hovered ? CLEAN_MENU_COLORS.buttonHover : CLEAN_MENU_COLORS.button,
                CLEAN_MENU_COLORS.frame,
                4,
                2
            );
            background.fillStyle(CLEAN_MENU_COLORS.danger, 1);
            for (let pixel = 0; pixel < 4; pixel += 1) {
                background.fillRect(CLOSE_BUTTON.x + 6 + pixel * 4, CLOSE_BUTTON.y + 6 + pixel * 4, 4, 4);
                background.fillRect(CLOSE_BUTTON.x + 18 - pixel * 4, CLOSE_BUTTON.y + 6 + pixel * 4, 4, 4);
            }
        };
        const hitArea = this.scene.add.rectangle(
            CLOSE_BUTTON.x + CLOSE_BUTTON.width / 2,
            CLOSE_BUTTON.y + CLOSE_BUTTON.height / 2,
            CLOSE_BUTTON.width,
            CLOSE_BUTTON.height,
            0x000000,
            0
        ).setInteractive({ useHandCursor: true });
        hitArea.on('pointerover', () => render(true));
        hitArea.on('pointerout', () => render(false));
        hitArea.on('pointerdown', onClose);
        render(false);
        menu.add([background, hitArea]);
    }

    /** Destaca a aba e limpa a tabela enquanto a outra lista carrega. */
    selectMode(mode: GameMode) {
        TABS.forEach((tab, index) => {
            const selected = tab.mode === mode;
            const rendered = this.tabs[index];
            rendered.background.clear();
            drawCleanMenuBox(
                rendered.background,
                tab.bounds,
                selected ? CLEAN_MENU_COLORS.buttonHover : CLEAN_MENU_COLORS.button,
                CLEAN_MENU_COLORS.frame,
                5,
                2
            );
            if (selected) {
                rendered.background.fillStyle(CLEAN_MENU_COLORS.danger, 1)
                    .fillRect(tab.bounds.x + 10, tab.bounds.y + tab.bounds.height - 4, tab.bounds.width - 20, 3);
            }
            rendered.label.setColor(selected ? CLEAN_MENU_COLORS.text : CLEAN_MENU_COLORS.mutedText);
        });
        this.columns.forEach((column) => column.setText(''));
        this.content.setText('CARREGANDO PLACAR...');
    }

    showEntries(entries: readonly LeaderboardEntry[]) {
        if (entries.length === 0) {
            this.content.setText('AINDA NAO HA RUNS VENCEDORAS NESTE PLACAR.');
            return;
        }
        this.content.setText('');
        const rows = entries.slice(0, 10).map((entry) => [
            String(entry.rank),
            entry.playerName.slice(0, 18),
            entry.score.toLocaleString('pt-BR'),
            formatElapsedTime(entry.elapsedTimeMs),
            String(entry.enemiesDefeated),
            new Date(entry.completedAt).toLocaleDateString('pt-BR')
        ]);
        this.columns.forEach((column, index) => column.setText(rows.map((row) => row[index]).join('\n')));
    }

    showError() {
        this.content.setText('NAO FOI POSSIVEL CARREGAR O PLACAR\nTENTE NOVAMENTE MAIS TARDE');
    }
}
