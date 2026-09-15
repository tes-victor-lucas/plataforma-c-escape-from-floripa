import { Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.load.tilemapTiledJSON(
            'room1',
            'assets/maps/room01.json'
        );

        this.load.image(
            'floor_and_buildings',
            'assets/tilesets/floor_and_buildings-01.png'
        );

        this.load.image(
            'floor_and_walls',
            'assets/tilesets/floor_and_walls-1.png'
        );

        this.load.image(
            'objects',
            'assets/tilesets/objects_and_items-01.png'
        );

        this.load.spritesheet(
            'player-walk',
            'assets/character.png',
            { frameWidth: 38, frameHeight: 38 }
        );

        this.load.audio(
            AUDIO_CONFIG.effects.playerFootstep.key,
            AUDIO_CONFIG.effects.playerFootstep.path
        );

        this.load.audio(
            AUDIO_CONFIG.music.room1.key,
            AUDIO_CONFIG.music.room1.path
        );
    }

    create() {
        this.scene.start('World');
    }
}
