import { Boot } from './scenes/Boot';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { World } from './scenes/World';
import { MainMenu } from './scenes/MainMenu';
import { RoomTransition } from './scenes/RoomTransition';
import { PauseMenu } from './scenes/PauseMenu';
import { ReturnToMenuTransition } from './scenes/ReturnToMenuTransition';
import { GAME_HEIGHT, GAME_WIDTH } from './config/display';


//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        RoomTransition,
        PauseMenu,
        ReturnToMenuTransition,
        World
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
