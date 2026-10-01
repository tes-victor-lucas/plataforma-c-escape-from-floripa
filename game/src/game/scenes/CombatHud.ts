import { Scene } from 'phaser';
import { DefeatView } from '../ui/DefeatView';
import { HeartHealthView } from '../ui/HeartHealthView';
import { PauseButtonView } from '../ui/PauseButtonView';
import type { Player } from '../entities/Player';

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
    private defeated = false;

    constructor() {
        super('CombatHud');
    }

    create(data: HudData) {
        this.dataSource = data;
        this.defeated = false;
        const gameContainer = document.getElementById('game-container');
        gameContainer?.classList.add('gameplay-active');
        this.hearts = new HeartHealthView(this, 20, 32);
        new PauseButtonView(this, data.onPause).create();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
            gameContainer?.classList.remove('gameplay-active'));
        this.update();
    }

    update() {
        const { player } = this.dataSource;
        this.hearts.update(player.health.current, player.health.max);

        if (!player.health.isAlive && !this.defeated) {
            this.defeated = true;
            new DefeatView(this, {
                onRestart: this.dataSource.onRestart,
                onQuit: this.dataSource.onQuit
            }).create();
        }
    }
}
