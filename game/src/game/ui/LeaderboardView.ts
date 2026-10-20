import type { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { LeaderboardEntry } from '../scoring/ScoreApi';
import { formatElapsedTime } from '../scoring/ScoreCalculator';

export class LeaderboardView {
    private readonly content: Phaser.GameObjects.Text;

    constructor(scene: Scene, onClose: () => void) {
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.84)
            .setDepth(200);
        scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 790, 440, 0x00171b)
            .setStrokeStyle(3, 0x008fa5).setDepth(201);
        scene.add.text(GAME_WIDTH / 2, 52, 'PLACAR — SINGLE-PLAYER', {
            fontFamily: 'PixelGamer, monospace', fontSize: '27px', color: '#5ce5f1'
        }).setOrigin(0.5).setDepth(202);
        scene.add.text(78, 91, '#   JOGADOR              PONTOS    TEMPO   BAIXAS   DATA', {
            fontFamily: 'PixelGamer, monospace', fontSize: '15px', color: '#72aeb8'
        }).setDepth(202);
        this.content = scene.add.text(78, 125, 'CARREGANDO PLACAR...', {
            fontFamily: 'PixelGamer, monospace', fontSize: '15px', color: '#ffffff',
            lineSpacing: 11
        }).setDepth(202);
        const close = scene.add.text(GAME_WIDTH / 2, 454, '[ VOLTAR ]', {
            fontFamily: 'PixelGamer, monospace', fontSize: '18px', color: '#ffffff'
        }).setOrigin(0.5).setDepth(203).setInteractive({ useHandCursor: true });
        close.once('pointerdown', onClose);
    }

    showEntries(entries: readonly LeaderboardEntry[]) {
        if (entries.length === 0) {
            this.content.setText('AINDA NÃO HÁ RUNS VENCEDORAS NESTE PLACAR.');
            return;
        }
        this.content.setText(entries.slice(0, 10).map((entry) => {
            const name = entry.playerName.slice(0, 18).padEnd(18);
            const score = String(entry.score).padStart(7);
            const kills = String(entry.enemiesDefeated).padStart(6);
            const date = new Date(entry.completedAt).toLocaleDateString('pt-BR');
            return `${String(entry.rank).padStart(2)}  ${name} ${score}   ${formatElapsedTime(entry.elapsedTimeMs)}  ${kills}   ${date}`;
        }));
    }

    showError() {
        this.content.setText('NÃO FOI POSSÍVEL CARREGAR O PLACAR\nTENTE NOVAMENTE MAIS TARDE');
    }
}
