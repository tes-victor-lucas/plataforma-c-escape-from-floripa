import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';

const GAMEPLAY_SCENES = [
    'World',
    'CombatHud',
    'PauseMenu',
    'RoomTransition',
    'ReturnToMenuTransition'
] as const;

export class MainMenu extends Scene {
    private isStartingGame = false;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.isStartingGame = false;
        this.stopResidualGameplayScenes();
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

    private stopResidualGameplayScenes() {
        for (const sceneKey of GAMEPLAY_SCENES) this.scene.stop(sceneKey);
    }
}
