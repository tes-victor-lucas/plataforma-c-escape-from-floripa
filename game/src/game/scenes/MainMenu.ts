import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { multiplayerClient } from '../network/MultiplayerClient';
import { replaceRequestedRoomKey } from '../config/rooms';
import {
    clearCampaignProgress,
    loadCampaignProgress,
    type CampaignProgress
} from '../progress/CampaignProgress';
import { runTracker } from '../scoring/RunTracker';

const GAMEPLAY_SCENES = [
    'World',
    'CombatHud',
    'PauseMenu',
    'RoomTransition'
] as const;

export class MainMenu extends Scene {
    private isStartingGame = false;
    private view?: MainMenuView;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.isStartingGame = false;
        multiplayerClient.disconnect();
        this.registry.set('multiplayerEnabled', false);
        this.stopResidualGameplayScenes();
        musicDirector.play(this, AUDIO_CONFIG.music.mainMenu, AUDIO_CONFIG.music.fadeDuration);
        const continuation = loadCampaignProgress();
        this.view = new MainMenuView(this, {
            onNewGame: () => this.startNewGame(),
            onContinue: continuation ? () => this.continueGame(continuation) : undefined,
            onMultiplayer: () => void this.startMultiplayer(),
            onLeaderboard: () => this.scene.launch('Leaderboard')
        });
        this.view.create();
    }

    private startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.registry.set('multiplayerEnabled', false);
        clearCampaignProgress();
        runTracker.startNew('SINGLE_PLAYER');
        replaceRequestedRoomKey('room1');
        this.scene.launch('RoomTransition', { roomKey: 'room1' });
    }

    private continueGame(progress: CampaignProgress) {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.registry.set('multiplayerEnabled', false);
        if (progress.run) runTracker.restore(progress.run);
        else runTracker.startNew('SINGLE_PLAYER');
        this.scene.launch('RoomTransition', {
            roomKey: progress.roomKey,
            playerProgress: progress.playerProgress
        });
    }

    private stopResidualGameplayScenes() {
        for (const sceneKey of GAMEPLAY_SCENES) this.scene.stop(sceneKey);
    }

    private async startMultiplayer() {
        if (this.isStartingGame) return;
        const view = this.view;
        if (!view) return;
        this.isStartingGame = true;
        view.setStatus('CONECTANDO...');

        try {
            await multiplayerClient.connect((status) => view.setStatus(status));
            this.registry.set('multiplayerEnabled', true);
            runTracker.startNew('MULTIPLAYER');
            replaceRequestedRoomKey('room1');
            view.setStatus('DUPLA ENCONTRADA!');
            this.scene.launch('RoomTransition', { roomKey: 'room1' });
        } catch (error) {
            this.isStartingGame = false;
            multiplayerClient.disconnect();
            view.setStatus(error instanceof Error ? error.message.toUpperCase() : 'ERRO MULTIPLAYER');
        }
    }
}
