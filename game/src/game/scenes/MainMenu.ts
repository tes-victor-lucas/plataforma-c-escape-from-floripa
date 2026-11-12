import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';
import { CHARACTERS, loadCharacterId, nextCharacterId, saveCharacterId } from '../config/characters';
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
import { playIntroVideo } from '../ui/IntroVideo';
import { googleAuth } from '../auth/GoogleAuth';

const GAMEPLAY_SCENES = [
    'World',
    'CombatHud',
    'PauseMenu',
    'ArcadeMinigame',
    'ConfirmPrompt',
    'WalletMenu',
    'RoomTransition'
] as const;

export class MainMenu extends Scene {
    private isStartingGame = false;
    private view?: MainMenuView;
    private stopRoomWatch?: () => void;
    /** Uma espera cancelada ainda termina depois, e não pode mexer no menu atual. */
    private joinAttempt = 0;

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
            // Um link com `?room=` já diz a sala, então não pergunta de novo.
            onMultiplayer: () => new URLSearchParams(window.location.search).has('room')
                ? void this.startMultiplayer()
                : this.openMultiplayerMenu(),
            onLeaderboard: () => this.scene.launch('Leaderboard'),
            // Jogar sem entrar continua valendo: só não salva no placar nem paga os tijolinhos da feira.
            // O script do Google carrega à parte: se ainda não chegou ou foi bloqueado, o menu fica sem a conta.
            account: () => googleAuth.isAvailable ? this.getAccountAction() : undefined,
            character: () => CHARACTERS[loadCharacterId()],
            onToggleCharacter: () => {
                saveCharacterId(nextCharacterId(loadCharacterId()));
                this.view?.refreshPlayMenu();
            }
        });
        this.view.create();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopWatchingRooms());
    }

    private getAccountAction() {
        const user = googleAuth.user;
        if (user) {
            return {
                label: `SAIR DA CONTA (${user.name.toUpperCase().slice(0, 14)})`,
                onSelect: () => {
                    googleAuth.signOut();
                    this.view?.refreshMainMenu();
                }
            };
        }
        return {
            label: 'ENTRAR COM GOOGLE',
            onSelect: () => void googleAuth.signIn().then(() => {
                if (this.scene.isActive()) this.view?.refreshMainMenu();
            })
        };
    }

    private async startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        // A abertura tem a própria trilha; o tempo da partida só começa depois dela.
        musicDirector.stop(this, 300);
        // A tecla que pula o vídeo não pode também mexer no menu que está embaixo.
        if (this.input.keyboard) this.input.keyboard.enabled = false;
        await playIntroVideo();
        if (this.input.keyboard) this.input.keyboard.enabled = true;
        if (!this.scene.isActive()) return;
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

    private stopWatchingRooms() {
        this.stopRoomWatch?.();
        this.stopRoomWatch = undefined;
    }

    private openMultiplayerMenu() {
        const view = this.view;
        if (!view) return;
        let rooms: string[] = [];
        const render = () => view.showMultiplayerMenu(rooms, {
            onCreate: () => {
                this.stopWatchingRooms();
                view.setStatus('');
                view.showRoomInput(
                    (roomName) => void this.startMultiplayer(roomName),
                    () => this.openMultiplayerMenu()
                );
            },
            onJoin: (roomId) => void this.startMultiplayer(roomId),
            onBack: () => {
                this.stopWatchingRooms();
                view.setStatus('');
                view.showPlayMenu();
            }
        });
        render();
        this.stopWatchingRooms();
        this.stopRoomWatch = multiplayerClient.watchRooms((nextRooms) => {
            if (nextRooms.join() === rooms.join()) return;
            rooms = nextRooms;
            render();
        }, () => view.setStatus('SERVIDOR MULTIPLAYER INDISPONÍVEL'));
    }

    private cancelMultiplayerWait() {
        this.joinAttempt += 1;
        this.isStartingGame = false;
        multiplayerClient.disconnect();
        this.view?.setStatus('');
        this.openMultiplayerMenu();
    }

    private async startMultiplayer(roomName?: string) {
        if (this.isStartingGame) return;
        const view = this.view;
        if (!view) return;
        this.stopWatchingRooms();
        this.isStartingGame = true;
        const attempt = ++this.joinAttempt;
        view.showWaitingForPartner(() => this.cancelMultiplayerWait());
        view.setStatus('CONECTANDO...');

        try {
            await multiplayerClient.connect((status) => view.setStatus(status), roomName);
            if (attempt !== this.joinAttempt) return;
            this.registry.set('multiplayerEnabled', true);
            runTracker.startNew('MULTIPLAYER');
            replaceRequestedRoomKey('room1');
            view.setStatus('DUPLA ENCONTRADA!');
            this.scene.launch('RoomTransition', { roomKey: 'room1' });
        } catch (error) {
            if (attempt !== this.joinAttempt) return;
            this.isStartingGame = false;
            multiplayerClient.disconnect();
            this.openMultiplayerMenu();
            view.setStatus(error instanceof Error ? error.message.toUpperCase() : 'ERRO MULTIPLAYER');
        }
    }
}
