import type { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';
import { formatElapsedTime } from '../scoring/ScoreCalculator';
import { runTracker, type RunTrackerEvent } from '../scoring/RunTracker';

/** Contadores compactos da run e aviso transitório de multi-kill. */
export class RunStatsHudView {
    private readonly time: Phaser.GameObjects.Text;
    private readonly score: Phaser.GameObjects.Text;
    private readonly multiKill: Phaser.GameObjects.Text;
    private unsubscribe?: () => void;

    constructor(private readonly scene: Scene) {
        this.time = scene.add.text(GAME_WIDTH / 2, 12, '', {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '26px',
            color: '#ffffff',
            stroke: '#06263d',
            strokeThickness: 4
        }).setOrigin(0.5, 0).setDepth(110).setScrollFactor(0).setResolution(2);
        this.score = scene.add.text(20, 53, '', {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '22px',
            color: '#ffffff',
            stroke: '#06263d',
            strokeThickness: 3
        }).setOrigin(0, 0).setDepth(110).setScrollFactor(0).setResolution(2);
        this.multiKill = scene.add.text(GAME_WIDTH / 2, 70, '', {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '30px',
            color: '#5ce5f1',
            stroke: '#06263d',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(120).setScrollFactor(0).setAlpha(0);

        this.unsubscribe = runTracker.subscribe((_snapshot, event) => this.onTrackerEvent(event));
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    }

    update() {
        const run = runTracker.snapshot();
        this.time.setText(formatElapsedTime(run.elapsedTimeMs));
        this.score.setText(`PONTOS ${run.score.total}`);
    }

    private onTrackerEvent(event?: RunTrackerEvent) {
        if (!event || event.type !== 'MULTI_KILL') return;
        const label = event.enemies === 2 ? 'DOUBLE KILL' : `${event.enemies}X MULTI-KILL`;
        this.multiKill.setText(`${label}  +${event.bonus}`).setAlpha(1).setScale(0.8);
        this.scene.tweens.killTweensOf(this.multiKill);
        this.scene.tweens.add({
            targets: this.multiKill,
            alpha: 0,
            scale: 1.12,
            duration: 1_200,
            ease: 'Quad.easeOut'
        });
    }

    private destroy() {
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }
}
