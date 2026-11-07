import { Scene } from 'phaser';
import { PauseMenuView } from '../ui/PauseMenuView';
import type { UpgradeProgress } from '../upgrades';
import { bindGamepadActions } from '../input/GamepadInput';

type PauseMenuData = {
    upgrades?: UpgradeProgress;
};

/** Overlay scene that pauses Room 1 without destroying its state. */
export class PauseMenu extends Scene {
    private isLeaving = false;

    constructor() {
        super('PauseMenu');
    }

    create(data: PauseMenuData = {}) {
        this.isLeaving = false;
        new PauseMenuView(this, {
            onContinue: () => this.continueGame(),
            onQuit: () => this.quitToMainMenu(),
            upgrades: data.upgrades ?? []
        }).create();

        this.input.keyboard?.once('keydown-P', this.continueGame, this);
        bindGamepadActions(this, { pause: () => this.continueGame() });
    }

    private continueGame() {
        if (this.isLeaving) return;

        this.scene.resume('World');
        this.scene.stop();
    }

    private quitToMainMenu() {
        if (this.isLeaving) return;

        this.isLeaving = true;
        this.scene.launch('ReturnToMenuTransition');
        this.scene.bringToTop('ReturnToMenuTransition');
    }
}
