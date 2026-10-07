import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { multiplayerClient } from '../network/MultiplayerClient';

export class MainMenu extends Scene {
    private isStartingGame = false;
    private view?: MainMenuView;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.isStartingGame = false;
        multiplayerClient.disconnect();
        musicDirector.play(this, AUDIO_CONFIG.music.mainMenu, AUDIO_CONFIG.music.fadeDuration);
        this.view = new MainMenuView(this, {
            onNewGame: () => this.startNewGame(),
            onMultiplayer: () => void this.startMultiplayer()
        });
        this.view.create();
    }

    private startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.registry.set('multiplayerEnabled', false);
        this.scene.launch('RoomTransition');
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
            view.setStatus('DUPLA ENCONTRADA!');
            this.scene.launch('RoomTransition');
        } catch (error) {
            this.isStartingGame = false;
            multiplayerClient.disconnect();
            view.setStatus(error instanceof Error ? error.message.toUpperCase() : 'ERRO MULTIPLAYER');
        }
    }
}
