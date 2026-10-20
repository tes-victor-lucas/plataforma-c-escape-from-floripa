import { Scene } from 'phaser';
import { scoreApi } from '../scoring/ScoreApi';
import { LeaderboardView } from '../ui/LeaderboardView';

export class Leaderboard extends Scene {
    constructor() {
        super('Leaderboard');
    }

    create() {
        const view = new LeaderboardView(this, () => this.scene.stop());
        this.input.keyboard?.once('keydown-ESC', () => this.scene.stop());
        void scoreApi.getLeaderboard('SINGLE_PLAYER')
            .then((entries) => view.showEntries(entries))
            .catch(() => view.showError());
    }
}
