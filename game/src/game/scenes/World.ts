import { Scene } from 'phaser';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import { COMBAT_CONFIG, ROOM2_STAIR_GUARD_SPAWNS } from '../config/combat';
import { WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Player } from '../entities/Player';
import { createRoom } from '../map/createRoom';
import { CombatSystem } from '../combat/CombatSystem';
import {
    createReachableDroneSpawns,
    DroneWaves,
    selectDroneSpawns,
    selectDroneSpawnsWithPriority,
    type DroneSpawnPoint
} from '../combat/DroneWaves';
import { WaveThreatView } from '../ui/WaveThreatView';
import { UpgradeSelectionView } from '../ui/UpgradeSelectionView';
import { drawUpgradeCards } from '../upgrades/drawUpgradeCards';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeCardDefinition } from '../upgrades/types';
import { RemotePlayer } from '../entities/RemotePlayer';
import { multiplayerClient } from '../network/MultiplayerClient';
import type { ServerMessage } from '../network/protocol';
import {
    getRequestedRoomKey,
    replaceRequestedRoomKey,
    ROOM_DEFINITIONS,
    type RoomKey
} from '../config/rooms';
import { StairClimbEffect } from '../map/StairClimbEffect';
import {
    isInsidePiranhasBarArea,
    PIRANHAS_BAR_CONFIG,
    PIRANHAS_BAR_ITEMS,
    type PiranhasBarItem
} from '../config/piranhasBar';
import {
    DUNGEON_RETURN_SPAWN,
    isInsideRoomGateway,
    isTouchingDungeonReturn,
    isTouchingSecretDungeonEntrance,
    ROOM1_TO_ROOM2_GATEWAY,
    ROOM2_TO_DUNGEON_GATEWAY
} from '../config/roomGateway';
import { RoomExitPortal } from '../map/RoomExitPortal';
import { ROOM1_CLEAR_CODE, SecretCodeMatcher } from '../config/secretCodes';
import {
    capturePlayerProgress,
    restorePlayerProgress,
    type PlayerProgress
} from '../progress/PlayerProgress';
import {
    clearCampaignProgress,
    loadCampaignProgress,
    saveCampaignProgress
} from '../progress/CampaignProgress';
import { runTracker } from '../scoring/RunTracker';
import {
    createDungeonSessionState,
    DUNGEON_WAVE_ENEMY_COUNT,
    type DungeonEnemyState,
    type DungeonSessionState
} from '../config/dungeon';
import { createLampLight } from '../map/createLampLights';

const ROOM2_WALKABLE_LAYERS = [
    'floor',
    'stairs',
    'street',
    'new-street',
    'floor-terminal'
] as const;
const GAMEPLAY_OVERLAY_SCENES = [
    'PauseMenu',
    'RoomTransition',
    'ReturnToMenuTransition',
    'CombatHud'
] as const;

type WorldSceneData = {
    waitForReveal?: boolean;
    roomKey?: RoomKey;
    spawn?: Readonly<{ x: number; y: number }>;
    playerProgress?: PlayerProgress;
    dungeonState?: DungeonSessionState;
};

export function isRoom2WalkableLayer(layerName: string) {
    const localName = layerName.split('/').pop();
    return ROOM2_WALKABLE_LAYERS.some((name) => name === localName);
}

export class World extends Scene {
    private player?: Player;
    private playerRangeIndicator?: Phaser.GameObjects.Arc;
    private piranhasBarPrompt?: Phaser.GameObjects.Text;
    private stairClimbEffect?: StairClimbEffect;
    private roomExitPortal?: RoomExitPortal;
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
    private isRoomExitOpen = false;
    private isRoomTransitioning = false;
    private hasSpawnedRoom2Guards = false;
    private isRoomCombatComplete = false;
    private nauseaEndsAt = 0;
    private normalCameraZoom: number = WORLD_CONFIG.camera.zoom;
    private activeRoomKey: RoomKey = 'room1';
    private activeSpawn: Readonly<{ x: number; y: number }> = ROOM_DEFINITIONS.room1.spawn;
    private droneSpawnPoints: readonly DroneSpawnPoint[] = COMBAT_CONFIG.droneSpawns;
    private readonly upgrades = new PlayerUpgradeState();
    private readonly remotePlayers = new Map<string, RemotePlayer>();
    private unsubscribeMultiplayer?: () => void;
    private unsubscribeRunTracker?: () => void;
    private multiplayerSyncElapsed = 0;
    private readonly room1SecretCode = new SecretCodeMatcher(ROOM1_CLEAR_CODE);
    private completeRoomCombat?: () => void;
    private dungeonReturnArea?: Readonly<{ left: number; right: number; top: number; bottom: number }>;
    private dungeonState?: DungeonSessionState;
    private savedEnemies?: readonly DungeonEnemyState[];

    constructor() {
        super('World');
    }

    create(data: WorldSceneData = {}) {
        this.isPauseMenuOpen = false;
        this.isWaveIntermissionOpen = false;
        this.isPiranhasMenuOpen = false;
        this.isGameOver = false;
        this.isGameplayReady = false;
        this.isRoomExitOpen = false;
        this.isRoomTransitioning = false;
        this.hasSpawnedRoom2Guards = false;
        this.isRoomCombatComplete = false;
        this.room1SecretCode.reset();
        this.nauseaEndsAt = 0;
        this.multiplayerSyncElapsed = 0;
        this.upgrades.reset();
        this.physics.pause();
        const roomKey = data.roomKey ?? getRequestedRoomKey();
        const spawn = data.spawn ?? ROOM_DEFINITIONS[roomKey].spawn;
        this.activeRoomKey = roomKey;
        this.activeSpawn = spawn;
        this.dungeonState = data.dungeonState;
        if (roomKey === 'dungeon' && !this.dungeonState) {
            this.dungeonState = createDungeonSessionState();
        }
        this.hasSelectedPiranhasItem = this.dungeonState?.piranhasItemConsumed ?? false;
        const savedCombat = this.dungeonState?.savedCombat[roomKey];
        this.savedEnemies = savedCombat?.enemies;
        const room = createRoom(this, roomKey, this.dungeonState?.seed);
        if (!room) return;
        this.dungeonReturnArea = room.dungeon?.returnArea;
        const walkableRoom2Layers = room.map.layers.filter((layer) =>
            isRoom2WalkableLayer(layer.name));

        this.droneSpawnPoints = roomKey !== 'room1'
            ? createReachableDroneSpawns(
                room.map,
                (tileX, tileY) => room.collisionLayers.some((layer) =>
                    layer.getTileAt(tileX, tileY)?.collides ?? false),
                spawn,
                roomKey === 'room2'
                    ? (tileX, tileY) => walkableRoom2Layers.some((layer) =>
                        room.map.hasTileAt(tileX, tileY, layer.name))
                    : () => true
            )
            : COMBAT_CONFIG.droneSpawns;

        const mode = this.isMultiplayerEnabled() ? 'MULTIPLAYER' : 'SINGLE_PLAYER';
        runTracker.ensureRunning(mode);
        this.player = new Player(
            this,
            this.getPlayerSpawn(spawn),
            (healthLost) => runTracker.recordPlayerHit(healthLost)
        );
        if (data.playerProgress) {
            restorePlayerProgress(
                data.playerProgress,
                this.player.health,
                (multiplier) => this.player?.setMovementSpeedMultiplier(multiplier),
                this.upgrades
            );
        }
        this.unsubscribeRunTracker = runTracker.subscribe((snapshot) => {
            if (snapshot.status !== 'RUNNING') {
                if (!this.isMultiplayerEnabled()) clearCampaignProgress();
                return;
            }
            this.persistContinuationCheckpoint();
        });
        if (roomKey === 'room2') this.createPiranhasBarPrompt();
        if (roomKey === 'room2') this.createSecretEntranceHint();
        this.stairClimbEffect = room.stairPassage
            ? new StairClimbEffect(this, this.player.sprite, room.stairPassage)
            : undefined;
        this.setupMultiplayer();
        this.createPlayerRangeIndicator();
        this.drones = [];
        this.droneBodies = this.createDroneBodies();
        this.collisionLayers = room.collisionLayers;

        for (const layer of room.collisionLayers) {
            this.physics.add.collider(this.player.sprite, layer);
        }
        this.combat = new CombatSystem(this, this.player, this.drones, room.collisionLayers, this.upgrades);
        this.completeRoomCombat = () => {
            if (this.isRoomCombatComplete) return;
            this.isRoomCombatComplete = true;
            this.waves = undefined;
            if (this.player) this.upgrades.repairAfterRoom(this.player.health);
            room.openExit();
            this.player?.clearBlockedDirection();
            if (roomKey === ROOM1_TO_ROOM2_GATEWAY.from) this.activateRoomExit();
            if (roomKey === 'dungeon') this.playDungeonReward();
            if (roomKey === 'room2') {
                this.isGameOver = true;
                this.combat?.clear();
                this.physics.pause();
                void runTracker.win();
            }
        };
        // Ao voltar, os drones vivos formam a primeira onda; uma sala já limpa não tem combate.
        const waveCounts = savedCombat
            ? [savedCombat.enemies.length, ...savedCombat.pendingWaves]
            : roomKey === 'dungeon' ? [DUNGEON_WAVE_ENEMY_COUNT] : COMBAT_CONFIG.waves;
        this.waves = waveCounts.some((count) => count > 0)
            ? new DroneWaves(
                (count) => this.spawnDrones(count),
                () => {
                    this.completeRoomCombat?.();
                },
                (resume) => this.playWaveIntermission(resume),
                waveCounts
            )
            : undefined;
        this.waves?.update(this.drones);

        configureWorldCamera(this, room.map, this.player.sprite);
        this.normalCameraZoom = this.cameras.main.zoom;
        this.input.keyboard?.on('keydown-P', this.openPauseMenu, this);
        this.input.keyboard?.on('keydown-G', this.openPiranhasMenu, this);
        this.input.keyboard?.on('keydown', this.handleSecretCodeKey, this);
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
            onRestart: () => this.restartFromDefeatMenu(),
            onQuit: () => this.returnToMainMenuFromDefeat()
        });
    }

    /** Executado exclusivamente pelo botão "Tentar novamente" da tela de derrota. */
    private restartFromDefeatMenu() {
        clearCampaignProgress();
        runTracker.startNew(this.isMultiplayerEnabled() ? 'MULTIPLAYER' : 'SINGLE_PLAYER');
        this.stopGameplayOverlays();
        this.scene.restart({
            waitForReveal: false,
            roomKey: this.activeRoomKey,
            spawn: this.activeSpawn
        });
    }

    /** Encerra completamente a partida derrotada e volta para uma nova campanha. */
    private returnToMainMenuFromDefeat() {
        clearCampaignProgress();
        replaceRequestedRoomKey('room1');
        this.stopGameplayOverlays();
        this.scene.launch('ReturnToMenuTransition', { saveContinuation: false });
        this.scene.bringToTop('ReturnToMenuTransition');
    }

    private stopGameplayOverlays() {
        for (const sceneKey of GAMEPLAY_OVERLAY_SCENES) this.scene.stop(sceneKey);
    }

    update(_time: number, delta: number) {
        this.updatePlayerRangeIndicator();
        if (!this.isGameplayReady || this.isGameOver) return;
        if (this.player && !this.player.health.isAlive) {
            this.isGameOver = true;
            this.combat?.clear();
            this.physics.pause();
            runTracker.lose();
            return;
        }
        this.updatePiranhasBarInteraction();
        this.updateNauseaEffect();
        if (this.isPiranhasMenuOpen) return;
        this.player?.update(delta);
        this.updateMultiplayer(delta);
        this.updateRoomGateway();
        if (this.isRoomTransitioning) return;
        this.stairClimbEffect?.update();
        for (const drone of this.drones) drone.update(this.player);
        this.combat?.update(delta);
        this.waves?.update(this.drones);
    }

    private spawnDrones(count: number) {
        if (!this.player || !this.combat || this.isRoomCombatComplete) return;
        const shouldSpawnStairGuards = this.activeRoomKey === 'room2'
            && !this.hasSpawnedRoom2Guards;
        const spawns = this.savedEnemies ?? (shouldSpawnStairGuards
            ? selectDroneSpawnsWithPriority(
                count,
                this.player.sprite,
                ROOM2_STAIR_GUARD_SPAWNS.filter((prioritySpawn) =>
                    this.droneSpawnPoints.some((spawnPoint) =>
                        spawnPoint.x === prioritySpawn.x && spawnPoint.y === prioritySpawn.y)),
                this.droneSpawnPoints
            )
            : selectDroneSpawns(count, this.player.sprite, this.droneSpawnPoints));
        if (shouldSpawnStairGuards) this.hasSpawnedRoom2Guards = true;
        this.savedEnemies = undefined;
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

    private handleSecretCodeKey(event: KeyboardEvent) {
        if (
            event.repeat || this.activeRoomKey !== 'room1'
            || !this.isGameplayReady || this.isGameOver || this.isRoomCombatComplete
        ) return;
        if (!this.room1SecretCode.push(event.key)) return;

        this.combat?.clear();
        this.waves = undefined;
        for (const drone of this.drones) {
            if (drone.health.isAlive) drone.takeDamage(drone.health.current);
        }
        this.completeRoomCombat?.();
    }

    private createDroneBodies() {
        const group = this.physics.add.group();
        this.physics.add.collider(group, group);
        return group;
    }

    private activateRoomExit() {
        if (this.isRoomExitOpen || this.activeRoomKey !== ROOM1_TO_ROOM2_GATEWAY.from) return;
        this.isRoomExitOpen = true;
        const { x, y } = ROOM1_TO_ROOM2_GATEWAY.portal;
        this.roomExitPortal = new RoomExitPortal(this, x, y);
    }

    private updateRoomGateway() {
        if (!this.player || this.isRoomTransitioning) return;
        if (this.activeRoomKey === 'room1' && !this.isRoomExitOpen) return;
        const sprite = this.player.sprite;
        if (!sprite) return;
        const center = sprite.body?.center ?? sprite;
        const body = sprite.body;

        if (
            this.activeRoomKey === 'room2'
            && isTouchingSecretDungeonEntrance(
                center.x,
                center.y,
                body instanceof Phaser.Physics.Arcade.Body && body.blocked.right
            )
        ) {
            this.dungeonState ??= createDungeonSessionState();
            this.transitionToRoom(ROOM2_TO_DUNGEON_GATEWAY.to, {
                dungeonState: this.dungeonState
            });
            return;
        }
        if (
            this.activeRoomKey === 'dungeon' && this.dungeonReturnArea
            && isTouchingDungeonReturn(
                center.x,
                center.y,
                body instanceof Phaser.Physics.Arcade.Body && body.blocked.left,
                this.dungeonReturnArea
            )
        ) {
            this.transitionToRoom('room2', {
                spawn: DUNGEON_RETURN_SPAWN,
                dungeonState: this.dungeonState
            });
            return;
        }
        if (
            this.activeRoomKey !== ROOM1_TO_ROOM2_GATEWAY.from
            || !this.isRoomExitOpen
            || !isInsideRoomGateway(center.x, center.y)
        ) return;

        this.transitionToRoom(ROOM1_TO_ROOM2_GATEWAY.to);
    }

    private transitionToRoom(
        roomKey: RoomKey,
        options: {
            spawn?: Readonly<{ x: number; y: number }>;
            dungeonState?: DungeonSessionState;
        } = {}
    ) {
        if (!this.player || this.isRoomTransitioning) return;

        this.rememberCombatProgress();
        this.isRoomTransitioning = true;
        this.player.stopMovement();
        this.combat?.clear();
        this.physics.pause();
        const playerProgress = capturePlayerProgress(this.player, this.upgrades);
        if (!this.isMultiplayerEnabled()) {
            // O checkpoint oficial continua sendo a fase 2; a dungeon é uma rota secreta.
            saveCampaignProgress({ roomKey: 'room2', playerProgress, run: runTracker.checkpoint() });
        }
        this.scene.launch('RoomTransition', {
            roomKey,
            source: 'world',
            playerProgress,
            ...options
        });
        this.scene.bringToTop('RoomTransition');
    }

    /** Guarda drones vivos e ondas restantes para retomar a sala na próxima visita. */
    private rememberCombatProgress() {
        if (!this.dungeonState) return;
        const enemies = this.drones.flatMap((drone) => {
            if (!drone.health.isAlive) return [];
            return [{
                x: drone.sprite.x,
                y: drone.sprite.y,
                health: drone.health.current,
                patrolLeft: drone.sprite.x - 16,
                patrolRight: drone.sprite.x + 16
            }];
        });
        this.dungeonState.piranhasItemConsumed = this.hasSelectedPiranhasItem;
        this.dungeonState.savedCombat[this.activeRoomKey] = {
            enemies,
            pendingWaves: this.waves?.pendingWaves() ?? []
        };
    }

    /** Uma fissura discreta indica a parede correta sem transformar a entrada em portal visível. */
    private createSecretEntranceHint() {
        const { portal } = ROOM2_TO_DUNGEON_GATEWAY;
        createLampLight(this, portal.x - 4, portal.y, 18, 0.07).setScale(0.52);
        const glow = this.add.rectangle(portal.x, portal.y, 2, 19, 0x54d8df, 0.14)
            .setDepth(19);
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.08, to: 0.2 },
            duration: 1450,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut'
        });
    }

    /** Atualiza um checkpoint já desbloqueado sem liberar salas por acesso direto. */
    saveContinuation() {
        if (this.isMultiplayerEnabled() || !this.player || !loadCampaignProgress()) return false;
        this.combat?.clear();
        this.persistContinuationCheckpoint();
        return true;
    }

    /** Mantém estatísticas, vida e build alinhadas no mesmo checkpoint local. */
    private persistContinuationCheckpoint() {
        if (
            this.isMultiplayerEnabled() || !this.player
            || this.activeRoomKey !== 'room2' || !loadCampaignProgress()
        ) return;
        saveCampaignProgress({
            roomKey: this.activeRoomKey,
            playerProgress: capturePlayerProgress(this.player, this.upgrades),
            run: runTracker.checkpoint()
        });
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

    /** Entrega uma única carta ao limpar a única onda da dungeon. */
    private playDungeonReward() {
        if (!this.player || !this.dungeonState || this.dungeonState.rewardClaimed) return;
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;

        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(
            overlayScene,
            drawUpgradeCards(undefined, this.upgrades.availableCards()),
            {
                title: 'DUNGEON CONCLUÍDA',
                hint: 'Escolha sua recompensa',
                footer: 'CLIQUE PARA RECEBER'
            }
        ).play((selected) => {
            this.acquireUpgrade(selected);
            if (this.dungeonState) this.dungeonState.rewardClaimed = true;
            this.isWaveIntermissionOpen = false;
            if (this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen) {
                this.physics.resume();
            }
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
        }).setOrigin(0.5).setDepth(9).setVisible(false);
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
        this.isRoomExitOpen = false;
        this.isRoomTransitioning = false;
        this.hasSpawnedRoom2Guards = false;
        this.isRoomCombatComplete = false;
        this.room1SecretCode.reset();
        this.scene.stop('CombatHud');
        this.combat?.clear();
        this.combat = undefined;
        this.waves = undefined;
        this.completeRoomCombat = undefined;
        this.upgrades.reset();
        this.collisionLayers = [];
        this.drones = [];
        this.droneBodies = undefined;
        this.droneSpawnPoints = COMBAT_CONFIG.droneSpawns;
        this.dungeonReturnArea = undefined;
        this.dungeonState = undefined;
        this.savedEnemies = undefined;
        this.stairClimbEffect?.destroy();
        this.stairClimbEffect = undefined;
        this.roomExitPortal?.destroy();
        this.roomExitPortal = undefined;
        this.player?.setControlsInverted(false);
        // No SHUTDOWN o Phaser pode remover a câmera antes de notificar a cena.
        // A limpeza não pode interromper a fila de restart/start do SceneManager.
        this.cameras.main?.setRotation(0).setZoom(this.normalCameraZoom);
        this.piranhasBarPrompt = undefined;
        this.player = undefined;
        this.playerRangeIndicator = undefined;
        this.unsubscribeMultiplayer?.();
        this.unsubscribeMultiplayer = undefined;
        this.unsubscribeRunTracker?.();
        this.unsubscribeRunTracker = undefined;
        for (const remotePlayer of this.remotePlayers.values()) remotePlayer.destroy();
        this.remotePlayers.clear();
        this.multiplayerSyncElapsed = 0;
        this.input.keyboard?.off('keydown-P', this.openPauseMenu, this);
        this.input.keyboard?.off('keydown-G', this.openPiranhasMenu, this);
        this.input.keyboard?.off('keydown', this.handleSecretCodeKey, this);
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

    private getPlayerSpawn(base = this.activeSpawn) {
        if (!this.isMultiplayerEnabled()) return base;
        const playerIndex = multiplayerClient.match?.players.indexOf(multiplayerClient.playerId ?? '') ?? 0;
        return { x: base.x + Math.max(0, playerIndex) * 36, y: base.y };
    }

    private setupMultiplayer() {
        if (!this.isMultiplayerEnabled()) return;
        const localId = multiplayerClient.playerId;
        for (const [index, playerId] of (multiplayerClient.match?.players ?? []).entries()) {
            if (playerId === localId) continue;
            const spawn = this.activeSpawn;
            this.remotePlayers.set(playerId, new RemotePlayer(this, spawn.x + index * 36, spawn.y));
        }
        this.unsubscribeMultiplayer = multiplayerClient.subscribe((message) => this.handleMultiplayerMessage(message));
    }

    private updateMultiplayer(delta: number) {
        for (const remotePlayer of this.remotePlayers.values()) remotePlayer.update();
        if (!this.isMultiplayerEnabled() || !this.player) return;
        this.multiplayerSyncElapsed += delta;
        if (this.multiplayerSyncElapsed < 50) return;
        this.multiplayerSyncElapsed = 0;
        const state = this.player.getNetworkState();
        multiplayerClient.sendPlayerState(state.x, state.y, state.facing);
    }

    private handleMultiplayerMessage(message: ServerMessage) {
        if (message.type === 'player.state') {
            this.remotePlayers.get(message.playerId)?.applyState(
                message.sequence,
                message.x,
                message.y,
                message.facing
            );
        }
        if (message.type === 'player.left') {
            this.remotePlayers.get(message.playerId)?.destroy();
            this.remotePlayers.delete(message.playerId);
        }
    }

    private isMultiplayerEnabled() {
        return Boolean(this.registry?.get('multiplayerEnabled'));
    }
}
