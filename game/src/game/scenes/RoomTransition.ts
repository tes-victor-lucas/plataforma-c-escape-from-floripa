import { Scene } from 'phaser';
import { RoomTransitionView } from '../ui/RoomTransitionView';
import type { World } from './World';

/** Orchestrates the transition from the main menu to Room 1. */
export class RoomTransition extends Scene {
    constructor() {
        super('RoomTransition');
    }

    create() {
        new RoomTransitionView(this).play({
            onCovered: () => this.startWorldUnderTransition(),
            onComplete: () => {
                (this.scene.get('World') as World).startGameplay();
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
