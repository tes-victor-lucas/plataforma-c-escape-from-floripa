import { Scene } from 'phaser';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { RoomTransitionView } from '../ui/RoomTransitionView';
import type { World } from './World';

/** Orchestrates the transition from the main menu to Room 1. */
export class RoomTransition extends Scene {
    constructor() {
        super('RoomTransition');
    }

    create() {
        musicDirector.stop(this, AUDIO_CONFIG.music.fadeDuration);
        new RoomTransitionView(this).play({
            onCovered: () => this.startWorldUnderTransition(),
            onComplete: () => {
                const world = this.scene.get('World') as World;
                musicDirector.play(world, AUDIO_CONFIG.music.room1, AUDIO_CONFIG.music.fadeDuration);
                world.startGameplay();
                this.scene.stop();
            }
        });
    }

    private startWorldUnderTransition() {
        this.scene.launch('World', { waitForReveal: true });
        this.scene.sendToBack('World');
        this.scene.stop('MainMenu');
    }
}
