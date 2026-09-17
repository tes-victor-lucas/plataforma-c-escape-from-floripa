import { Scene } from 'phaser';
import { LoopingMusic } from '../audio/LoopingMusic';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { AUDIO_CONFIG } from '../config/audio';
import { WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';

export class World extends Scene {
    private player?: Player;
    private drone?: Drone;
    private roomMusic?: LoopingMusic;
    private isPauseMenuOpen = false;

    constructor() {
        super('World');
    }

    create() {
        this.isPauseMenuOpen = false;
        const room = createRoom(this, WORLD_CONFIG.mapKey);
        if (!room) return;

        this.player = new Player(this, {
            x: room.map.widthInPixels / 2,
            y: room.map.heightInPixels / 2
        });
        this.drone = new Drone(this);

        for (const layer of room.collisionLayers) {
            this.physics.add.collider(this.player.sprite, layer);
            this.physics.add.collider(this.drone.sprite, layer);
        }
        this.physics.add.collider(this.player.sprite, this.drone.sprite);

        configureWorldCamera(this, room.map, this.player.sprite);
        this.roomMusic = new LoopingMusic(this, AUDIO_CONFIG.music.room1);
        this.roomMusic.start();
        this.input.keyboard?.on('keydown-ESC', this.openPauseMenu, this);
        this.events.on(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    }

    update(_time: number, delta: number) {
        this.player?.update(delta);
        this.drone?.update();
    }

    private shutdown() {
        this.input.keyboard?.off('keydown-ESC', this.openPauseMenu, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
        this.roomMusic?.destroy();
        this.roomMusic = undefined;
    }

    private openPauseMenu() {
        if (this.isPauseMenuOpen) return;

        this.isPauseMenuOpen = true;
        this.scene.launch('PauseMenu');
        this.scene.bringToTop('PauseMenu');
        this.scene.pause('World');
    }

    private resetPauseMenuState() {
        this.isPauseMenuOpen = false;
    }
}
