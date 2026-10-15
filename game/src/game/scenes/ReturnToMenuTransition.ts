import { Scene } from 'phaser';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import {
    BlackScreenTransitionView,
    RETURN_TO_MENU_CLOSE_DURATION
} from '../ui/BlackScreenTransitionView';
import type { World } from './World';

export type ReturnToMenuTransitionData = {
    saveContinuation?: boolean;
};

/** Returns from a paused room to the main menu while the screen is covered. */
export class ReturnToMenuTransition extends Scene {
    constructor() {
        super('ReturnToMenuTransition');
    }

    create(data: ReturnToMenuTransitionData = {}) {
        musicDirector.transitionTo(this, AUDIO_CONFIG.music.mainMenu, {
            fadeOutDuration: RETURN_TO_MENU_CLOSE_DURATION,
            fadeInDuration: AUDIO_CONFIG.music.fadeDuration
        });
        new BlackScreenTransitionView(this).play({
            onCovered: () => {
                const world = this.scene.get('World') as World;
                if (data.saveContinuation !== false) world.saveContinuation();
                this.scene.stop('World');
                this.scene.stop('PauseMenu');
                this.scene.launch('MainMenu');
                this.scene.sendToBack('MainMenu');
            },
            onComplete: () => this.scene.stop()
        });
    }
}
