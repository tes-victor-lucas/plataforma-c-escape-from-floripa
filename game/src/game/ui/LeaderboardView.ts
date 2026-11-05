import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { LeaderboardEntry } from '../scoring/ScoreApi';
import { formatElapsedTime } from '../scoring/ScoreCalculator';

// Os números da PixelGamer são desenhos.
const TABLE_FONT = 'Pixeboy, monospace';
// Posições fixas: o espaço é mais estreito que as letras, então preencher com espaços não alinha.
const COLUMNS = [
    { x: 78, title: '#' },
    { x: 125, title: 'JOGADOR' },
    { x: 345, title: 'PONTOS' },
    { x: 450, title: 'TEMPO' },
    { x: 555, title: 'BAIXAS' },
    { x: 660, title: 'DATA' }
] as const;

export class LeaderboardView {
    private readonly content: Phaser.GameObjects.Text;
    private readonly columns: Phaser.GameObjects.Text[];

    constructor(scene: Scene, onClose: () => void) {
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.84)
            .setDepth(200);
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 790, 440, 0x00171b)
            .setStrokeStyle(3, 0x008fa5).setDepth(201);
        scene.add.text(GAME_WIDTH / 2, 52, 'PLACAR — SINGLE-PLAYER', {
            fontFamily: 'PixelGamer, monospace', fontSize: '27px', color: '#5ce5f1'
        }).setOrigin(0.5).setDepth(202);
        for (const { x, title } of COLUMNS) {
            scene.add.text(x, 91, title, {
                fontFamily: TABLE_FONT, fontSize: '15px', color: '#72aeb8'
            }).setDepth(202);
        }
        this.content = scene.add.text(78, 125, 'CARREGANDO PLACAR...', {
            fontFamily: TABLE_FONT, fontSize: '15px', color: '#ffffff',
            lineSpacing: 11
        }).setDepth(202);
        this.columns = COLUMNS.map(({ x }) => scene.add.text(x, 125, '', {
            fontFamily: TABLE_FONT, fontSize: '15px', color: '#ffffff',
            lineSpacing: 11
        }).setDepth(202));
        scene.add.text(GAME_WIDTH / 2, 424, 'FUNÇÃO EM DESENVOLVIMENTO', {
            fontFamily: 'PixelGamer, monospace', fontSize: '16px', color: '#ffcc66'
        }).setOrigin(0.5).setDepth(202).setResolution(2);
        const close = scene.add.text(GAME_WIDTH / 2, 454, '[ VOLTAR ]', {
            fontFamily: 'PixelGamer, monospace', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(203).setInteractive({ useHandCursor: true });
        close.once('pointerdown', onClose);
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
            String(entry.score),
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
