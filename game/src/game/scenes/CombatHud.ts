import { Scene } from 'phaser';
import { HeartHealthView } from '../ui/HeartHealthView';
import { PauseButtonView } from '../ui/PauseButtonView';
import type { Player } from '../entities/Player';
import { RunStatsHudView } from '../ui/RunStatsHudView';
import { RunResultView } from '../ui/RunResultView';
import { runTracker } from '../scoring/RunTracker';

type HudData = {
    player: Player;
    onPause: () => void;
    onRestart: () => void;
    onQuit: () => void;
};

/** Interface em uma câmera própria, independente do zoom e da posição do mapa. */
export class CombatHud extends Scene {
    private dataSource: HudData;
    private hearts: HeartHealthView;
    private resultShown = false;
    private runStats: RunStatsHudView;

    constructor() {
        super('CombatHud');
    }

    create(data: HudData) {
        this.dataSource = data;
        this.resultShown = false;
        const gameContainer = document.getElementById('game-container');
        gameContainer?.classList.add('gameplay-active');
        this.hearts = new HeartHealthView(this, 20, 32);
        this.runStats = new RunStatsHudView(this);
        new PauseButtonView(this, data.onPause).create();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
            gameContainer?.classList.remove('gameplay-active'));
        this.update();
    }

    update() {
        const { player } = this.dataSource;
        this.hearts.update(player.health.current, player.health.max);
        this.runStats.update();

        const result = runTracker.snapshot();
        if (!this.resultShown && (result.status === 'WON' || result.status === 'LOST')) {
            this.resultShown = true;
            new RunResultView(this, {
                result,
                onPrimary: result.status === 'WON' ? this.dataSource.onQuit : this.dataSource.onRestart,
                onQuit: this.dataSource.onQuit
            }).create();
        }
    }
}
