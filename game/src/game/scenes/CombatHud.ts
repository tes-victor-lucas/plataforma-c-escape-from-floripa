import { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';
import { HeartHealthView } from '../ui/HeartHealthView';
import { PauseButtonView } from '../ui/PauseButtonView';
import type { Player } from '../entities/Player';
import { RunStatsHudView } from '../ui/RunStatsHudView';
import { RunResultView } from '../ui/RunResultView';
import { runTracker } from '../scoring/RunTracker';
import { DashCooldownView } from '../ui/DashCooldownView';
import { TouchControlsView } from '../ui/TouchControlsView';

type HudData = {
    player: Player;
    onPause: () => void;
    onRestart: () => void;
    onQuit: () => void;
    /** Só existe no multiplayer. */
    getCoopStatus?: () => { partnerHealth?: { current: number; max: number }; message: string };
};

/** Interface em uma câmera própria, independente do zoom e da posição do mapa. */
export class CombatHud extends Scene {
    private dataSource: HudData;
    private hearts: HeartHealthView;
    private resultShown = false;
    private runStats: RunStatsHudView;
    private dashCooldown: DashCooldownView;
    private partnerHearts?: HeartHealthView;
    private partnerLabel?: Phaser.GameObjects.Text;
    private coopMessage?: Phaser.GameObjects.Text;

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
        this.dashCooldown = new DashCooldownView(this, 20, 84);
        new PauseButtonView(this, data.onPause).create();
        new TouchControlsView(this).create();
        if (data.getCoopStatus) {
            this.partnerLabel = this.add.text(20, 116, 'PARCEIRO', {
                fontFamily: 'Pixeboy, monospace',
                fontSize: '16px',
                color: '#66ccff',
                stroke: '#06263d',
                strokeThickness: 3
            }).setDepth(110).setResolution(2);
            this.partnerHearts = new HeartHealthView(this, 20, 150);
            // Acima das cartas, para avisar quem já escolheu que falta o parceiro.
            this.coopMessage = this.add.text(GAME_WIDTH / 2, 462, '', {
                fontFamily: 'Pixeboy, monospace',
                fontSize: '20px',
                color: '#ffffff',
                stroke: '#06263d',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(190).setResolution(2);
        } else {
            this.partnerHearts = undefined;
            this.partnerLabel = undefined;
            this.coopMessage = undefined;
        }
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
            gameContainer?.classList.remove('gameplay-active'));
        this.update();
    }

    update() {
        const { player } = this.dataSource;
        this.hearts.update(player.health.current, player.health.max);
        this.runStats.update();
        this.dashCooldown.update(player.getDashCharge());
        const coop = this.dataSource.getCoopStatus?.();
        if (coop) {
            this.coopMessage?.setText(coop.message);
            this.partnerLabel?.setVisible(Boolean(coop.partnerHealth));
            this.partnerHearts?.update(coop.partnerHealth?.current ?? 0, coop.partnerHealth?.max ?? 0);
        }

        const result = runTracker.snapshot();
        if (!this.resultShown && (result.status === 'WON' || result.status === 'LOST')) {
            this.resultShown = true;
            new RunResultView(this, {
                result,
                onPrimary: result.status === 'WON' ? this.dataSource.onQuit : this.dataSource.onRestart,
                onQuit: this.dataSource.onQuit,
                ...(this.dataSource.getCoopStatus ? { retryLabel: 'NOVA PARTIDA' } : {})
            }).create();
        }
    }
}
