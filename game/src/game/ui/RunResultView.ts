import type { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';
import { formatElapsedTime } from '../scoring/ScoreCalculator';
import type { RunSnapshot } from '../scoring/RunTracker';
import { CLEAN_MENU_COLORS, CleanOverlayMenu, type CleanMenuBounds } from './CleanOverlayMenu';

type RunResultOptions = Readonly<{
    result: RunSnapshot;
    onPrimary: () => void;
    /** No multiplayer uma nova partida começa pelo menu, com o parceiro. */
    retryLabel?: string;
    onQuit: () => void;
}>;

const VICTORY_PANEL = { x: 244, y: 92, width: 401, height: 326 };
const DEFEAT_PANEL = { x: 234, y: 108, width: 421, height: 284 };

function formatPoints(value: number) {
    return value.toLocaleString('pt-BR');
}

/** Resumo final compartilhado pelas telas limpas de vitória e derrota. */
export class RunResultView {
    constructor(private readonly scene: Scene, private readonly options: RunResultOptions) {}

    create() {
        if (this.options.result.status === 'WON') this.createVictory();
        else this.createDefeat();
    }

    private createVictory() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: VICTORY_PANEL,
            dimAlpha: 0.72
        });
        menu.addTitle('ESCAPE CONCLUIDO', 140, 'victory', 'success');

        const { score } = this.options.result;
        const parts: readonly [string, number][] = [
            ['VITORIA', score.victoryPoints],
            ['TEMPO', score.timePoints],
            ['INIMIGOS', score.enemyPoints],
            ['MULTI-KILLS', score.multiKillPoints],
            ['BONUS DE DANO', score.damagePoints]
        ];
        parts.forEach(([label, value], index) =>
            this.addResultRow(menu, VICTORY_PANEL, label, formatPoints(value), 174 + index * 22));

        menu.addDivider(274, 42);
        this.addResultRow(
            menu,
            VICTORY_PANEL,
            'TOTAL',
            formatPoints(score.total),
            298,
            { labelSize: '20px', valueSize: '32px', valueColor: CLEAN_MENU_COLORS.frameCss }
        );
        menu.addButton('VOLTAR AO MENU', 350, this.options.onPrimary, {
            width: 320,
            height: 42,
            fontSize: '20px',
            tone: 'success'
        });
        menu.addControlHints([{ key: 'ENTER', label: 'CONFIRMAR' }], 392);
        menu.enableKeyboardNavigation();
        menu.fadeIn();
    }

    private createDefeat() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: DEFEAT_PANEL,
            dimAlpha: 0.72
        });
        menu.addTitle('VOCE FOI DERROTADO', 156, 'defeat', 'danger');
        const result = this.options.result;
        this.addCenteredInfo(
            menu,
            `${formatElapsedTime(result.elapsedTimeMs)}   •   ${result.enemiesDefeated} INIMIGOS   •   ${formatPoints(result.score.total)} PONTOS`,
            200,
            '#b9dce1',
            '18px'
        );
        menu.addButton(this.options.retryLabel ?? 'TENTAR NOVAMENTE', 258, this.options.onPrimary, {
            width: 330,
            height: 42,
            fontSize: '20px',
            tone: 'danger'
        });
        menu.addButton('VOLTAR AO MENU', 312, this.options.onQuit, {
            width: 330,
            height: 42,
            fontSize: '20px'
        });
        menu.addControlHints([
            { key: 'ENTER', label: 'SELECIONAR' },
            { key: 'ESC', label: 'VOLTAR' }
        ], 365);
        menu.enableKeyboardNavigation({ onCancel: this.options.onQuit });
        menu.fadeIn();
    }

    private addResultRow(
        menu: CleanOverlayMenu,
        panel: CleanMenuBounds,
        label: string,
        value: string,
        y: number,
        options: {
            labelSize?: string;
            valueSize?: string;
            valueColor?: string;
        } = {}
    ) {
        const labelText = this.scene.add.text(panel.x + 58, y, label, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: options.labelSize ?? '15px',
            color: '#b9dce1'
        }).setOrigin(0, 0.5).setResolution(2);
        const valueText = this.scene.add.text(panel.x + panel.width - 58, y, value, {
            fontFamily: 'Pixeboy, monospace',
            fontSize: options.valueSize ?? '22px',
            color: options.valueColor ?? CLEAN_MENU_COLORS.text
        }).setOrigin(1, 0.5).setResolution(2);
        menu.add([labelText, valueText]);
    }

    private addCenteredInfo(
        menu: CleanOverlayMenu,
        text: string,
        y: number,
        color: string = CLEAN_MENU_COLORS.mutedText,
        fontSize: string = '17px'
    ) {
        const info = this.scene.add.text(GAME_WIDTH / 2, y, text, {
            fontFamily: 'Pixeboy, monospace',
            fontSize,
            color,
            align: 'center'
        }).setOrigin(0.5).setResolution(2);
        menu.add(info);
    }
}
