import { Scene } from 'phaser';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { BlackScreenTransitionView } from '../ui/BlackScreenTransitionView';

/** Returns from a paused room to the main menu while the screen is covered. */
export class ReturnToMenuTransition extends Scene {
    constructor() {
        super('ReturnToMenuTransition');
    }

    create() {
        musicDirector.stop(this, AUDIO_CONFIG.music.sceneExitFadeDuration);
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
