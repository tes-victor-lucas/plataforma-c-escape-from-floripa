import { Scene } from 'phaser';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { COMBAT_CONFIG } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';
import { CombatSystem } from '../combat/CombatSystem';
import {
    createReachableDroneSpawns,
    DroneWaves,
    selectDroneSpawns,
    type DroneSpawnPoint
} from '../combat/DroneWaves';
import { WaveThreatView } from '../ui/WaveThreatView';
import { UpgradeSelectionView } from '../ui/UpgradeSelectionView';
import { drawUpgradeCards } from '../upgrades/drawUpgradeCards';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeCardDefinition } from '../upgrades/types';
import { getRequestedRoomKey } from '../config/rooms';
import { StairClimbEffect } from '../map/StairClimbEffect';
import {
    isInsidePiranhasBarArea,
    PIRANHAS_BAR_CONFIG,
    PIRANHAS_BAR_ITEMS,
    type PiranhasBarItem
} from '../config/piranhasBar';

const ROOM2_WALKABLE_LAYERS = ['floor', 'stairs', 'street', 'floor-terminal'] as const;

export class World extends Scene {
    private player?: Player;
    private playerRangeIndicator?: Phaser.GameObjects.Arc;
    private piranhasBarPrompt?: Phaser.GameObjects.Text;
    private stairClimbEffect?: StairClimbEffect;
    private drones: Drone[] = [];
    private droneBodies?: Phaser.Physics.Arcade.Group;
    private combat?: CombatSystem;
    private waves?: DroneWaves;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private isGameOver = false;
    private isPauseMenuOpen = false;
    private isWaveIntermissionOpen = false;
    private isPiranhasMenuOpen = false;
    private hasSelectedPiranhasItem = false;
    private isGameplayReady = false;
    private nauseaEndsAt = 0;
    private normalCameraZoom = WORLD_CONFIG.camera.zoom;
    private droneSpawnPoints: readonly DroneSpawnPoint[] = COMBAT_CONFIG.droneSpawns;
    private readonly upgrades = new PlayerUpgradeState();

    constructor() {
        super('World');
    }

    create(data: { waitForReveal?: boolean } = {}) {
        this.isPauseMenuOpen = false;
        this.isWaveIntermissionOpen = false;
        this.isPiranhasMenuOpen = false;
        this.hasSelectedPiranhasItem = false;
        this.isGameOver = false;
        this.isGameplayReady = false;
        this.nauseaEndsAt = 0;
        this.upgrades.reset();
        this.physics.pause();
        const roomKey = getRequestedRoomKey();
        const room = createRoom(this, roomKey);
        if (!room) return;

        this.droneSpawnPoints = roomKey === 'room2'
            ? createReachableDroneSpawns(
                room.map,
                (tileX, tileY) => room.collisionLayers.some((layer) =>
                    layer.getTileAt(tileX, tileY)?.collides ?? false),
                WORLD_CONFIG.player.spawn,
                (tileX, tileY) => ROOM2_WALKABLE_LAYERS.some((layerName) =>
                    room.map.hasTileAt(tileX, tileY, layerName))
            )
            : COMBAT_CONFIG.droneSpawns;

        this.player = new Player(this, WORLD_CONFIG.player.spawn);
        if (roomKey === 'room2') this.createPiranhasBarPrompt();
        this.stairClimbEffect = room.stairPassage
            ? new StairClimbEffect(this, this.player.sprite, room.stairPassage)
            : undefined;
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
        this.normalCameraZoom = this.cameras.main.zoom;
        this.input.keyboard?.on('keydown-P', this.openPauseMenu, this);
        this.input.keyboard?.on('keydown-G', this.openPiranhasMenu, this);
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
        this.updatePiranhasBarInteraction();
        this.updateNauseaEffect();
        if (this.isPiranhasMenuOpen) return;
        this.player?.update(delta);
        this.stairClimbEffect?.update();
        for (const drone of this.drones) drone.update(this.player);
        this.combat?.update(delta);
        this.waves?.update(this.drones);
    }

    private spawnDrones(count: number) {
        if (!this.player || !this.combat) return;
        const spawns = selectDroneSpawns(count, this.player.sprite, this.droneSpawnPoints);
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
        this.isWaveIntermissionOpen = true;
        this.piranhasBarPrompt?.setVisible(false);
        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(overlayScene, drawUpgradeCards(undefined, this.upgrades.availableCards())).play((selected) => {
            this.acquireUpgrade(selected);
            new WaveThreatView(overlayScene, this.cameras.main).play(() => {
                this.isWaveIntermissionOpen = false;
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

    private createPiranhasBarPrompt() {
        const { x, y } = PIRANHAS_BAR_CONFIG.prompt;
        this.piranhasBarPrompt = this.add.text(x, y, '[ G ]  CARDÁPIO', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '8px',
            color: '#ffffff',
            backgroundColor: '#07131fe6',
            padding: { x: 5, y: 3 }
        }).setOrigin(0.5).setDepth(40).setVisible(false);
    }

    private updatePiranhasBarInteraction() {
        if (!this.player || !this.piranhasBarPrompt) return;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        const canInteract = !this.hasSelectedPiranhasItem
            && !this.isPiranhasMenuOpen
            && !this.isWaveIntermissionOpen
            && isInsidePiranhasBarArea(center.x, center.y);
        this.piranhasBarPrompt.setVisible(canInteract);
    }

    private openPiranhasMenu() {
        if (
            !this.player || !this.piranhasBarPrompt?.visible
            || !this.isGameplayReady || this.isGameOver
            || this.isPauseMenuOpen || this.isWaveIntermissionOpen
            || this.hasSelectedPiranhasItem || this.isPiranhasMenuOpen
        ) return;

        this.isPiranhasMenuOpen = true;
        this.piranhasBarPrompt.setVisible(false);
        this.player.stopMovement();
        this.physics.pause();

        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(overlayScene, PIRANHAS_BAR_ITEMS, {
            title: 'CARDÁPIO DO PIRANHAS BAR',
            hint: 'Escolha um item para consumir',
            footer: 'CLIQUE PARA CONSUMIR',
            cardCenterDistance: 220
        }).play((item) => this.consumePiranhasItem(item));
    }

    private consumePiranhasItem(item: PiranhasBarItem) {
        if (!this.player) return;

        switch (item.id) {
            case 'gin-tropical':
                this.player.setMovementSpeedMultiplier(PIRANHAS_BAR_CONFIG.tropicalSpeedMultiplier);
                break;
            case 'gin-melancia':
                this.player.health.increaseMax(
                    PIRANHAS_BAR_CONFIG.watermelonHealthIncrease,
                    PIRANHAS_BAR_CONFIG.watermelonHealthIncrease
                );
                break;
            case 'cookie-magico':
                this.nauseaEndsAt = this.time.now + PIRANHAS_BAR_CONFIG.nauseaDuration;
                this.player.setControlsInverted(true);
                break;
        }

        this.hasSelectedPiranhasItem = true;
        this.isPiranhasMenuOpen = false;
        if (this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen) this.physics.resume();
    }

    private updateNauseaEffect() {
        if (!this.player || this.nauseaEndsAt === 0) return;
        if (this.time.now >= this.nauseaEndsAt) {
            this.nauseaEndsAt = 0;
            this.player.setControlsInverted(false);
            this.cameras.main.setRotation(0).setZoom(this.normalCameraZoom);
            return;
        }

        const elapsed = PIRANHAS_BAR_CONFIG.nauseaDuration - (this.nauseaEndsAt - this.time.now);
        this.cameras.main
            .setRotation(Math.sin(elapsed / 260) * PIRANHAS_BAR_CONFIG.nauseaRotation)
            .setZoom(this.normalCameraZoom * (
                1 + Math.sin(elapsed / 190) * PIRANHAS_BAR_CONFIG.nauseaZoom
            ));
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
        this.isPiranhasMenuOpen = false;
        this.isWaveIntermissionOpen = false;
        this.scene.stop('CombatHud');
        this.combat?.clear();
        this.combat = undefined;
        this.waves = undefined;
        this.upgrades.reset();
        this.collisionLayers = [];
        this.drones = [];
        this.droneBodies = undefined;
        this.droneSpawnPoints = COMBAT_CONFIG.droneSpawns;
        this.stairClimbEffect?.destroy();
        this.stairClimbEffect = undefined;
        this.player?.setControlsInverted(false);
        this.cameras.main.setRotation(0).setZoom(this.normalCameraZoom);
        this.piranhasBarPrompt = undefined;
        this.player = undefined;
        this.playerRangeIndicator = undefined;
        this.input.keyboard?.off('keydown-P', this.openPauseMenu, this);
        this.input.keyboard?.off('keydown-G', this.openPiranhasMenu, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
    }

    private openPauseMenu() {
        if (
            !this.isGameplayReady || this.isPauseMenuOpen || this.isPiranhasMenuOpen
            || this.isWaveIntermissionOpen || !this.player?.health.isAlive
        ) return;

        this.isPauseMenuOpen = true;
        this.scene.launch('PauseMenu');
        this.scene.bringToTop('PauseMenu');
        this.scene.pause('World');
    }

    private resetPauseMenuState() {
        this.isPauseMenuOpen = false;
    }
}
