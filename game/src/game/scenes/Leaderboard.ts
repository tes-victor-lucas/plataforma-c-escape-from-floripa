import { Scene } from 'phaser';
import type { GameMode } from '../config/score';
import { scoreApi } from '../scoring/ScoreApi';
import { LeaderboardView } from '../ui/LeaderboardView';
import { bindGamepadActions } from '../input/GamepadInput';

export class Leaderboard extends Scene {
    constructor() {
        super('Leaderboard');
    }

    create() {
        let mode: GameMode = 'SINGLE_PLAYER';
        let request = 0;
        const show = (nextMode: GameMode) => {
            mode = nextMode;
            // Trocar de aba rápido não pode deixar a resposta antiga por cima da nova.
            const current = ++request;
            view.selectMode(mode);
            void scoreApi.getLeaderboard(mode)
                .then((entries) => current === request && view.showEntries(entries))
                .catch(() => current === request && view.showError());
        };
        const toggle = () => show(mode === 'SINGLE_PLAYER' ? 'MULTIPLAYER' : 'SINGLE_PLAYER');
        const view = new LeaderboardView(this, () => this.scene.stop(), show);
        this.input.keyboard?.once('keydown-ESC', () => this.scene.stop());
        for (const key of ['LEFT', 'RIGHT', 'A', 'D']) this.input.keyboard?.on(`keydown-${key}`, toggle);
        bindGamepadActions(this, {
            left: toggle,
            right: toggle,
            cancel: () => this.scene.stop()
        });
        show(mode);
    }
}
