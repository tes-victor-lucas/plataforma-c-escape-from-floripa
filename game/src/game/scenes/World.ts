import { loadCharacterId, type CharacterId } from '../config/characters';
import { Scene } from 'phaser';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import {
    COMBAT_CONFIG,
    getWaveEnemyKinds,
    ROOM2_STAIR_GUARD_SPAWNS,
    type EnemyKind
} from '../config/combat';
import { getActorDepth, WORLD_CONFIG } from '../config/world';
import { Drone } from '../entities/Drone';
import { Patinete } from '../entities/Patinete';
import { GuardaCyber } from '../entities/GuardaCyber';
import { Gaucho } from '../entities/Gaucho';
import type { CombatEnemy, EnemySpawn } from '../entities/CombatEnemy';
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
import { FlowField } from '../combat/FlowField';
import { UpgradeSelectionView } from '../ui/UpgradeSelectionView';
import {
    basicUpgradeCards,
    drawUpgradeCards,
    drawUpgradeCardsFeaturing,
    withoutRoom3Cards
} from '../upgrades/drawUpgradeCards';
import { AREA_UPGRADE_IDS, ROOM3_UPGRADE_IDS } from '../upgrades/catalog';
import { PlayerUpgradeState } from '../upgrades/PlayerUpgradeState';
import type { UpgradeCardDefinition } from '../upgrades/types';
import { drawPlayerBar, RemotePlayer } from '../entities/RemotePlayer';
import {
    advanceRevive,
    applyEnemySnapshotHealth,
    CardBarrier,
    createEnemySnapshotRow,
    isWithinReviveRadius,
    nearestLivingTarget,
    type CoopTarget
} from '../network/coop';
import { multiplayerClient } from '../network/MultiplayerClient';
import type { CoopEvent, EnemySnapshotRow, ServerMessage } from '../network/protocol';
import { playDamageNumber } from '../effects/playDamageNumber';
import { playSwordHit } from '../effects/playSwordHit';
import {
    getRequestedRoomKey,
    replaceRequestedRoomKey,
    isDungeonRoom,
    isTicenRoom,
    ROOM_DEFINITIONS,
    type RoomKey
} from '../config/rooms';
import { StairClimbEffect } from '../map/StairClimbEffect';
import { arcadeAttemptsLeft, canStartArcade } from '../minigame/arcadeAttempts';
import type { ArcadeMinigameData } from './ArcadeMinigame';
import type { ConfirmPromptData } from './ConfirmPrompt';
import type { WalletMenuData } from './WalletMenu';
import { TICEN_GATE, TICEN_GOAL, TICEN_PARKED, TICEN_SITTERS } from '../config/ticen';
import { MercadoNpcs } from '../entities/MercadoNpcs';
import { TchayQueue } from '../entities/TchayQueue';
import { PAGODE, PAGODE_FRAMES, POPULAR_BARS, TCHAY } from '../config/tchay';
import { createStringLights } from '../map/createStringLights';
import { createRadioactiveFlowers } from '../map/createRadioactiveFlowers';
import { MERCADO_INTERIOR, MERCADO_NPCS } from '../config/mercado';
import {
    isInsidePiranhasBarArea,
    PIRANHAS_BAR_CONFIG,
    PIRANHAS_BAR_ITEMS,
    type PiranhasBarItem
} from '../config/piranhasBar';
import {
    isInsideRoomGateway,
    isTouchingDungeonReturn,
    isTouchingSecretDungeonEntrance,
    ROOM_EXIT_GATEWAYS,
    SECRET_DUNGEON_GATEWAYS,
    type SecretDungeonGateway
} from '../config/roomGateway';
import { RoomExitPortal } from '../map/RoomExitPortal';
import { ROOM3_CARD_CODE, ROOM_CLEAR_CODE, SecretCodeMatcher } from '../config/secretCodes';
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
import { getGamepadInput } from '../input/GamepadInput';
import { isTouchScreen, touchInput } from '../input/TouchInput';

const ROOM2_WALKABLE_LAYERS = [
    'floor',
    'stairs',
    'street',
    'new-street',
    'floor-terminal'
] as const;
const GAMEPLAY_OVERLAY_SCENES = [
    'PauseMenu',
    'ArcadeMinigame',
    'ConfirmPrompt',
    'WalletMenu',
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

export function shouldOfferRoomCompletionUpgrade(roomKey: RoomKey) {
    return roomKey === 'room1';
}

export function recordRoomCompletionScore(roomKey: RoomKey) {
    if (!isDungeonRoom(roomKey)) return false;
    return runTracker.recordDungeonCompletion(roomKey);
}

export class World extends Scene {
    private player?: Player;
    private playerRangeIndicator?: Phaser.GameObjects.Arc;
    private piranhasBarPrompt?: Phaser.GameObjects.Text;
    private stairClimbEffect?: StairClimbEffect;
    private mercadoNpcs?: MercadoNpcs;
    private barQueues: TchayQueue[] = [];
    private roomExitPortal?: RoomExitPortal;
    private drones: CombatEnemy[] = [];
    private droneBodies?: Phaser.Physics.Arcade.Group;
    private combat?: CombatSystem;
    private waves?: DroneWaves;
    private collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private isGameOver = false;
    private isPauseMenuOpen = false;
    private isWaveIntermissionOpen = false;
    private isPiranhasMenuOpen = false;
    private isArcadeOpen = false;
    private isWalletOpen = false;
    private isTicenGateArmed = true;
    private isTicenGateOpen = false;
    private ticenGate?: Phaser.GameObjects.Sprite;
    private ticenGateHint?: Phaser.GameObjects.Text;
    private isArcadeArmed = true;
    private isGatewayConfirmOpen = false;
    private isGatewayConfirmArmed = true;
    private arcadePrompt?: Phaser.GameObjects.Text;
    private hasSelectedPiranhasItem = false;
    private isGameplayReady = false;
    private isRoomExitOpen = false;
    private isRoomTransitioning = false;
    private hasSpawnedRoom2Guards = false;
    private waveIndex = 0;
    private currentWaveIndex = 0;
    private waveSpawned = 0;
    private hordeRecallElapsed = 0;
    private flowField?: FlowField;
    private readonly hordeLastPositions = new Map<CombatEnemy, { x: number; y: number }>();
    private isRoomCombatComplete = false;
    private nauseaEndsAt = 0;
    private chimarraoBuffTimer?: Phaser.Time.TimerEvent;
    private normalCameraZoom: number = WORLD_CONFIG.camera.zoom;
    private activeRoomKey: RoomKey = 'room1';
    private activeSpawn: Readonly<{ x: number; y: number }> = ROOM_DEFINITIONS.room1.spawn;
    private droneSpawnPoints: readonly DroneSpawnPoint[] = COMBAT_CONFIG.droneSpawns;
    private readonly upgrades = new PlayerUpgradeState();
    private readonly remotePlayers = new Map<string, RemotePlayer>();
    private readonly droppedItems = new Map<number, () => void>();
    private droppedItemSequence = 0;
    private swordHint?: Phaser.GameObjects.Text;
    private characterId: CharacterId = 'padrao';
    private unsubscribeMultiplayer?: () => void;
    private unsubscribeRunTracker?: () => void;
    private multiplayerSyncElapsed = 0;
    private reviveElapsed = 0;
    private reviveBar?: Phaser.GameObjects.Graphics;
    private enemySnapshot: readonly EnemySnapshotRow[] = [];
    private readonly cardBarrier = new CardBarrier();
    /** Convidado aguardando o anfitrião liberar as cartas. */
    private cardRelease?: () => void;
    private isRoomRequestPending = false;
    private readonly roomClearCode = new SecretCodeMatcher(ROOM_CLEAR_CODE);
    private readonly room3CardCode = new SecretCodeMatcher(ROOM3_CARD_CODE);
    private completeRoomCombat?: () => void;
    private dungeonReturnArea?: Readonly<{ left: number; right: number; top: number; bottom: number }>;
    private dungeonState?: DungeonSessionState;
    private savedEnemies?: readonly DungeonEnemyState[];
    private isHitStopActive = false;
    private hitStopTimer?: Phaser.Time.TimerEvent;
    private lowHealthFilter?: Phaser.Filters.ColorMatrix;
    private lowHealthDesaturation = -1;
    private gamepad?: ReturnType<typeof getGamepadInput>;

    constructor() {
        super('World');
    }

    create(data: WorldSceneData = {}) {
        this.isPauseMenuOpen = false;
        this.isWaveIntermissionOpen = false;
        this.isPiranhasMenuOpen = false;
        this.isArcadeOpen = false;
        this.isWalletOpen = false;
        this.isTicenGateArmed = true;
        this.isTicenGateOpen = false;
        this.ticenGate = undefined;
        this.ticenGateHint = undefined;
        this.isArcadeArmed = true;
        this.arcadePrompt = undefined;
        this.isGatewayConfirmOpen = false;
        this.isGatewayConfirmArmed = true;
        this.isGameOver = false;
        this.isGameplayReady = false;
        this.isRoomExitOpen = false;
        this.isRoomTransitioning = false;
        this.hasSpawnedRoom2Guards = false;
        this.waveIndex = 0;
        this.currentWaveIndex = 0;
        this.waveSpawned = 0;
        this.hordeRecallElapsed = 0;
        this.hordeLastPositions.clear();
        this.isRoomCombatComplete = false;
        this.isHitStopActive = false;
        this.hitStopTimer = undefined;
        this.lowHealthFilter = undefined;
        this.lowHealthDesaturation = -1;
        this.roomClearCode.reset();
        this.room3CardCode.reset();
        this.nauseaEndsAt = 0;
        this.chimarraoBuffTimer = undefined;
        this.multiplayerSyncElapsed = 0;
        this.reviveElapsed = 0;
        this.enemySnapshot = [];
        this.cardBarrier.open();
        this.cardRelease = undefined;
        this.isRoomRequestPending = false;
        this.droppedItems.clear();
        this.droppedItemSequence = 0;
        this.swordHint = undefined;
        this.characterId = loadCharacterId();
        this.upgrades.reset();
        this.physics.pause();
        const roomKey = data.roomKey ?? getRequestedRoomKey();
        const spawn = data.spawn ?? ROOM_DEFINITIONS[roomKey].spawn;
        this.activeRoomKey = roomKey;
        this.activeSpawn = spawn;
        this.dungeonState = data.dungeonState;
        const isDungeon = isDungeonRoom(roomKey);
        if (isDungeon && !this.dungeonState) {
            this.dungeonState = createDungeonSessionState();
        }
        this.hasSelectedPiranhasItem = this.dungeonState?.piranhasItemConsumed ?? false;
        const savedCombat = this.dungeonState?.savedCombat[roomKey];
        this.savedEnemies = savedCombat?.enemies;
        const room = createRoom(this, roomKey, this.dungeonState?.seed);
        if (!room) return;
        this.dungeonReturnArea = room.dungeon?.returnArea
            ?? (roomKey === 'mercado-interior' ? MERCADO_INTERIOR.returnArea : undefined);
        const walkableRoom2Layers = room.map.layers.filter((layer) =>
            isRoom2WalkableLayer(layer.name));

        // Consulta pelo centro do tile no mundo para respeitar o offset em pixels das camadas do Tiled.
        const isBlockedTile = (tileX: number, tileY: number) => room.collisionLayers.some((layer) =>
            layer.getTileAtWorldXY(
                (tileX + 0.5) * room.map.tileWidth,
                (tileY + 0.5) * room.map.tileHeight
            )?.collides ?? false);
        const isWalkableTile = roomKey === 'room2' || roomKey === 'room3' || roomKey === 'room4' || isTicenRoom(roomKey)
            ? (tileX: number, tileY: number) => walkableRoom2Layers.some((layer) =>
                room.map.hasTileAt(tileX, tileY, layer.name))
            : () => true;
        this.droneSpawnPoints = roomKey !== 'room1'
            ? createReachableDroneSpawns(room.map, isBlockedTile, spawn, isWalkableTile)
            : COMBAT_CONFIG.droneSpawns;
        // A horda contorna obstáculos seguindo um único campo de fluxo até o jogador.
        this.flowField = COMBAT_CONFIG.hordeByRoom[roomKey] && !this.isMultiplayerEnabled()
            ? new FlowField(
                room.map.width,
                room.map.height,
                room.map.tileWidth,
                (tileX, tileY) => isBlockedTile(tileX, tileY) || !isWalkableTile(tileX, tileY)
            )
            : undefined;

        const mode = this.isMultiplayerEnabled() ? 'MULTIPLAYER' : 'SINGLE_PLAYER';
        runTracker.ensureRunning(mode);
        this.player = new Player(
            this,
            this.getPlayerSpawn(spawn),
            (healthLost) => runTracker.recordPlayerHit(healthLost),
            this.characterId
        );
        this.gamepad = getGamepadInput(this);
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
        if (roomKey === 'mercado-interior') this.createArcadePrompt();
        if (isTicenRoom(roomKey)) this.createTicenGate(roomKey === 'room5' ? TICEN_GATE.originalTexture : TICEN_GATE.texture);
        const secretGateway = SECRET_DUNGEON_GATEWAYS.find((gateway) => gateway.from === roomKey);
        if (secretGateway) this.createSecretEntranceHint(secretGateway);
        // Skatistas, comerciantes e o casal do Mercado Público; a horda espera a travessia.
        this.mercadoNpcs = roomKey === 'room4' ? new MercadoNpcs(this, !savedCombat) : undefined;
        // Sala I: rua dos bares com o TCHAY lotado e o varal de lâmpadas.
        this.barQueues = [];
        // Sala III: as flores dos canteiros da Praça XV estão contaminadas.
        if (roomKey === 'room3') createRadioactiveFlowers(this, room.map);
        if (roomKey === 'room1') {
            this.add.image(TCHAY.sign.x, TCHAY.sign.y, TCHAY.signTexture).setDepth(3);
            this.barQueues.push(new TchayQueue(this));
            createStringLights(this);
            // Barzinhos de esquina na calçada de baixo, cada um com sua fila.
            for (const bar of POPULAR_BARS.bars) {
                this.add.image(bar.x, bar.y, POPULAR_BARS.texture, bar.frame).setOrigin(0.5, 1).setDepth(getActorDepth(bar.y));
                this.addStaticBlock(bar.x, bar.y - 8, POPULAR_BARS.frameWidth - 4, 14);
                // Neon do letreiro pulsando devagar: o toque cyberpunk dos bares de verdade.
                const glow = this.add.graphics().setDepth(getActorDepth(bar.y) + 0.001).setBlendMode(1);
                glow.fillStyle(bar.glow.color, 0.12).fillCircle(bar.x + bar.glow.dx, bar.y + bar.glow.dy, bar.glow.radius);
                glow.fillStyle(bar.glow.color, 0.1).fillCircle(bar.x + bar.glow.dx, bar.y + bar.glow.dy, bar.glow.radius * 0.55);
                this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.35 }, duration: 1_100, yoyo: true, repeat: -1 });
                if ('queue' in bar) this.barQueues.push(new TchayQueue(this, bar.queue));
            }
            this.createPagode();
        }
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
        this.combat = new CombatSystem(
            this,
            this.player,
            this.drones,
            room.collisionLayers,
            this.upgrades,
            runTracker,
            () => this.playHitStop(),
            roomKey === 'gaucho-dungeon'
        );
        this.connectCombatToPartner();
        if (roomKey === 'gaucho-dungeon') {
            // Cada jogador tem a sua espada, então o item só existe para quem ainda não pegou.
            if (this.dungeonState?.swordCollected) this.equipSword();
            else this.createSwordPickup();
        }
        const finishRoomCombat = () => {
            if (this.isCoopActive() && this.player && !this.player.health.isAlive) this.revivePlayer();
            if (this.player?.health.isAlive) this.upgrades.repairAfterRoom(this.player.health);
            room.openExit();
            this.player?.clearBlockedDirection();
            this.activateRoomExit();
        };
        this.completeRoomCombat = () => {
            if (this.isRoomCombatComplete) return;
            this.isRoomCombatComplete = true;
            this.waves = undefined;
            recordRoomCompletionScore(roomKey);
            if (this.isMultiplayerHost()) {
                this.sendEnemySnapshot();
                multiplayerClient.sendEvent({
                    kind: 'combat.complete',
                    rewardClaimed: this.dungeonState?.rewardClaimed ?? false
                });
            }
            if (shouldOfferRoomCompletionUpgrade(roomKey)) {
                this.playRoom1CompletionReward(finishRoomCombat);
                return;
            }
            if (isDungeon) {
                this.playDungeonReward(finishRoomCombat);
                return;
            }
            finishRoomCombat();
        };
        // Ao voltar, os drones vivos formam a primeira onda; uma sala já limpa não tem combate.
        // Quem ainda não tinha nascido na horda volta junto com os sobreviventes.
        const waveCounts = savedCombat
            ? [savedCombat.enemies.length + (savedCombat.hordeRemaining ?? 0), ...savedCombat.pendingWaves]
            : isDungeon
                ? [DUNGEON_WAVE_ENEMY_COUNT]
                : COMBAT_CONFIG.wavesByRoom[roomKey];
        // Ao retomar, as ondas que restam usam a horda das últimas posições.
        const roomHordes = COMBAT_CONFIG.hordeByRoom[roomKey] ?? [];
        const hordes = roomHordes.slice(Math.max(0, roomHordes.length - waveCounts.length));
        // O convidado recebe ondas e inimigos prontos do anfitrião.
        // Uma sala salva sem inimigos e não vencida ainda precisa da onda vazia para concluir.
        this.waves = !this.isMultiplayerGuest() && !savedCombat?.cleared
            && (savedCombat !== undefined || waveCounts.some((count) => count > 0))
            ? new DroneWaves(
                (count, startsWave) => this.spawnDrones(count, startsWave),
                () => {
                    this.completeRoomCombat?.();
                },
                (resume) => this.playWaveIntermission(resume),
                waveCounts,
                hordes
            )
            : undefined;
        // O primeiro lote já precisa saber de onde existe caminho até o jogador.
        this.flowField?.update(this.player.sprite.body?.center ?? this.player.sprite);
        if (this.isPartnerRoomReady() && !this.mercadoNpcs?.isCrossing) this.waves?.update(this.drones);
        if (savedCombat?.cleared) {
            // Sala vencida numa visita anterior: reabre a saída sem repetir o reparo.
            this.isRoomCombatComplete = true;
            room.openExit();
            this.activateRoomExit();
        }

        configureWorldCamera(this, room.map, this.player.sprite);
        this.normalCameraZoom = this.cameras.main.zoom;
        this.lowHealthFilter = this.cameras.main.filters.internal.addColorMatrix();
        this.input.keyboard?.on('keydown-P', this.openPauseMenu, this);
        this.input.mouse?.disableContextMenu();
        this.input.on('pointerdown', this.handleSwordPointer, this);
        this.input.keyboard?.on('keydown-G', this.openPiranhasMenu, this);
        this.input.keyboard?.on('keydown', this.handleSecretCodeKey, this);
        this.events.on(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        if (this.isMultiplayerEnabled()) {
            multiplayerClient.sendEvent({ kind: 'world.ready', epoch: multiplayerClient.roomEpoch });
        }
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
            // Recomeçar sozinho deixaria o parceiro em outra partida: volta ao menu.
            onRestart: () => this.isMultiplayerEnabled()
                ? this.returnToMainMenuFromDefeat()
                : this.restartFromDefeatMenu(),
            onQuit: () => this.returnToMainMenuFromDefeat(),
            getDefeatTitle: () => this.mercadoNpcs?.hasRunOverPlayer ? MERCADO_NPCS.skaters.defeatTitle : undefined,
            getUseAction: () => !this.player?.health.isAlive ? undefined
                : this.combat?.hasSword() ? 'sword'
                : this.piranhasBarPrompt?.visible ? 'interact' : undefined,
            ...(this.isMultiplayerEnabled() ? { getCoopStatus: () => this.getCoopStatus() } : {})
        });
        if (this.activeRoomKey === 'gaucho-dungeon' && !this.isRoomCombatComplete) this.playGauchoDungeonWarning();
    }

    private playGauchoDungeonWarning() {
        const overlayScene = this.scene.get('CombatHud') as Scene;
        this.physics.pause();
        this.isWaveIntermissionOpen = true;
        // O CombatHud acabou de ser lançado; o aviso só pode ser desenhado depois do create dele.
        overlayScene.events.once(Phaser.Scenes.Events.CREATE, () => {
            new WaveThreatView(overlayScene, this.cameras.main, 'MATE OS GAUCHOS', false).play(() => {
                this.isWaveIntermissionOpen = false;
                if (!this.isGameOver && !this.isPauseMenuOpen) this.physics.resume();
            });
        });
    }

    /** Executado exclusivamente pelo botão "Tentar novamente" da tela de derrota. */
    private restartFromDefeatMenu() {
        clearCampaignProgress();
        runTracker.startNew(this.isMultiplayerEnabled() ? 'MULTIPLAYER' : 'SINGLE_PLAYER');
        replaceRequestedRoomKey('room1');
        this.stopGameplayOverlays();
        this.scene.restart({
            waitForReveal: false,
            roomKey: 'room1',
            spawn: ROOM_DEFINITIONS.room1.spawn
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

    update(time: number, delta: number) {
        this.gamepad?.update(time);
        if (this.gamepad?.justPressed('pause')) this.openPauseMenu();
        if (this.isPauseMenuOpen) return;
        this.updatePlayerRangeIndicator();
        if (this.player) this.swordHint?.setPosition(this.player.sprite.x, this.player.sprite.y - 26);
        this.updateLowHealthEffect();
        if (!this.isGameplayReady) return;
        // Continua mesmo no fim: o parceiro precisa saber que este jogador caiu.
        this.updateMultiplayer(delta);
        if (this.isGameOver) return;
        if (this.player && !this.player.health.isAlive && !this.canPartnerRevive()) {
            this.isGameOver = true;
            this.combat?.clear();
            this.physics.pause();
            runTracker.lose();
            return;
        }
        if (this.isHitStopActive) return;
        this.updatePiranhasBarInteraction();
        if (this.gamepad?.justPressed('interact') || touchInput.consume('interact')) {
            if (this.piranhasBarPrompt?.visible) this.openPiranhasMenu();
            else this.handleSwordGamepad();
        }
        this.updateNauseaEffect();
        if (
            this.isPiranhasMenuOpen || this.isWaveIntermissionOpen || this.isArcadeOpen
            || this.isGatewayConfirmOpen || this.isWalletOpen
        ) return;
        this.player?.update(delta);
        this.updateRevive(delta);
        this.updateRoomGateway();
        this.updateArcadeCabinet();
        this.updateTicenGate();
        this.updateTicenGoal();
        if (this.isRoomTransitioning) return;
        this.stairClimbEffect?.update();
        if (this.isMultiplayerGuest()) {
            this.updateEnemiesFromSnapshot();
        } else {
            for (const enemy of this.drones) {
                enemy.update(this.getEnemyTarget(enemy.sprite) as Player | undefined, delta);
            }
        }
        this.combat?.update(delta);
        if (this.flowField && this.player) this.flowField.update(this.player.sprite.body?.center ?? this.player.sprite);
        this.recallHordeStragglers(delta);
        this.mercadoNpcs?.update(delta, this.player, this.drones);
        for (const queue of this.barQueues) queue.update(delta);
        if (this.isPartnerRoomReady() && !this.mercadoNpcs?.isCrossing) this.waves?.update(this.drones, delta);
    }

    /**
     * Na horda, prefere pontos logo fora da tela, nem longe demais e com caminho de verdade
     * até o jogador: quem nasce num canto sem saída fica entalado.
     */
    private readonly isHordeSpawnPoint = (point: { x: number; y: number }) => {
        if (!COMBAT_CONFIG.hordeByRoom[this.activeRoomKey] || !this.player) return true;
        const target = this.player.sprite.body?.center ?? this.player.sprite;
        return Math.hypot(point.x - target.x, point.y - target.y) <= COMBAT_CONFIG.hordeSpawnMaxDistance
            && (this.flowField?.isReachable(point) ?? true);
    };

    private readonly followFlowField = (from: Readonly<{ x: number; y: number }>) => this.flowField?.directionFrom(from);

    /** Roda no anfitrião: quem ficou bem para trás ou sem saída reaparece fora da tela, mais perto. */
    private recallHordeStragglers(delta: number) {
        if (!COMBAT_CONFIG.hordeByRoom[this.activeRoomKey] || !this.player || this.isMultiplayerGuest()) return;
        this.hordeRecallElapsed += delta;
        const { interval, distance, stuckDistance, nearDistance } = COMBAT_CONFIG.hordeRecall;
        if (this.hordeRecallElapsed < interval) return;
        this.hordeRecallElapsed = 0;
        const target = this.player.sprite.body?.center ?? this.player.sprite;
        // Poucos por vez: a volta é gradual e nunca pede mais pontos do que o mapa tem.
        const lost = this.drones.filter((enemy) => {
            if (!enemy.health.isAlive) return false;
            const center = enemy.sprite.body?.center ?? enemy.sprite;
            const previous = this.hordeLastPositions.get(enemy);
            this.hordeLastPositions.set(enemy, { x: center.x, y: center.y });
            const fromPlayer = Math.hypot(center.x - target.x, center.y - target.y);
            // Parado longe do jogador por um intervalo inteiro: está entalado em algo.
            const isStuck = previous !== undefined
                && Math.hypot(center.x - previous.x, center.y - previous.y) < stuckDistance
                && fromPlayer > nearDistance;
            return fromPlayer > distance || isStuck || !(this.flowField?.isReachable(center) ?? true);
        }).slice(0, 6);
        if (lost.length === 0) return;
        const points = selectDroneSpawns(
            lost.length,
            this.player.sprite,
            this.droneSpawnPoints,
            this.isHordeSpawnPoint,
            COMBAT_CONFIG.hordeSpawnMinDistance
        );
        lost.forEach((enemy, index) => {
            const point = points[index % points.length];
            if (!point) return;
            enemy.sprite.setPosition(point.x, point.y);
            (enemy.sprite.body as Phaser.Physics.Arcade.Body | null)?.reset(point.x, point.y);
            this.hordeLastPositions.delete(enemy);
        });
    }

    /** Devolve quantos inimigos nasceram, para a horda saber quantos ainda faltam. */
    private spawnDrones(count: number, startsWave = true) {
        if (!this.player || !this.combat || this.isRoomCombatComplete) return 0;
        const shouldSpawnStairGuards = this.activeRoomKey === 'room2'
            && !this.hasSpawnedRoom2Guards;
        const savedEnemies = this.savedEnemies;
        const spawns = savedEnemies ?? (shouldSpawnStairGuards
            ? selectDroneSpawnsWithPriority(
                count,
                this.player.sprite,
                ROOM2_STAIR_GUARD_SPAWNS.filter((prioritySpawn) =>
                    this.droneSpawnPoints.some((spawnPoint) =>
                        spawnPoint.x === prioritySpawn.x && spawnPoint.y === prioritySpawn.y)),
                this.droneSpawnPoints
            )
            : selectDroneSpawns(
                count,
                this.player.sprite,
                this.droneSpawnPoints,
                this.isHordeSpawnPoint,
                COMBAT_CONFIG.hordeByRoom[this.activeRoomKey] ? COMBAT_CONFIG.hordeSpawnMinDistance : undefined
            ));
        if (startsWave) {
            this.currentWaveIndex = this.waveIndex;
            this.waveIndex += 1;
            this.waveSpawned = 0;
            // Lotes no meio da horda não podem apagar os tiros em voo.
            this.combat.clear();
        }
        const kinds = savedEnemies
            ? savedEnemies.map((enemy) => enemy.kind ?? 'drone')
            : getWaveEnemyKinds(this.activeRoomKey, this.currentWaveIndex, spawns.length, this.waveSpawned);
        this.waveSpawned += spawns.length;
        if (shouldSpawnStairGuards) this.hasSpawnedRoom2Guards = true;
        this.savedEnemies = undefined;
        const isHorde = !!COMBAT_CONFIG.hordeByRoom[this.activeRoomKey];
        const created = spawns.map((spawn, index) => {
            const enemy = this.createEnemy(kinds[index], spawn);
            enemy.relentless = isHorde;
            if (this.flowField) enemy.pathfinder = this.followFlowField;
            if (this.isMultiplayerEnabled()) {
                const { enemyHealthMultiplier } = COMBAT_CONFIG.multiplayer;
                const maxHealth = enemy.health.max * enemyHealthMultiplier;
                enemy.health.restore((spawn as EnemySpawn).health ?? maxHealth, maxHealth);
                enemy.drawHealthBar();
            }
            for (const layer of this.collisionLayers) this.physics.add.collider(enemy.sprite, layer);
            this.droneBodies?.add(enemy.sprite);
            this.addEnemyToCombat(enemy);
            return { kind: kinds[index], spawn, enemy };
        });
        if (this.isMultiplayerEnabled()) {
            multiplayerClient.sendEvent({
                kind: 'enemy.spawn',
                enemies: created.map(({ kind, spawn, enemy }) => ({
                    kind,
                    x: spawn.x,
                    y: spawn.y,
                    patrolLeft: spawn.patrolLeft,
                    patrolRight: spawn.patrolRight,
                    health: enemy.health.current,
                    maxHealth: enemy.health.max
                }))
            });
        }
        return created.length;
    }

    private addEnemyToCombat(enemy: CombatEnemy) {
        if (this.player) this.physics.add.collider(this.player.sprite, enemy.sprite);
        this.drones.push(enemy);
        this.combat?.registerEnemy(enemy);
    }

    private createEnemy(kind: EnemyKind, spawn: EnemySpawn) {
        switch (kind) {
            case 'scooter':
            case 'bike':
                return new Patinete(this, spawn, this.collisionLayers, kind);
            case 'guard':
                return new GuardaCyber(this, spawn, this.collisionLayers);
            case 'drone':
            case 'heavy-drone':
                return new Drone(this, spawn, this.collisionLayers, kind);
            case 'gaucho':
                return new Gaucho(this, spawn, this.collisionLayers, {
                    onDefeated: (x, y) => this.dropChimarrao(x, y),
                    onStrike: (target) => this.handleGauchoStrike(target)
                });
        }
    }

    /** Roda no anfitrião, ou na partida solo: o convidado recebe o golpe por evento. */
    private handleGauchoStrike(target: Player) {
        const { x, y } = target.sprite.body?.center ?? target.sprite;
        const hitLocal = target === this.player;
        this.playGauchoStrike(x, y - 6, hitLocal);
        if (this.isMultiplayerEnabled()) {
            multiplayerClient.sendEvent({ kind: 'enemy.strike', x, y: y - 6, hitPeer: !hitLocal });
        }
    }

    /** Efeito sobre o jogador atingido, para a pancada ser percebida no escuro. */
    private playGauchoStrike(x: number, y: number, hitLocal: boolean) {
        playSwordHit(this, x, y);
        if (!hitLocal) return;
        const { duration, intensity } = COMBAT_CONFIG.gaucho.strikeShake;
        this.cameras.main.shake(duration, intensity);
    }

    /** Botão direito golpeia para onde o personagem olha; só tem efeito na sala corpo a corpo. */
    private handleSwordPointer(pointer: Phaser.Input.Pointer) {
        if (
            !pointer.rightButtonDown() || !this.player || !this.isGameplayReady || this.isGameOver
            || this.isPauseMenuOpen || this.isWaveIntermissionOpen
        ) return;
        if (this.combat?.swing()) {
            this.swordHint?.destroy();
            this.swordHint = undefined;
        }
    }

    private handleSwordGamepad() {
        if (
            !this.player || !this.isGameplayReady || this.isGameOver
            || this.isPauseMenuOpen || this.isWaveIntermissionOpen
        ) return;
        if (this.combat?.swing()) {
            this.swordHint?.destroy();
            this.swordHint = undefined;
        }
    }

    /** O tiro automático some nesta sala, então o jogador precisa ver como atacar. */
    private equipSword() {
        this.combat?.equipSword();
        // No celular o próprio botão USAR vira a espada, que já indica o ataque.
        if (!isTouchScreen()) this.swordHint = this.createWorldHint('BOTÃO DIREITO / BOTÃO PRINCIPAL: ATACAR');
    }

    private createWorldHint(text: string) {
        return this.add.text(0, 0, text, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '8px',
            color: '#ffffff',
            backgroundColor: '#07131fe6',
            padding: { x: 5, y: 3 }
        // A câmera tem zoom: sem resolução maior, as letras pequenas perdem os traços.
        }).setOrigin(0.5).setDepth(25).setResolution(4);
    }

    /** A espada fica no chão logo ao lado de onde o jogador chega ao esconderijo. */
    private createSwordPickup() {
        if (!this.player) return;
        // Perto dos pés, onde fica a hitbox do jogador; a primeira sala não tem obstáculos perto do centro.
        const { x, y } = this.player.sprite;
        // Abaixo de cada jogador: na dupla o parceiro nasce ao lado, e a espada ficaria embaixo dele.
        const item = this.physics.add.image(x, y + 28, 'sword').setDepth(9);
        // À direita da espada e abaixo dos personagens, para nunca cobrir ninguém.
        const label = this.createWorldHint('PEGUE A ESPADA').setOrigin(0, 0.5).setPosition(x + 12, y + 28).setDepth(9);
        const pickup = this.physics.add.overlap(this.player.sprite, item, () => {
            pickup.destroy();
            item.destroy();
            label.destroy();
            if (this.dungeonState) this.dungeonState.swordCollected = true;
            this.equipSword();
        });
    }

    /** O anfitrião sorteia o chimarrão, e o item aparece para os dois jogadores. */
    private dropChimarrao(x: number, y: number, random = Math.random) {
        const { chimarrao } = WORLD_CONFIG;
        const chance = this.activeRoomKey === 'gaucho-dungeon' ? chimarrao.dungeonDropChance : chimarrao.dropChance;
        if (!this.player || this.isMultiplayerGuest() || random() >= chance) return;
        const id = ++this.droppedItemSequence;
        this.spawnChimarrao(id, x, y);
        if (this.isMultiplayerEnabled()) multiplayerClient.sendEvent({ kind: 'item.drop', id, x, y });
    }

    /** A primeira pessoa que pega recebe 50% de movimento e cadência por três segundos. */
    private spawnChimarrao(id: number, x: number, y: number) {
        if (!this.player) return;
        const { chimarrao } = WORLD_CONFIG;
        const item = this.physics.add.image(x, y, chimarrao.texture).setDepth(9);
        const pickup = this.physics.add.overlap(this.player.sprite, item, () => {
            this.removeDroppedItem(id);
            this.activateChimarraoBuff();
            if (this.isMultiplayerEnabled()) multiplayerClient.sendEvent({ kind: 'item.collected', id });
        });
        this.droppedItems.set(id, () => {
            pickup.destroy();
            item.destroy();
        });
    }

    private activateChimarraoBuff() {
        if (!this.player || !this.combat) return;
        const { effectMultiplier, effectDuration } = WORLD_CONFIG.chimarrao;
        this.chimarraoBuffTimer?.remove(false);
        this.player.setTemporaryMovementSpeedMultiplier(effectMultiplier);
        this.combat.setPlayerFireRateMultiplier(effectMultiplier);
        this.chimarraoBuffTimer = this.time.delayedCall(effectDuration, () => {
            this.player?.setTemporaryMovementSpeedMultiplier(1);
            this.combat?.setPlayerFireRateMultiplier(1);
            this.chimarraoBuffTimer = undefined;
        });
    }

    private removeDroppedItem(id: number) {
        this.droppedItems.get(id)?.();
        this.droppedItems.delete(id);
    }

    private handleSecretCodeKey(event: KeyboardEvent) {
        if (
            // Atalho de teste das salas da campanha; as dungeons ficam de fora.
            event.repeat || isDungeonRoom(this.activeRoomKey) || this.isMultiplayerGuest()
            || !this.isGameplayReady || this.isGameOver || this.isRoomCombatComplete
        ) return;
        if (this.activeRoomKey === 'room3' && this.room3CardCode.push(event.key)) {
            this.grantRandomStrongCard();
            return;
        }
        if (!this.roomClearCode.push(event.key)) return;

        this.combat?.clear();
        this.waves = undefined;
        for (const enemy of this.drones) {
            if (enemy.health.isAlive) enemy.takeDamage(enemy.health.current);
        }
        // A vitória agora é no 763.2 (Sala V): o atalho conclui qualquer sala com combate.
        this.completeRoomCombat?.();
    }

    /** Atalho de teste da Sala III: aplica na hora uma carta forte que ainda pode subir de nível. */
    private grantRandomStrongCard(random = Math.random) {
        const pool = this.upgrades.availableCards().filter((card) => ROOM3_UPGRADE_IDS.includes(card.id));
        const card = pool[Math.floor(random() * pool.length)];
        if (card) this.acquireUpgrade(card);
        this.showFloatingHint(card ? `+ ${card.title.toUpperCase()}` : 'CARTAS FORTES NO MÁXIMO');
    }

    private showFloatingHint(text: string) {
        if (!this.player) return;
        const hint = this.createWorldHint(text).setPosition(this.player.sprite.x, this.player.sprite.y - 26);
        this.tweens.add({
            targets: hint,
            y: hint.y - 12,
            alpha: 0,
            delay: 900,
            duration: 600,
            onComplete: () => hint.destroy()
        });
    }

    private createDroneBodies() {
        const group = this.physics.add.group();
        this.physics.add.collider(group, group);
        return group;
    }

    /** Bloqueio invisível para cenário montado por código (bares, mesa do pagode). */
    private addStaticBlock(x: number, y: number, width: number, height: number) {
        const block = this.add.zone(x, y, width, height);
        this.physics.add.existing(block, true);
        if (this.player) this.physics.add.collider(this.player.sprite, block);
    }

    /** Roda de pagode na frente do Bar do Noel: cada um no seu ritmo (pandeiro, cavaquinho ou copo). */
    private createPagode() {
        const { texture, tableTexture, table, people } = PAGODE;
        for (const { x, y, person, play } of people) {
            const key = `pagode-${person}-${play}`;
            if (!this.anims.exists(key)) {
                const first = person * 6 + PAGODE_FRAMES[play];
                this.anims.create({
                    key,
                    frames: this.anims.generateFrameNumbers(texture, { start: first, end: first + 1 }),
                    frameRate: play === 'copo' ? 1.2 : play === 'pandeiro' ? 5 : 4,
                    repeat: -1
                });
            }
            this.add.sprite(x, y, texture, person * 6).setOrigin(0.5, 1).setDepth(getActorDepth(y))
                .play({ key, startFrame: person % 2 });
        }
        this.add.image(table.x, table.y, tableTexture).setOrigin(0.5, 1).setDepth(getActorDepth(table.y));
        this.addStaticBlock(table.x, table.y - 6, 64, 10);
    }

    /** Catraca de entrada do TICEN: fechada até o jogador passar o cartão Grande Floripa. */
    private createTicenGate(texture: string) {
        const { x, y, hint, approach } = TICEN_GATE;
        this.ticenGate = this.add.sprite(x, y, texture, 0).setOrigin(0.5, 1).setDepth(getActorDepth(y));
        this.ticenGateHint = this.add.text(approach.x, approach.y + 14, hint, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '10px',
            color: '#5ce5f1',
            stroke: '#05040a',
            strokeThickness: 3
        }).setOrigin(0.5).setResolution(4).setDepth(3).setVisible(false);
        this.tweens.add({ targets: this.ticenGateHint, alpha: { from: 1, to: 0.45 }, duration: 700, yoyo: true, repeat: -1 });
        // Patinetes e bicicletas de aluguel estacionados em fileira na calçada.
        for (const row of TICEN_PARKED) {
            for (let i = 0; i < row.count; i += 1) {
                this.add.sprite(row.fromX + i * row.spacing, row.y, row.texture, 0)
                    .setOrigin(0.5, 1)
                    .setScale(row.scale)
                    .setDepth(getActorDepth(row.y));
            }
            const width = (row.count - 1) * row.spacing + 16;
            const dock = this.add.zone(row.fromX + width / 2 - 8, row.y - 6, width, 10);
            this.physics.add.existing(dock, true);
            if (this.player) this.physics.add.collider(this.player.sprite, dock);
        }
        // Gente sentada esperando na pracinha antes das catracas.
        for (const sitter of TICEN_SITTERS) {
            this.add.sprite(sitter.x, sitter.y, MERCADO_NPCS.couple.texture, sitter.person * 3)
                .setOrigin(0.5, 1)
                .setFlipX(sitter.flipX)
                .setDepth(getActorDepth(sitter.y));
        }
    }

    /** Chegar na catraca abre a carteira; usar o cartão libera a passagem. */
    private updateTicenGate() {
        if (!isTicenRoom(this.activeRoomKey) || !this.player || this.isTicenGateOpen) return;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        const { approach, triggerDistance, rearmDistance, hintDistance } = TICEN_GATE;
        const distance = Math.hypot(center.x - approach.x, center.y - approach.y);
        this.ticenGateHint?.setVisible(distance <= hintDistance);
        if (distance > rearmDistance) this.isTicenGateArmed = true;
        if (distance > triggerDistance || !this.isTicenGateArmed) return;
        this.isTicenGateArmed = false;
        this.isWalletOpen = true;
        this.player.stopMovement();
        this.physics.pause();
        const close = () => {
            this.isWalletOpen = false;
            this.physics.resume();
        };
        const data: WalletMenuData = {
            balance: runTracker.snapshot().score.total,
            onUse: () => {
                close();
                this.openTicenGate();
            },
            onCancel: close
        };
        this.scene.launch('WalletMenu', data);
        this.scene.bringToTop('WalletMenu');
    }

    /** Embarcar no 763.2 via Kobrasol encerra a partida com vitória. */
    private updateTicenGoal() {
        if (!isTicenRoom(this.activeRoomKey) || !this.player || this.isGameOver) return;
        const { x, y } = this.player.sprite.body?.center ?? this.player.sprite;
        const { left, right, top, bottom } = TICEN_GOAL;
        if (x < left || x > right || y < top || y > bottom) return;
        this.isGameOver = true;
        this.combat?.clear();
        this.physics.pause();
        void runTracker.win(undefined, !this.isMultiplayerGuest());
    }

    /** Luz verde, braço girando e passagem livre: some o bloqueio invisível da catraca. */
    private openTicenGate() {
        this.isTicenGateOpen = true;
        this.ticenGateHint?.setVisible(false);
        const { openFrameDuration, railLayer, row, widenCols } = TICEN_GATE;
        [1, 2, 3].forEach((frame, index) => {
            this.time.delayedCall(openFrameDuration * index, () => this.ticenGate?.setFrame(frame));
        });
        this.time.delayedCall(openFrameDuration * 2, () => {
            // A máquina continua sólida; a passagem abre na grade dos dois lados dela.
            const rails = this.collisionLayers.find((layer) => layer.layer.name === railLayer);
            for (const col of widenCols) rails?.removeTileAt(col, row);
        });
    }

    /** Pergunta escrita no chão, diante do fliperama; pulsa devagar para chamar atenção. */
    private createArcadePrompt() {
        const { cabinet } = MERCADO_INTERIOR;
        // Profundidade 3: acima do piso (2) e abaixo dos personagens (10).
        this.arcadePrompt = this.add.text(cabinet.x, cabinet.y + 22, 'VAMOS JOGAR?', {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '10px',
            color: '#f056c5',
            stroke: '#05040a',
            strokeThickness: 3
        }).setOrigin(0.5).setResolution(4).setDepth(3).setVisible(false);
        this.tweens.add({ targets: this.arcadePrompt, alpha: { from: 1, to: 0.45 }, duration: 700, yoyo: true, repeat: -1 });
    }

    /** Chegar no fliperama abre o minijogo: até duas tentativas, nenhuma depois de vencer; vencer dá corações. */
    private updateArcadeCabinet() {
        if (this.activeRoomKey !== 'mercado-interior' || !this.player) return;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        const { cabinet, triggerDistance, arcade } = MERCADO_INTERIOR;
        const distance = Math.hypot(center.x - cabinet.x, center.y - cabinet.y);
        const hasAttempts = !this.dungeonState || arcadeAttemptsLeft(this.dungeonState) > 0;
        this.arcadePrompt?.setVisible(hasAttempts && distance <= MERCADO_INTERIOR.promptDistance);
        // Para tentar de novo depois de perder, o jogador precisa se afastar e voltar.
        if (distance > arcade.rearmDistance) this.isArcadeArmed = true;
        if (distance > triggerDistance) return;
        // Aberto direto pela URL (?room=mercado) ainda não tem estado da partida.
        const state = this.dungeonState ??= createDungeonSessionState();
        if (!canStartArcade(state, this.isArcadeArmed)) return;
        // Abrir já desarma: para jogar de novo, o jogador se afasta e volta.
        this.isArcadeArmed = false;
        this.isArcadeOpen = true;
        this.player.stopMovement();
        this.physics.pause();
        state.arcadeAttempts += 1;
        const data: ArcadeMinigameData = {
            attemptsLeft: arcadeAttemptsLeft(state),
            onFinish: (won, played) => {
                this.isArcadeOpen = false;
                this.physics.resume();
                if (!played) state.arcadeAttempts -= 1;
                if (!won) return;
                state.arcadeWon = true;
                this.player?.health.increaseMax(arcade.rewardHearts * COMBAT_CONFIG.player.healthPerHeart);
            }
        };
        this.scene.launch('ArcadeMinigame', data);
        this.scene.bringToTop('ArcadeMinigame');
    }

    private activateRoomExit() {
        const gateway = ROOM_EXIT_GATEWAYS.find(({ from }) => from === this.activeRoomKey);
        if (this.isRoomExitOpen || !gateway) return;
        this.isRoomExitOpen = true;
        const { x, y } = gateway.portal;
        this.roomExitPortal = new RoomExitPortal(this, x, y, gateway.portalWall, gateway.portalScale);
    }

    private updateRoomGateway() {
        if (!this.player?.health.isAlive || this.isRoomTransitioning) return;
        const sprite = this.player.sprite;
        if (!sprite) return;
        const center = sprite.body?.center ?? sprite;
        const body = sprite.body;

        const secretGateway = SECRET_DUNGEON_GATEWAYS.find((gateway) =>
            gateway.from === this.activeRoomKey);
        const isAtEntrance = !!secretGateway && isTouchingSecretDungeonEntrance(
            center.x,
            center.y,
            !secretGateway.wall
                || (body instanceof Phaser.Physics.Arcade.Body && body.blocked[secretGateway.wall]),
            secretGateway
        );
        const returnGateway = SECRET_DUNGEON_GATEWAYS.find((gateway) =>
            gateway.to === this.activeRoomKey);
        const isAtReturn = !!returnGateway && !!this.dungeonReturnArea
            && isTouchingDungeonReturn(center.x, center.y, this.dungeonReturnArea);
        // Quem respondeu NÃO só é perguntado de novo depois de sair da passagem.
        if (!isAtEntrance && !isAtReturn) this.isGatewayConfirmArmed = true;
        if (secretGateway && isAtEntrance) {
            this.passSecretGateway(secretGateway.confirm?.enter, () => {
                this.dungeonState ??= createDungeonSessionState();
                this.transitionToRoom(secretGateway.to, {
                    dungeonState: this.dungeonState
                });
            });
            return;
        }
        if (returnGateway && isAtReturn) {
            this.passSecretGateway(returnGateway.confirm?.exit, () => this.transitionToRoom(returnGateway.from, {
                spawn: returnGateway.returnSpawn,
                dungeonState: this.dungeonState
            }));
            return;
        }
        const exitGateway = ROOM_EXIT_GATEWAYS.find(({ from }) => from === this.activeRoomKey);
        if (
            !exitGateway
            || !this.isRoomExitOpen
            || !isInsideRoomGateway(center.x, center.y, exitGateway)
        ) return;

        // Leva o estado junto para os dois jogadores continuarem com a mesma semente.
        this.transitionToRoom(
            exitGateway.to,
            this.dungeonState ? { dungeonState: this.dungeonState } : {}
        );
    }

    /** Passa direto, ou pergunta antes quando a passagem tem confirmação. */
    private passSecretGateway(question: string | undefined, pass: () => void) {
        if (!question) {
            pass();
            return;
        }
        if (!this.isGatewayConfirmArmed || !this.player) return;
        this.isGatewayConfirmArmed = false;
        this.isGatewayConfirmOpen = true;
        this.player.stopMovement();
        this.physics.pause();
        const data: ConfirmPromptData = {
            title: question,
            onChoice: (confirmed) => {
                this.isGatewayConfirmOpen = false;
                this.physics.resume();
                if (confirmed) pass();
            }
        };
        this.scene.launch('ConfirmPrompt', data);
        this.scene.bringToTop('ConfirmPrompt');
    }

    private transitionToRoom(
        roomKey: RoomKey,
        options: {
            spawn?: Readonly<{ x: number; y: number }>;
            dungeonState?: DungeonSessionState;
        } = {}
    ) {
        if (!this.player || this.isRoomTransitioning) return;
        if (this.isMultiplayerGuest()) {
            // Só o anfitrião troca a sala, para os dois saírem juntos.
            if (this.isRoomRequestPending) return;
            this.isRoomRequestPending = true;
            multiplayerClient.sendEvent({
                kind: 'room.request',
                roomKey,
                ...(options.spawn ? { spawn: options.spawn } : {})
            });
            return;
        }
        if (this.isMultiplayerEnabled()) {
            multiplayerClient.sendEvent({
                kind: 'room.transition',
                roomKey,
                ...(options.spawn ? { spawn: options.spawn } : {}),
                ...(options.dungeonState ? { seed: options.dungeonState.seed } : {})
            });
        }
        this.beginRoomTransition(roomKey, options);
    }

    private beginRoomTransition(
        roomKey: RoomKey,
        options: {
            spawn?: Readonly<{ x: number; y: number }>;
            dungeonState?: DungeonSessionState;
        }
    ) {
        if (!this.player || this.isRoomTransitioning) return;
        if (this.isMultiplayerEnabled()) {
            // A troca conjunta pode acontecer com este jogador caído ou no menu de pausa.
            if (!this.player.health.isAlive) this.revivePlayer();
            this.scene.stop('PauseMenu');
        }
        // O parceiro pode trocar de sala com uma pergunta ou o fliperama abertos aqui.
        if (this.isGatewayConfirmOpen) this.scene.stop('ConfirmPrompt');
        if (this.isArcadeOpen) this.scene.stop('ArcadeMinigame');
        if (this.isWalletOpen) this.scene.stop('WalletMenu');
        this.rememberCombatProgress();
        this.isRoomTransitioning = true;
        this.player.stopMovement();
        this.combat?.clear();
        this.physics.pause();
        const playerProgress = capturePlayerProgress(this.player, this.upgrades);
        const checkpointRooms: readonly RoomKey[] = ['room2', 'room3', 'room4', 'room5', 'dungeon'];
        if (!this.isMultiplayerEnabled() && checkpointRooms.includes(roomKey)) {
            // Checkpoints oficiais são as fases 2 a 5; a dungeon é uma rota secreta da fase 2.
            saveCampaignProgress({
                roomKey: roomKey === 'dungeon' ? 'room2' : roomKey,
                playerProgress,
                run: runTracker.checkpoint()
            });
        }
        this.scene.launch('RoomTransition', {
            roomKey,
            source: 'world',
            playerProgress,
            ...options
        });
        this.scene.bringToTop('RoomTransition');
    }

    /** Guarda inimigos vivos e ondas restantes para retomar a sala na próxima visita. */
    private rememberCombatProgress() {
        if (!this.dungeonState) return;
        const enemies = this.drones.flatMap((enemy) => {
            if (!enemy.health.isAlive) return [];
            return [{
                kind: enemy.kind ?? 'drone',
                x: enemy.sprite.x,
                y: enemy.sprite.y,
                health: enemy.health.current,
                patrolLeft: enemy.sprite.x - 16,
                patrolRight: enemy.sprite.x + 16
            }];
        });
        this.dungeonState.piranhasItemConsumed = this.hasSelectedPiranhasItem;
        this.dungeonState.savedCombat[this.activeRoomKey] = {
            enemies,
            pendingWaves: this.waves?.pendingWaves() ?? [],
            hordeRemaining: this.waves?.currentWaveRemaining() ?? 0,
            cleared: this.isRoomCombatComplete
        };
    }

    /** Uma fissura discreta indica a parede correta sem transformar a entrada em portal visível. */
    private createSecretEntranceHint(gateway: SecretDungeonGateway) {
        const { portal } = gateway;
        // O portal aceso do mercado já é o convite para entrar.
        if (gateway.wall === 'up') return;
        if (!gateway.wall) {
            // Acima do chão (0) e abaixo dos jogadores (10).
            this.add.image(portal.x, portal.y, 'manhole').setDepth(1);
            return;
        }
        const lightX = portal.x + (gateway.wall === 'right' ? -4 : 4);
        createLampLight(this, lightX, portal.y, 18, 0.07).setScale(0.52);
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
            || !['room2', 'room3', 'room4', 'room5'].includes(this.activeRoomKey) || !loadCampaignProgress()
        ) return;
        saveCampaignProgress({
            roomKey: this.activeRoomKey,
            playerProgress: capturePlayerProgress(this.player, this.upgrades),
            run: runTracker.checkpoint()
        });
    }

    private playWaveIntermission(resume: () => void) {
        if (this.isMultiplayerHost()) {
            this.sendEnemySnapshot();
            multiplayerClient.sendEvent({ kind: 'wave.intermission' });
        }
        this.cardBarrier.open();
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;
        this.piranhasBarPrompt?.setVisible(false);
        const overlayScene = this.scene.get('CombatHud') as Scene;
        // Antes das hordas maiores, as cartas fortes de cada sala ficam garantidas na mesa.
        const availableCards = this.upgrades.availableCards();
        const cards = this.activeRoomKey === 'room3'
            ? drawUpgradeCardsFeaturing(ROOM3_UPGRADE_IDS, undefined, availableCards)
            : this.activeRoomKey === 'room2'
                ? drawUpgradeCardsFeaturing(AREA_UPGRADE_IDS, undefined, withoutRoom3Cards(availableCards))
                : drawUpgradeCards(undefined, basicUpgradeCards(availableCards));
        new UpgradeSelectionView(overlayScene, cards).play((selected) => {
            this.acquireUpgrade(selected);
            this.waitForPartnerCard(() => {
                new WaveThreatView(overlayScene, this.cameras.main).play(() => {
                    this.isWaveIntermissionOpen = false;
                    if (this.isGameplayReady && !this.isGameOver) this.physics.resume();
                    resume();
                });
            });
        });
    }

    /** Oferece uma segunda escolha depois da onda final e só então libera a Sala II. */
    private playRoom1CompletionReward(onComplete: () => void) {
        this.cardBarrier.open();
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;
        this.piranhasBarPrompt?.setVisible(false);

        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(
            overlayScene,
            drawUpgradeCards(undefined, basicUpgradeCards(this.upgrades.availableCards())),
            {
                title: 'SALA I CONCLUÍDA',
                hint: 'Escolha uma recompensa'
            }
        ).play((selected) => {
            this.acquireUpgrade(selected);
            this.waitForPartnerCard(() => {
                this.isWaveIntermissionOpen = false;
                onComplete();
                if (this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen) {
                    this.physics.resume();
                }
            });
        });
    }

    /** Entrega uma única carta ao limpar a única onda da dungeon. */
    private playDungeonReward(onComplete: () => void) {
        // O esconderijo só paga uma vez porque a sala vencida não repete o combate.
        const isMainDungeon = this.activeRoomKey === 'dungeon';
        if (!this.player || !this.dungeonState || (isMainDungeon && this.dungeonState.rewardClaimed)) {
            onComplete();
            return;
        }
        this.cardBarrier.open();
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;

        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(
            overlayScene,
            drawUpgradeCards(undefined, basicUpgradeCards(this.upgrades.availableCards())),
            {
                title: 'DUNGEON CONCLUÍDA',
                hint: 'Escolha sua recompensa'
            }
        ).play((selected) => {
            this.acquireUpgrade(selected);
            if (this.dungeonState && isMainDungeon) this.dungeonState.rewardClaimed = true;
            this.waitForPartnerCard(() => {
                this.isWaveIntermissionOpen = false;
                onComplete();
                if (this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen) {
                    this.physics.resume();
                }
            });
        });
    }

    private acquireUpgrade(card: UpgradeCardDefinition) {
        if (!this.upgrades.acquire(card)) return;
        if (card.effect.type === 'increase-max-health') {
            // Quem está caído só volta pelo reviver, nunca pela cura da carta.
            this.player?.health.increaseMax(
                card.effect.amount,
                this.player.health.isAlive ? card.effect.healAmount : 0
            );
        }
        if (this.activeRoomKey !== 'gaucho-dungeon') this.playerRangeIndicator?.setRadius(this.upgrades.range);
    }

    private createPiranhasBarPrompt() {
        const { x, y } = PIRANHAS_BAR_CONFIG.prompt;
        this.piranhasBarPrompt = this.add.text(x, y, isTouchScreen() ? '[ USAR ]  CARDÁPIO' : '[ G / BOTÃO PRINCIPAL ]  CARDÁPIO', {
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
            !this.player?.health.isAlive || !this.piranhasBarPrompt?.visible
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
            cardCenterDistance: 220
        }).play((item) => this.consumePiranhasItem(item));
    }

    private consumePiranhasItem(item: PiranhasBarItem) {
        if (!this.player) return;

        switch (item.id) {
            case 'gin-tropical':
                // Soma ao bônus atual para não apagar os chimarrões já coletados.
                this.player.setMovementSpeedMultiplier(
                    this.player.getMovementSpeedMultiplier() + PIRANHAS_BAR_CONFIG.tropicalSpeedMultiplier - 1
                );
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

    private playHitStop() {
        if (this.isHitStopActive || !this.isGameplayReady || this.isGameOver) return;
        this.isHitStopActive = true;
        this.physics.pause();
        this.hitStopTimer = this.time.delayedCall(WORLD_CONFIG.feedback.hitStopDuration, () => {
            this.hitStopTimer = undefined;
            this.isHitStopActive = false;
            if (
                this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen
                && !this.isPiranhasMenuOpen && !this.isWaveIntermissionOpen
                && !this.isRoomTransitioning
            ) {
                this.physics.resume();
            }
        });
    }

    private updateLowHealthEffect() {
        if (!this.player || !this.lowHealthFilter) return;
        const { threshold, maxDesaturation } = WORLD_CONFIG.feedback.lowHealth;
        const healthRatio = this.player.health.max > 0
            ? this.player.health.current / this.player.health.max
            : 0;
        const desaturation = healthRatio >= threshold
            ? 0
            : Math.min(1, (threshold - healthRatio) / threshold) * maxDesaturation;
        if (Math.abs(desaturation - this.lowHealthDesaturation) < 0.001) return;

        this.lowHealthDesaturation = desaturation;
        this.lowHealthFilter.colorMatrix.reset().saturate(-desaturation);
    }

    private createPlayerRangeIndicator() {
        const range = this.activeRoomKey === 'gaucho-dungeon'
            ? COMBAT_CONFIG.melee.range
            : COMBAT_CONFIG.player.range;
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
        this.waveIndex = 0;
        this.currentWaveIndex = 0;
        this.waveSpawned = 0;
        this.hordeRecallElapsed = 0;
        this.flowField = undefined;
        this.hordeLastPositions.clear();
        this.isRoomCombatComplete = false;
        this.isHitStopActive = false;
        this.hitStopTimer?.remove(false);
        this.hitStopTimer = undefined;
        this.chimarraoBuffTimer?.remove(false);
        this.chimarraoBuffTimer = undefined;
        this.roomClearCode.reset();
        this.room3CardCode.reset();
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
        this.mercadoNpcs?.destroy();
        this.mercadoNpcs = undefined;
        for (const queue of this.barQueues) queue.destroy();
        this.barQueues = [];
        this.roomExitPortal?.destroy();
        this.roomExitPortal = undefined;
        this.player?.setControlsInverted(false);
        // No SHUTDOWN o Phaser pode remover a câmera antes de notificar a cena.
        // A limpeza não pode interromper a fila de restart/start do SceneManager.
        this.cameras.main?.setRotation(0).setZoom(this.normalCameraZoom);
        this.lowHealthFilter = undefined;
        this.lowHealthDesaturation = -1;
        this.gamepad = undefined;
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
        this.reviveElapsed = 0;
        this.reviveBar = undefined;
        this.enemySnapshot = [];
        this.cardRelease = undefined;
        this.droppedItems.clear();
        this.swordHint = undefined;
        this.input.keyboard?.off('keydown-P', this.openPauseMenu, this);
        this.input.off('pointerdown', this.handleSwordPointer, this);
        this.input.keyboard?.off('keydown-G', this.openPiranhasMenu, this);
        this.input.keyboard?.off('keydown', this.handleSecretCodeKey, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
    }

    private openPauseMenu() {
        if (
            !this.isGameplayReady || this.isPauseMenuOpen || this.isPiranhasMenuOpen
            || this.isWaveIntermissionOpen || this.isArcadeOpen || this.isGatewayConfirmOpen || this.isWalletOpen
            || !this.player?.health.isAlive
        ) return;

        this.isPauseMenuOpen = true;
        this.scene.launch('PauseMenu', { upgrades: this.upgrades.exportProgress() });
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
        multiplayerClient.roomEpoch += 1;
        const localId = multiplayerClient.playerId;
        for (const [index, playerId] of (multiplayerClient.match?.players ?? []).entries()) {
            if (playerId === localId) continue;
            const spawn = this.activeSpawn;
            this.remotePlayers.set(playerId, new RemotePlayer(
                this,
                spawn.x + index * 36,
                spawn.y,
                (amount) => multiplayerClient.sendEvent({ kind: 'player.damage', amount })
            ));
        }
        this.reviveBar = this.add.graphics().setDepth(25);
        this.unsubscribeMultiplayer = multiplayerClient.subscribe((message) => this.handleMultiplayerMessage(message));
    }

    private connectCombatToPartner() {
        if (!this.isMultiplayerEnabled()) return;
        this.combat?.setNetwork({
            isHost: this.isMultiplayerHost(),
            getEnemyTarget: (origin) => this.getEnemyTarget(origin) as Player | undefined,
            onEnemyShot: (x, y, angle) => multiplayerClient.sendEvent({ kind: 'enemy.shot', x, y, angle }),
            onPlayerShot: (x, y, angle, speed, color, pierces) => multiplayerClient.sendEvent({
                kind: 'player.shot', x, y, angle, speed, color, pierces
            }),
            onPlayerSwing: (x, y, angle) => multiplayerClient.sendEvent({ kind: 'player.swing', x, y, angle }),
            onPlayerEffect: (effect) => multiplayerClient.sendEvent({ kind: 'player.effect', ...effect }),
            onEnemyHit: (enemy, damage, direction) => multiplayerClient.sendEvent({
                kind: 'enemy.hit',
                index: this.drones.indexOf(enemy),
                damage,
                dx: direction.x,
                dy: direction.y
            })
        });
    }

    private updateMultiplayer(delta: number) {
        if (!this.isMultiplayerEnabled() || !this.player) return;
        const body = this.player.sprite.body;
        const feetOffset = {
            x: (body?.center.x ?? this.player.sprite.x) - this.player.sprite.x,
            y: (body?.center.y ?? this.player.sprite.y) - this.player.sprite.y
        };
        for (const remotePlayer of this.remotePlayers.values()) remotePlayer.update(feetOffset);
        this.multiplayerSyncElapsed += delta;
        if (this.multiplayerSyncElapsed < 50) return;
        this.multiplayerSyncElapsed = 0;
        const state = this.player.getNetworkState();
        // Faíscas e drone só agem fora da sala corpo a corpo e com o jogador de pé, como no CombatSystem.
        const cardsActive = this.activeRoomKey !== 'gaucho-dungeon' && this.player.health.isAlive;
        multiplayerClient.sendPlayerState({
            ...state,
            health: this.player.health.current,
            maxHealth: this.player.health.max,
            reviveProgress: this.getReviveProgress(),
            revivesLeft: this.getRevivesLeft(),
            character: this.characterId,
            orbitCount: cardsActive ? this.upgrades.orbitCount : 0,
            orbitRadius: this.upgrades.orbitRadius,
            companion: cardsActive && this.upgrades.companionCount > 0
        });
        if (this.isMultiplayerHost()) this.sendEnemySnapshot();
    }

    private sendEnemySnapshot() {
        if (this.drones.length === 0) return;
        multiplayerClient.sendEvent({
            kind: 'enemy.snapshot',
            rows: this.drones.map((enemy) => createEnemySnapshotRow(enemy))
        });
    }

    private getReviveProgress() {
        return Math.min(1, this.reviveElapsed / COMBAT_CONFIG.multiplayer.reviveDuration);
    }

    /** O próprio caído conta o tempo, pois é a autoridade sobre a sua vida. */
    private updateRevive(delta: number) {
        if (!this.player || !this.isMultiplayerEnabled()) return;
        if (this.player.health.isAlive) {
            this.reviveBar?.clear();
            return;
        }
        this.player.sprite.setAngle(90);
        // Sem corpo físico, inimigos passam por cima em vez de arrastar quem caiu.
        if (this.player.sprite.body) this.player.sprite.body.enable = false;
        if (this.getRevivesLeft() === 0) return;
        const feet = this.player.sprite.body?.center ?? this.player.sprite;
        const isPartnerClose = [...this.remotePlayers.values()].some((partner) =>
            partner.isAlive && isWithinReviveRadius(feet, partner.feet));
        this.reviveElapsed = advanceRevive(this.reviveElapsed, delta, isPartnerClose);
        if (this.reviveBar) {
            drawPlayerBar(this.reviveBar, this.player.sprite.x, this.player.sprite.y - 24, this.getReviveProgress(), 0x8affc1);
        }
        if (this.reviveElapsed >= COMBAT_CONFIG.multiplayer.reviveDuration) this.revivePlayer();
    }

    private getRevivesLeft() {
        return Math.max(0, COMBAT_CONFIG.multiplayer.maxRevives - multiplayerClient.revivesUsed);
    }

    private revivePlayer() {
        if (!this.player || this.getRevivesLeft() === 0) return;
        multiplayerClient.revivesUsed += 1;
        const { max } = this.player.health;
        this.player.revive(Math.ceil(max * COMBAT_CONFIG.multiplayer.reviveHealthRatio));
        this.reviveElapsed = 0;
        this.reviveBar?.clear();
    }

    private getCoopStatus() {
        const partner = [...this.remotePlayers.values()][0];
        const isLocalDown = !this.player?.health.isAlive;
        let message = '';
        if (this.cardBarrier.isWaitingForPeer || this.cardRelease) message = 'AGUARDANDO O PARCEIRO ESCOLHER...';
        else if (isLocalDown && !this.isGameOver) {
            message = this.getRevivesLeft() > 0
                ? `VOCE CAIU! O PARCEIRO PRECISA FICAR EM CIMA DE VOCE (${this.getRevivesLeft()} RESTANTES)`
                : 'VOCE MORREU! SEM RENASCIMENTOS RESTANTES';
        } else if (partner && !partner.isAlive && !this.isGameOver) {
            message = partner.revivesLeft > 0
                ? 'PARCEIRO CAIDO! FIQUE EM CIMA DELE POR 5 SEGUNDOS'
                : 'PARCEIRO MORREU! SEM RENASCIMENTOS RESTANTES';
        }
        return {
            message,
            ...(partner ? { partnerHealth: { current: partner.health.current, max: partner.health.max } } : {})
        };
    }

    /** Sem parceiro presente a escolha libera na hora, como em uma partida solo. */
    private waitForPartnerCard(release: () => void) {
        if (!this.isCoopActive()) {
            release();
            return;
        }
        if (this.isMultiplayerGuest()) {
            this.cardRelease = release;
            multiplayerClient.sendEvent({ kind: 'cards.chosen' });
            return;
        }
        this.cardBarrier.chooseLocal(() => {
            multiplayerClient.sendEvent({ kind: 'cards.released' });
            release();
        });
    }

    private getEnemyTarget(origin: { x: number; y: number }): CoopTarget | undefined {
        if (!this.isMultiplayerEnabled()) return this.player as CoopTarget | undefined;
        const targets = [...this.remotePlayers.values()].map((partner) => partner.target) as CoopTarget[];
        if (this.player) targets.push(this.player as CoopTarget);
        return nearestLivingTarget(origin, targets);
    }

    private updateEnemiesFromSnapshot() {
        for (const [index, enemy] of this.drones.entries()) {
            const row = this.enemySnapshot[index];
            if (!row || !enemy.health.isAlive) continue;
            enemy.sprite.anims.stop();
            enemy.sprite.setFrame(row[3]).setFlipX(row[4] === 1).setPosition(
                Phaser.Math.Linear(enemy.sprite.x, row[0], 0.35),
                Phaser.Math.Linear(enemy.sprite.y, row[1], 0.35)
            );
            enemy.drawHealthBar();
        }
    }

    private handleMultiplayerMessage(message: ServerMessage) {
        if (message.type === 'player.state') {
            this.remotePlayers.get(message.playerId)?.applyState(message);
        }
        if (message.type === 'player.left') {
            for (const [playerId, remotePlayer] of this.remotePlayers) {
                if (message.playerId && playerId !== message.playerId) continue;
                remotePlayer.destroy();
                this.remotePlayers.delete(playerId);
            }
            this.handlePartnerLeft();
        }
        if (message.type === 'match.event') this.handleCoopEvent(message.event);
    }

    private handlePartnerLeft() {
        if (this.isMultiplayerGuest()) {
            // shortcut: sem migração de anfitrião a partida termina, trocar se quedas forem comuns.
            if (this.isGameOver) return;
            this.isGameOver = true;
            this.combat?.clear();
            this.physics.pause();
            runTracker.lose();
            return;
        }
        this.cardBarrier.choosePeer();
    }

    private handleCoopEvent(event: CoopEvent) {
        switch (event.kind) {
            case 'enemy.spawn':
                for (const row of event.enemies) {
                    const enemy = this.createEnemy(row.kind, row);
                    enemy.health.restore(row.health, row.maxHealth);
                    enemy.drawHealthBar();
                    this.addEnemyToCombat(enemy);
                }
                break;
            case 'enemy.snapshot':
                this.enemySnapshot = event.rows;
                for (const [index, row] of event.rows.entries()) {
                    const enemy = this.drones[index];
                    if (!enemy) continue;
                    const center = { x: enemy.sprite.x, y: enemy.sprite.y };
                    const damage = applyEnemySnapshotHealth(enemy, row);
                    if (damage > 0) playDamageNumber(this, center.x, center.y, damage);
                }
                break;
            case 'enemy.shot':
                this.combat?.spawnEnemyShot(event.x, event.y, event.angle);
                break;
            case 'enemy.hit':
                this.applyPartnerHit(event);
                break;
            case 'enemy.killed': {
                const enemy = this.drones[event.index];
                if (!enemy) break;
                // shortcut: o projétil já terminou aqui, então abates do convidado não somam multi-kill.
                const killId = `${enemy.id}:coop-kill`;
                if (runTracker.recordEnemyDeath(enemy.id, killId)) runTracker.finalizeProjectile(killId);
                // Só o anfitrião manda este evento, e só por golpe do convidado: a carta de detonação é daqui.
                this.combat?.detonateConfirmedKill(enemy, killId);
                this.playHitStop();
                break;
            }
            case 'player.shot':
                this.combat?.spawnPartnerShot(event.x, event.y, event.angle, event.speed, event.color, event.pierces);
                break;
            case 'player.swing':
                this.combat?.playPartnerSwing(event.x, event.y, event.angle);
                break;
            case 'player.effect':
                this.combat?.playPartnerEffect(event);
                break;
            case 'player.damage':
                this.player?.takeDamage(event.amount);
                break;
            case 'enemy.strike':
                this.playGauchoStrike(event.x, event.y, event.hitPeer);
                break;
            case 'item.drop':
                this.spawnChimarrao(event.id, event.x, event.y);
                break;
            case 'item.collected':
                this.removeDroppedItem(event.id);
                break;
            case 'wave.intermission':
                this.playWaveIntermission(() => undefined);
                break;
            case 'combat.complete':
                if (this.dungeonState) this.dungeonState.rewardClaimed = event.rewardClaimed;
                this.completeRoomCombat?.();
                break;
            case 'cards.chosen':
                this.cardBarrier.choosePeer();
                break;
            case 'cards.released': {
                const release = this.cardRelease;
                this.cardRelease = undefined;
                release?.();
                break;
            }
            case 'room.request':
                if (this.isMultiplayerHost()) {
                    if (isDungeonRoom(event.roomKey)) this.dungeonState ??= createDungeonSessionState();
                    this.transitionToRoom(event.roomKey, {
                        ...(event.spawn ? { spawn: event.spawn } : {}),
                        ...(this.dungeonState ? { dungeonState: this.dungeonState } : {})
                    });
                }
                break;
            case 'room.transition': {
                // A semente do anfitrião vence a criada aqui ao pisar na entrada: o mapa precisa ser igual.
                if (event.seed !== undefined) {
                    this.dungeonState ??= createDungeonSessionState(event.seed);
                    this.dungeonState.seed = event.seed;
                }
                this.beginRoomTransition(event.roomKey, {
                    ...(event.spawn ? { spawn: event.spawn } : {}),
                    ...(this.dungeonState ? { dungeonState: this.dungeonState } : {})
                });
                break;
            }
            case 'world.ready':
                break;
        }
    }

    private applyPartnerHit(event: Extract<CoopEvent, { kind: 'enemy.hit' }>) {
        const enemy = this.drones[event.index];
        if (!this.isMultiplayerHost() || !enemy?.health.isAlive) return;
        const center = { x: enemy.sprite.x, y: enemy.sprite.y };
        const damage = enemy.takeDamage(event.damage, { x: event.dx, y: event.dy });
        if (damage > 0) playDamageNumber(this, center.x, center.y, damage);
        if (!enemy.health.isAlive) {
            multiplayerClient.sendEvent({ kind: 'enemy.killed', index: event.index });
        }
    }

    private isMultiplayerEnabled() {
        return Boolean(this.registry?.get('multiplayerEnabled'));
    }

    private isMultiplayerHost() {
        return this.isMultiplayerEnabled() && multiplayerClient.isHost;
    }

    private isMultiplayerGuest() {
        return this.isMultiplayerEnabled() && !multiplayerClient.isHost;
    }

    private isCoopActive() {
        return this.isMultiplayerEnabled() && this.remotePlayers.size > 0;
    }

    private canPartnerRevive() {
        return this.isCoopActive() && [...this.remotePlayers.values()].some((partner) => partner.isAlive);
    }

    /** O anfitrião só cria inimigos depois que o parceiro consegue recebê-los. */
    private isPartnerRoomReady() {
        return !this.isCoopActive() || multiplayerClient.peerReadyEpoch >= multiplayerClient.roomEpoch;
    }
}
