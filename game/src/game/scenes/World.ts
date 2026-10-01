import { Scene } from 'phaser';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';
import { CombatSystem } from '../combat/CombatSystem';
import { DroneWaves, selectDroneSpawns } from '../combat/DroneWaves';
import { WaveThreatView } from '../ui/WaveThreatView';
import { UpgradeSelectionView } from '../ui/UpgradeSelectionView';
import { drawUpgradeCards } from '../upgrades/drawUpgradeCards';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeCardDefinition } from '../upgrades/types';

export class World extends Scene {
    private player?: Player;
    private playerRangeIndicator?: Phaser.GameObjects.Arc;
    private drones: Drone[] = [];
    private droneBodies?: Phaser.Physics.Arcade.Group;
    private combat?: CombatSystem;
    private waves?: DroneWaves;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private isGameOver = false;
    private isPauseMenuOpen = false;
    private isGameplayReady = false;
    private readonly upgrades = new PlayerUpgradeState();

    constructor() {
        super('World');
    }

    create(data: { waitForReveal?: boolean } = {}) {
        this.isPauseMenuOpen = false;
        this.isGameOver = false;
        this.isGameplayReady = false;
        this.upgrades.reset();
        this.physics.pause();
        const room = createRoom(this, WORLD_CONFIG.mapKey);
        if (!room) return;

        this.player = new Player(this, WORLD_CONFIG.player.spawn);
        this.createPlayerRangeIndicator();
        this.drones = [];
        this.droneBodies = this.createDroneBodies();
        this.collisionLayers = room.collisionLayers;

        for (const layer of room.collisionLayers) {
            this.physics.add.collider(this.player.sprite, layer);
        }
        this.combat = new CombatSystem(this, this.player, this.drones, room.collisionLayers, this.upgrades);
        this.waves = new DroneWaves(
            (count) => this.spawnDrones(count),
            () => {
                if (this.player) this.upgrades.repairAfterRoom(this.player.health);
                room.openExit();
                this.player?.clearBlockedDirection();
            },
            (resume) => this.playWaveIntermission(resume)
        );
        this.waves.update(this.drones);

        configureWorldCamera(this, room.map, this.player.sprite);
        this.input.keyboard?.on('keydown-P', this.openPauseMenu, this);
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
            onPause: () => this.openPauseMenu(),
            onRestart: () => this.scene.restart({ waitForReveal: false }),
            onQuit: () => this.scene.start('MainMenu')
        });
    }

    update(_time: number, delta: number) {
        this.updatePlayerRangeIndicator();
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
            this.droneBodies?.add(drone.sprite);
            this.drones.push(drone);
            this.combat.registerDrone(drone);
        }
    }

    private createDroneBodies() {
        const group = this.physics.add.group();
        this.physics.add.collider(group, group);
        return group;
    }

    private playWaveIntermission(resume: () => void) {
        this.combat?.clear();
        this.physics.pause();
        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(overlayScene, drawUpgradeCards(undefined, this.upgrades.availableCards())).play((selected) => {
            this.acquireUpgrade(selected);
            new WaveThreatView(overlayScene, this.cameras.main).play(() => {
                if (this.isGameplayReady && !this.isGameOver) this.physics.resume();
                resume();
            });
        });
    }

    private acquireUpgrade(card: UpgradeCardDefinition) {
        if (!this.upgrades.acquire(card)) return;
        if (card.effect.type === 'increase-max-health') {
            this.player?.health.increaseMax(card.effect.amount, card.effect.healAmount);
        }
        this.playerRangeIndicator?.setRadius(this.upgrades.range);
    }

    private createPlayerRangeIndicator() {
        const { range } = COMBAT_CONFIG.player;
        const { color, fillAlpha, strokeAlpha, strokeWidth } = COMBAT_CONFIG.rangeIndicator;
        this.playerRangeIndicator = this.add.circle(0, 0, range, color, fillAlpha)
            .setStrokeStyle(strokeWidth, color, strokeAlpha)
            .setDepth(5);
        this.updatePlayerRangeIndicator();
    }

    private updatePlayerRangeIndicator() {
        if (!this.player || !this.playerRangeIndicator) return;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        this.playerRangeIndicator.setPosition(center.x, center.y);
    }

    private shutdown() {
        this.isGameplayReady = false;
        this.scene.stop('CombatHud');
        this.combat?.clear();
        this.combat = undefined;
        this.waves = undefined;
        this.upgrades.reset();
        this.collisionLayers = [];
        this.drones = [];
        this.droneBodies = undefined;
        this.player = undefined;
        this.playerRangeIndicator = undefined;
        this.input.keyboard?.off('keydown-P', this.openPauseMenu, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
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
