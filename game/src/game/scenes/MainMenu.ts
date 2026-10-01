import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';

export class MainMenu extends Scene {
    private isStartingGame = false;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.isStartingGame = false;
        musicDirector.play(this, AUDIO_CONFIG.music.mainMenu, AUDIO_CONFIG.music.fadeDuration);
        new MainMenuView(this, {
            onNewGame: () => this.startNewGame()
        }).create();
    }

    private startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.scene.launch('RoomTransition');
    }
}
