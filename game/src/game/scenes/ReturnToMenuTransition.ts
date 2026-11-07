import { Scene } from 'phaser';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import {
    BlackScreenTransitionView,
    RETURN_TO_MENU_CLOSE_DURATION
} from '../ui/BlackScreenTransitionView';
import type { World } from './World';
import { runTracker } from '../scoring/RunTracker';

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
                const saved = data.saveContinuation !== false && world.saveContinuation();
                if (!saved && runTracker.snapshot().status === 'RUNNING') runTracker.abandon();
                this.scene.stop('World');
                this.scene.stop('PauseMenu');
                this.scene.launch('MainMenu');
                this.scene.sendToBack('MainMenu');
            },
            // O menu permanece atrás das cenas de overlay configuradas, como o placar.
            // A cena de áudio é ignorada separadamente pela lógica de foco do gamepad.
            onComplete: () => this.scene.stop()
        });
    }
}
