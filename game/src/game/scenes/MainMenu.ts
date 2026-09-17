import { Scene } from 'phaser';
import { MainMenuView } from '../ui/MainMenuView';

export class MainMenu extends Scene {
    private isStartingGame = false;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.isStartingGame = false;
        new MainMenuView(this, {
            onNewGame: () => this.startNewGame()
        }).create();

        this.input.keyboard?.once('keydown-ENTER', this.startNewGame, this);
    }

    private startNewGame() {
        if (this.isStartingGame) return;

        this.isStartingGame = true;
        this.scene.launch('RoomTransition');
    }
}
