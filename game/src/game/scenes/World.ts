import { Scene } from 'phaser';
import { LoopingMusic } from '../audio/LoopingMusic';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { AUDIO_CONFIG } from '../config/audio';
import { WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';
import { CombatSystem } from '../combat/CombatSystem';
import { DroneWaves, selectDroneSpawns } from '../combat/DroneWaves';

export class World extends Scene {
    private player?: Player;
    private drones: Drone[] = [];
    private combat?: CombatSystem;
    private waves?: DroneWaves;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private isGameOver = false;
    private roomMusic?: LoopingMusic;
    private isPauseMenuOpen = false;
    private isGameplayReady = false;

    constructor() {
        super('World');
    }

    create(data: { waitForReveal?: boolean } = {}) {
        this.isPauseMenuOpen = false;
        this.isGameOver = false;
        this.isGameplayReady = false;
        this.physics.pause();
        const room = createRoom(this, WORLD_CONFIG.mapKey);
        if (!room) return;

        this.player = new Player(this, WORLD_CONFIG.player.spawn);
        this.drones = [];
        this.collisionLayers = room.collisionLayers;

        for (const layer of room.collisionLayers) {
            this.physics.add.collider(this.player.sprite, layer);
        }
        this.combat = new CombatSystem(this, this.player, this.drones, room.collisionLayers);
        this.waves = new DroneWaves(
            (count) => this.spawnDrones(count),
            () => {
                room.openExit();
                this.player?.clearBlockedDirection();
            }
        );
        this.waves.update(this.drones);

        configureWorldCamera(this, room.map, this.player.sprite);
        this.roomMusic = new LoopingMusic(this, AUDIO_CONFIG.music.room1);
        this.roomMusic.start();
        this.input.keyboard?.on('keydown-ESC', this.openPauseMenu, this);
        this.events.on(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        if (!data.waitForReveal) this.startGameplay();
    }

    /** Libera controles, combate e vida somente depois de revelar a sala. */
    startGameplay() {
        if (this.isGameplayReady || !this.player) return;

        this.isGameplayReady = true;
        this.physics.resume();
        this.scene.launch('CombatHud', {
            player: this.player,
            onRestart: () => this.scene.restart({ waitForReveal: false }),
            onQuit: () => this.scene.start('MainMenu')
        });
    }

    update(_time: number, delta: number) {
        if (!this.isGameplayReady || this.isGameOver) return;
        if (this.player && !this.player.health.isAlive) {
            this.isGameOver = true;
            this.combat?.clear();
            this.physics.pause();
            return;
        }
        this.player?.update(delta);
        for (const drone of this.drones) drone.update(this.player);
        this.combat?.update(delta);
        this.waves?.update(this.drones);
    }

    private spawnDrones(count: number) {
        if (!this.player || !this.combat) return;
        const spawns = selectDroneSpawns(count, this.player.sprite);
        this.combat.clear();
        for (const spawn of spawns) {
            const drone = new Drone(this, spawn, this.collisionLayers);
            for (const layer of this.collisionLayers) this.physics.add.collider(drone.sprite, layer);
            this.physics.add.collider(this.player.sprite, drone.sprite);
            this.drones.push(drone);
            this.combat.registerDrone(drone);
        }
    }

    private shutdown() {
        this.isGameplayReady = false;
        this.scene.stop('CombatHud');
        this.combat?.clear();
        this.combat = undefined;
        this.waves = undefined;
        this.collisionLayers = [];
        this.drones = [];
        this.player = undefined;
        this.input.keyboard?.off('keydown-ESC', this.openPauseMenu, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
        this.roomMusic?.destroy();
        this.roomMusic = undefined;
    }

    private openPauseMenu() {
        if (!this.isGameplayReady || this.isPauseMenuOpen || !this.player?.health.isAlive) return;

        this.isPauseMenuOpen = true;
        this.scene.launch('PauseMenu');
        this.scene.bringToTop('PauseMenu');
        this.scene.pause('World');
    }

    private resetPauseMenuState() {
        this.isPauseMenuOpen = false;
    }
}
