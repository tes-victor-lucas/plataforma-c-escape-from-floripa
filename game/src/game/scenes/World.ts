import { Scene } from 'phaser';
import { LoopingMusic } from '../audio/LoopingMusic';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { AUDIO_CONFIG } from '../config/audio';
import { WORLD_CONFIG } from '../config/world';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';

export class World extends Scene {
    private player?: Player;
    private roomMusic?: LoopingMusic;

    constructor() {
        super('World');
    }

    create() {
        const room = createRoom(this, WORLD_CONFIG.mapKey);
        if (!room) return;

        this.player = new Player(this);

        for (const layer of room.collisionLayers) {
            this.physics.add.collider(this.player.sprite, layer);
        }

        configureWorldCamera(this, room.map, this.player.sprite);
        this.roomMusic = new LoopingMusic(this, AUDIO_CONFIG.music.room1);
        this.roomMusic.start();
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    }

    update(_time: number, delta: number) {
        this.player?.update(delta);
    }

    private shutdown() {
        this.roomMusic?.destroy();
        this.roomMusic = undefined;
    }
}
