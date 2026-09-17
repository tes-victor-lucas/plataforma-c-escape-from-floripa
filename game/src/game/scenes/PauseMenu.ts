import { Scene } from 'phaser';
import { PauseMenuView } from '../ui/PauseMenuView';

/** Overlay scene that pauses Room 1 without destroying its state. */
export class PauseMenu extends Scene {
    private isLeaving = false;

    constructor() {
        super('PauseMenu');
    }

    create() {
        this.isLeaving = false;
        new PauseMenuView(this, {
            onContinue: () => this.continueGame(),
            onQuit: () => this.quitToMainMenu()
        }).create();

        this.input.keyboard?.once('keydown-ESC', this.continueGame, this);
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
