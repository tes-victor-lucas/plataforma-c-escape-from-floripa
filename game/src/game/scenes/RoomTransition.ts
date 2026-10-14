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
import type { PlayerProgress } from '../progress/PlayerProgress';

export type RoomTransitionData = {
    roomKey?: RoomKey;
    source?: 'main-menu' | 'world';
    playerProgress?: PlayerProgress;
};

/** Orchestrates the transition from the main menu to Room 1. */
export class RoomTransition extends Scene {
    constructor() {
        super('RoomTransition');
    }

    create(data: RoomTransitionData = {}) {
        const roomKey = data.roomKey ?? getRequestedRoomKey();
        const roomDefinition = ROOM_DEFINITIONS[roomKey];
        if (data.source === 'world') this.scene.stop('MainMenu');
        musicDirector.stop(this, AUDIO_CONFIG.music.fadeDuration);
        new RoomTransitionView(this, roomDefinition.title).play({
            onCovered: () => this.startWorldUnderTransition(
                roomKey,
                data.source ?? 'main-menu',
                data.playerProgress
            ),
            onComplete: () => {
                const world = this.scene.get('World') as World;
                this.scene.stop('MainMenu');
                musicDirector.play(world, AUDIO_CONFIG.music.room1, AUDIO_CONFIG.music.fadeDuration);
                world.startGameplay();
                this.scene.stop();
            }
        });
    }

    private startWorldUnderTransition(
        roomKey: RoomKey,
        source: 'main-menu' | 'world' = 'main-menu',
        playerProgress?: PlayerProgress
    ) {
        const roomDefinition = ROOM_DEFINITIONS[roomKey];
        replaceRequestedRoomKey(roomKey);
        this.scene.stop('CombatHud');
        const worldData = {
            waitForReveal: true,
            roomKey,
            spawn: roomDefinition.spawn,
            ...(playerProgress ? { playerProgress } : {})
        };
        if (source === 'world') {
            const world = this.scene.get('World') as World;
            world.scene.restart(worldData);
        } else {
            this.scene.launch('World', worldData);
        }
        this.scene.sendToBack('World');
        this.scene.stop('MainMenu');
    }
}
