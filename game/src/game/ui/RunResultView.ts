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

/** Resumo final compartilhado pelas telas de vitória e derrota. */
export class RunResultView {
    constructor(private readonly scene: Scene, private readonly options: RunResultOptions) {}

    create() {
        const won = this.options.result.status === 'WON';
        this.scene.add.rectangle(
            GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78
        ).setDepth(DEPTH);
        this.scene.add.rectangle(GAME_WIDTH / 2, 245, 520, 430, 0x00171b)
            .setStrokeStyle(3, won ? 0x39ff14 : 0xe90931)
            .setDepth(DEPTH + 1);
        this.scene.add.text(GAME_WIDTH / 2, 48, won ? 'RUN CONCLUIDA' : 'VOCE FOI DERROTADO', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '30px',
            color: won ? '#75ff91' : '#ff5c74'
        }).setOrigin(0.5).setDepth(DEPTH + 2);

        const { score } = this.options.result;
        const rows: [string, string][] = [
            ['VITORIA', String(score.victoryPoints)],
            ['TEMPO', String(score.timePoints)],
            ['INIMIGOS', String(score.enemyPoints)],
            ['MULTI-KILLS', String(score.multiKillPoints)],
            ['BONUS DE DANO', String(score.damagePoints)],
            ['TOTAL', String(score.total)],
            ['TEMPO FINAL', formatElapsedTime(this.options.result.elapsedTimeMs)]
        ];
        rows.forEach(([label, value], index) => {
            const y = 100 + index * 34;
            this.scene.add.text(260, y, label, {
                fontFamily: 'PixelGamer, monospace', fontSize: '18px', color: '#b9dce1'
            }).setDepth(DEPTH + 2);
            // PixelGamer é uma versão demo sem dígitos; números usam a Pixeboy, como no HUD.
            this.scene.add.text(625, y, value, {
                fontFamily: 'Pixeboy, monospace', fontSize: '18px', color: '#ffffff'
            }).setOrigin(1, 0).setDepth(DEPTH + 2);
        });

        this.createButton(won ? 'VOLTAR AO MENU' : 'TENTAR NOVAMENTE', 377, this.options.onPrimary);
        if (!won) this.createButton('VOLTAR AO MENU', 433, this.options.onQuit);
    }

    private createButton(label: string, y: number, action: () => void) {
        const background = this.scene.add.rectangle(GAME_WIDTH / 2, y, 300, 44, 0x002b33)
            .setStrokeStyle(2, 0x008fa5).setDepth(DEPTH + 2);
        this.scene.add.text(GAME_WIDTH / 2, y, label, {
            fontFamily: 'PixelGamer, monospace', fontSize: '22px', color: '#f7f7f7'
        }).setOrigin(0.5).setDepth(DEPTH + 3);
        let activated = false;
        background.setInteractive({ useHandCursor: true }).once('pointerdown', () => {
            if (activated) return;
            activated = true;
            background.disableInteractive();
            action();
        });
    }
}
