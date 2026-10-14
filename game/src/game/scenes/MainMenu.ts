import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { replaceRequestedRoomKey } from '../config/rooms';
import {
    clearCampaignProgress,
    loadCampaignProgress,
    type CampaignProgress
} from '../progress/CampaignProgress';

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
        const continuation = loadCampaignProgress();
        new MainMenuView(this, {
            onNewGame: () => this.startNewGame(),
            onContinue: continuation ? () => this.continueGame(continuation) : undefined
        }).create();
    }

    private startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        clearCampaignProgress();
        replaceRequestedRoomKey('room1');
        this.scene.launch('RoomTransition', { roomKey: 'room1' });
    }

    private continueGame(progress: CampaignProgress) {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.scene.launch('RoomTransition', {
            roomKey: progress.roomKey,
            playerProgress: progress.playerProgress
        });
    }

    private stopResidualGameplayScenes() {
        for (const sceneKey of GAMEPLAY_SCENES) this.scene.stop(sceneKey);
    }
}
