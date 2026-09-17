import { Scene } from 'phaser';
import { BlackScreenTransitionView } from '../ui/BlackScreenTransitionView';

/** Returns from a paused room to the main menu while the screen is covered. */
export class ReturnToMenuTransition extends Scene {
    constructor() {
        super('ReturnToMenuTransition');
    }

    create() {
        new BlackScreenTransitionView(this).play({
            onCovered: () => {
                this.scene.stop('World');
                this.scene.stop('PauseMenu');
                this.scene.launch('MainMenu');
                this.scene.sendToBack('MainMenu');
            },
            onComplete: () => this.scene.stop()
        });
    }
}
