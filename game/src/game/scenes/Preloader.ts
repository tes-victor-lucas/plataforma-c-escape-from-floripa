import { Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { DRONE_EXPLOSION } from '../effects/playDroneExplosion';
import { HUD_CONFIG } from '../config/hud';
import { ROOM_DEFINITIONS } from '../config/rooms';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.load.image(
            'menu-background',
            'assets/menu-background.png'
        );

        this.load.image(HUD_CONFIG.heart.texture, HUD_CONFIG.heart.path);
        this.load.image(
            HUD_CONFIG.controls.pauseTexture,
            HUD_CONFIG.controls.pausePath
        );

        this.load.image('piranhas-cookie-magico', 'assets/items/piranhas-bar/cookie-magico-transparent.png');
        this.load.image('piranhas-gin-melancia', 'assets/items/piranhas-bar/gin-de-10-melancia-transparent.png');
        this.load.image('piranhas-gin-tropical', 'assets/items/piranhas-bar/gin-de-10-tropical-transparent.png');

        const loadedTextures = new Set<string>();
        for (const room of Object.values(ROOM_DEFINITIONS)) {
            this.load.tilemapTiledJSON(room.mapKey, room.mapPath);
            for (const tileset of room.tilesets) {
                if (loadedTextures.has(tileset.textureKey)) continue;
                loadedTextures.add(tileset.textureKey);
                this.load.image(tileset.textureKey, tileset.path);
            }
        }

        this.load.spritesheet(
            'player-walk',
            'assets/character.png',
            { frameWidth: 38, frameHeight: 38 }
        );

        this.load.spritesheet(
            'drone-fly',
            'assets/enemies/drone-robot_nyknck/drone-robot_nyknck.png',
            { frameWidth: 32, frameHeight: 32 }
        );

        this.load.spritesheet(DRONE_EXPLOSION.texture, DRONE_EXPLOSION.path, {
            frameWidth: DRONE_EXPLOSION.frameWidth,
            frameHeight: DRONE_EXPLOSION.frameHeight
        });

        this.load.audio(
            AUDIO_CONFIG.effects.playerFootstep.key,
            AUDIO_CONFIG.effects.playerFootstep.path
        );


        this.load.audio(
            AUDIO_CONFIG.effects.playerHurt.key,
            AUDIO_CONFIG.effects.playerHurt.path
        );

        this.load.audio(
            AUDIO_CONFIG.effects.droneExplosion.key,
            AUDIO_CONFIG.effects.droneExplosion.path
        );

        this.load.audio(
            AUDIO_CONFIG.effects.playerDeath.key,
            AUDIO_CONFIG.effects.playerDeath.path
        );

        this.load.audio(
            AUDIO_CONFIG.effects.playerShot.key,
            AUDIO_CONFIG.effects.playerShot.path,
            { instances: 4 }
        );

        this.load.audio(
            AUDIO_CONFIG.effects.enemyShot.key,
            AUDIO_CONFIG.effects.enemyShot.path,
            { instances: 24 }
        );

        this.load.audio(
            AUDIO_CONFIG.music.mainMenu.key,
            AUDIO_CONFIG.music.mainMenu.path
        );

        this.load.audio(
            AUDIO_CONFIG.music.room1.key,
            AUDIO_CONFIG.music.room1.path
        );
    }

    create() {
        this.scene.start('MainMenu');
    }
}
