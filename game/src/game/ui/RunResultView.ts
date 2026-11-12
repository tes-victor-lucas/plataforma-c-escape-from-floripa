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
    /** Substitui o título padrão da derrota (pode ter quebra de linha). */
    defeatTitle?: string;
    /** Linha em vermelho abaixo do título da vitória: quem perdeu a disputa pela vaga no TICEN. */
    victorySubtitle?: string;
    /** Crédito da feira para quem venceu logado: a frase aparece quando a feira responde. */
    fairCredit?: Promise<string | undefined>;
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
        if (this.options.victorySubtitle) this.addSplash(this.options.victorySubtitle);

        const { score } = this.options.result;
        const parts: readonly [string, number][] = [
            ['VITORIA', score.victoryPoints],
            ['DUNGEONS', score.dungeonPoints],
            ['TEMPO', score.timePoints],
            ['INIMIGOS', score.enemyPoints],
            ['MULTI-KILLS', score.multiKillPoints],
            ['BONUS DE DANO', score.damagePoints],
            ['FLIPERAMA', score.arcadePoints],
            ['TOPAZIOS', score.topazPoints]
        ];
        // Fontes do tamanho da linha e uma faixa clara a cada duas: nome e valor ficam alinhados.
        const stripes = this.scene.add.graphics();
        parts.forEach(([label, value], index) => {
            const y = 168 + index * 14;
            if (index % 2 === 0) stripes.fillStyle(0xb9dce1, 0.06).fillRect(VICTORY_PANEL.x + 48, y - 7, VICTORY_PANEL.width - 96, 14);
            this.addResultRow(menu, VICTORY_PANEL, label, formatPoints(value), y, { labelSize: '13px', valueSize: '17px' });
        });
        menu.add(stripes);

        menu.addDivider(278, 42);
        this.addResultRow(
            menu,
            VICTORY_PANEL,
            'TOTAL',
            formatPoints(score.total),
            301,
            { labelSize: '20px', valueSize: '32px', valueColor: CLEAN_MENU_COLORS.frameCss }
        );
        menu.addButton('VOLTAR AO MENU', 350, this.options.onPrimary, {
            width: 320,
            height: 42,
            fontSize: '20px',
            tone: 'success'
        });
        menu.addControlHints([{ key: 'ENTER', label: 'CONFIRMAR' }], 392);
        void this.options.fairCredit?.then((message) => {
            if (!message || !this.scene.scene.isActive()) return;
            this.scene.add.text(VICTORY_PANEL.x + VICTORY_PANEL.width / 2, 323, message, {
                fontFamily: 'PixelGamer, monospace',
                fontSize: '13px',
                color: '#ffff55'
            }).setOrigin(0.5).setDepth(260).setResolution(2);
        });
        menu.enableKeyboardNavigation();
        menu.fadeIn();
    }

    private createDefeat() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: DEFEAT_PANEL,
            dimAlpha: 0.72
        });
        const { defeatTitle } = this.options;
        const title = menu.addTitle(defeatTitle ?? 'VOCE FOI DERROTADO', 156, 'defeat', 'danger');
        // Título longo em duas linhas: menor e um pouco abaixo, longe do ícone.
        if (defeatTitle) title.setFontSize('22px').setY(160);
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

    /** Frase amarela inclinada no canto do painel, pulsando, no estilo das frases de tela de título. */
    private addSplash(text: string) {
        // Em cima do canto direito, saindo da moldura, para não cobrir o título largo.
        const splash = this.scene.add.text(VICTORY_PANEL.x + VICTORY_PANEL.width - 52, VICTORY_PANEL.y - 10, text, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '15px',
            color: '#ffff55',
            stroke: '#3a3a00',
            strokeThickness: 3
        }).setOrigin(0.5).setRotation(-0.32).setDepth(260).setResolution(2);
        splash.setShadow(2, 2, '#1a1a00', 0, true, true);
        this.scene.tweens.add({ targets: splash, scale: 1.1, duration: 320, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
