import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { formatElapsedTime } from '../scoring/ScoreCalculator';
import type { RunSnapshot } from '../scoring/RunTracker';

type RunResultOptions = Readonly<{
    result: RunSnapshot;
    onPrimary: () => void;
    onQuit: () => void;
}>;

const DEPTH = 200;
const PANEL_COLOR = 0x00171b;
const BUTTON_COLOR = 0x002b33;
const BUTTON_HOVER_COLOR = 0x005260;
const BUTTON_FRAME_COLOR = 0x008fa5;
const PANEL = { x: 184, y: 28, width: 520, height: 444 };
const LABEL_X = 248;
const VALUE_X = 640;
const BUTTON_WIDTH = 320;
const BUTTON_HEIGHT = 46;

/** Resumo final compartilhado pelas telas de vitória e derrota. */
export class RunResultView {
    private root?: Phaser.GameObjects.Container;

    constructor(private readonly scene: Scene, private readonly options: RunResultOptions) {}

    create() {
        const won = this.options.result.status === 'WON';
        const accent = won ? 0x39ff14 : 0xe90931;
        this.root = this.scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0);
        this.root.add(this.scene.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72
        ));
        this.drawPanel(accent);
        this.root.add(this.scene.add.text(GAME_WIDTH / 2, 70, won ? 'RUN CONCLUIDA' : 'VOCE FOI DERROTADO', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '30px',
            color: won ? '#75ff91' : '#ff5c74',
            shadow: { offsetX: 2, offsetY: 3, color: '#000000', blur: 0, fill: true }
        }).setOrigin(0.5));

        const { score } = this.options.result;
        const parts: [string, number][] = [
            ['VITORIA', score.victoryPoints],
            ['TEMPO', score.timePoints],
            ['INIMIGOS', score.enemyPoints],
            ['MULTI-KILLS', score.multiKillPoints],
            ['BONUS DE DANO', score.damagePoints]
        ];
        parts.forEach(([label, value], index) =>
            this.addRow(label, String(value), 112 + index * 30, '16px', '22px', '#ffffff'));

        const divider = this.scene.add.graphics();
        // No meio do vão entre a última parcela (y=232) e o TOTAL (y=280), mais discreto que o total.
        divider.fillStyle(BUTTON_FRAME_COLOR, 0.7).fillRect(LABEL_X, 254, VALUE_X - LABEL_X, 2);
        this.root.add(divider);
        this.addRow('TOTAL', String(score.total), 280, '22px', '30px', '#5ce5f1');
        this.addRow('TEMPO FINAL', formatElapsedTime(this.options.result.elapsedTimeMs), 318, '14px', '20px', '#b9dce1');

        // Na vitória o único botão desce para o centro do espaço reservado aos dois.
        this.createButton(won ? 'VOLTAR AO MENU' : 'TENTAR NOVAMENTE', won ? 404 : 376, this.options.onPrimary);
        if (!won) this.createButton('VOLTAR AO MENU', 432, this.options.onQuit);

        this.root.setAlpha(0);
        this.scene.tweens.add({ targets: this.root, alpha: 1, duration: 180, ease: 'Sine.Out' });
    }

    private drawPanel(accent: number) {
        const { x, y, width, height } = PANEL;
        const frame = this.scene.add.graphics();
        frame.fillStyle(PANEL_COLOR, 0.97).fillRect(x, y, width, height);
        frame.lineStyle(4, accent, 1).strokeRect(x, y, width, height);
        // Cantos em degrau, como no menu de pausa, para manter a linguagem pixel art.
        frame.fillStyle(accent, 1);
        frame.fillRect(x + 12, y - 5, width - 24, 5);
        frame.fillRect(x + 12, y + height, width - 24, 5);
        frame.fillRect(x - 5, y + 12, 5, height - 24);
        frame.fillRect(x + width, y + 12, 5, height - 24);
        this.root!.add(frame);
    }

    private addRow(label: string, value: string, y: number, labelSize: string, valueSize: string, valueColor: string) {
        this.root!.add([
            this.scene.add.text(LABEL_X, y, label, {
                fontFamily: 'PixelGamer, monospace', fontSize: labelSize, color: '#b9dce1'
            }).setOrigin(0, 0.5),
            // PixelGamer é uma versão demo sem dígitos; números usam a Pixeboy, como no HUD.
            this.scene.add.text(VALUE_X, y, value, {
                fontFamily: 'Pixeboy, monospace', fontSize: valueSize, color: valueColor
            }).setOrigin(1, 0.5).setResolution(2)
        ]);
    }

    private createButton(label: string, y: number, action: () => void) {
        const x = Math.round((GAME_WIDTH - BUTTON_WIDTH) / 2);
        const background = this.scene.add.graphics();
        const text = this.scene.add.text(GAME_WIDTH / 2, y, label, {
            fontFamily: 'PixelGamer, monospace', fontSize: '22px', color: '#f7f7f7'
        }).setOrigin(0.5);
        const hitArea = this.scene.add.rectangle(GAME_WIDTH / 2, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        const draw = (hovered: boolean) => {
            background.clear();
            background.fillStyle(hovered ? BUTTON_HOVER_COLOR : BUTTON_COLOR, 1)
                .fillRect(x, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT);
            background.lineStyle(3, BUTTON_FRAME_COLOR, 1)
                .strokeRect(x, y - BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT);
        };
        draw(false);
        hitArea.on('pointerover', () => {
            draw(true);
            text.setColor('#5ce5f1');
        });
        hitArea.on('pointerout', () => {
            draw(false);
            text.setColor('#f7f7f7');
        });
        let activated = false;
        // pointerdown é mais confiável quando a própria ação encerra esta cena.
        hitArea.once('pointerdown', () => {
            if (activated) return;
            activated = true;
            hitArea.disableInteractive();
            action();
        });
        this.root!.add([background, text, hitArea]);
    }
}
