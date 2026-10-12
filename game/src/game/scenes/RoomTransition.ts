import { Scene } from 'phaser';
import { musicDirector } from '../audio/MusicDirector';
import { AUDIO_CONFIG } from '../config/audio';
import { RoomTransitionView } from '../ui/RoomTransitionView';
import {
    getRequestedRoomKey,
    replaceRequestedRoomKey,
    ROOM_DEFINITIONS,
    type RoomKey
} from '../config/rooms';
import type { World } from './World';

export type RoomTransitionData = {
    roomKey?: RoomKey;
};

/** Orchestrates the transition from the main menu to Room 1. */
export class RoomTransition extends Scene {
    constructor() {
        super('RoomTransition');
    }

    create(data: RoomTransitionData = {}) {
        const roomKey = data.roomKey ?? getRequestedRoomKey();
        const roomDefinition = ROOM_DEFINITIONS[roomKey];
        musicDirector.stop(this, AUDIO_CONFIG.music.fadeDuration);
        new RoomTransitionView(this, roomDefinition.title).play({
            onCovered: () => this.startWorldUnderTransition(roomKey),
            onComplete: () => {
                const world = this.scene.get('World') as World;
                musicDirector.play(world, AUDIO_CONFIG.music.room1, AUDIO_CONFIG.music.fadeDuration);
                world.startGameplay();
                this.scene.stop();
            }
        });
    }

    private startWorldUnderTransition(roomKey: RoomKey) {
        const roomDefinition = ROOM_DEFINITIONS[roomKey];
        replaceRequestedRoomKey(roomKey);
        this.scene.stop('CombatHud');
        this.scene.stop('World');
        this.scene.launch('World', {
            waitForReveal: true,
            roomKey,
            spawn: roomDefinition.spawn
        });
        this.scene.sendToBack('World');
        this.scene.stop('MainMenu');
    }
}
