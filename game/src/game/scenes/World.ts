import { loadCharacterId, type CharacterId } from '../config/characters';
import { Scene } from 'phaser';
import { configureWorldCamera } from '../camera/configureWorldCamera';
import {
    COMBAT_CONFIG,
    getPlayerShotMultipliers,
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
import { drawGolemCards, drawTableCards, type CardTable } from '../upgrades/drawUpgradeCards';
import { ROOM3_UPGRADE_IDS } from '../upgrades/catalog';
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
import { climbSewerLadder, createSewerLadder } from '../map/SewerLadder';
import { arcadeAttemptsLeft, canStartArcade } from '../minigame/arcadeAttempts';
import type { ArcadeMinigameData } from './ArcadeMinigame';
import type { ConfirmPromptData } from './ConfirmPrompt';
import type { PauseMenuData } from './PauseMenu';
import type { InventoryData } from '../ui/InventoryMenuView';
import type { WalletMenuData } from './WalletMenu';
import {
    formatBalance, TICEN_DUEL, TICEN_GATE, TICEN_GOAL, TICEN_PARKED, TICEN_ESCAPE, TICEN_SITTERS, TOPAZIO_BOSS, WALLET_UI,
    type DuelSpecialId
} from '../config/ticen';
import { playExplosion } from '../effects/playAreaEffects';
import { getBusFrame, TopazioGolem, type BusTarget } from '../entities/TopazioGolem';
import { BusEndingView } from '../ui/BusEndingView';
import { CinematicBarsView } from '../ui/CinematicBarsView';
import { encodeWornItems, GAUCHO_HAT, getChestCandidates, ITEM_CHESTS, ITEM_IDS, ITEMS, type ItemId } from '../config/items';
import { createItemTexture, createItemTextures } from '../entities/WornItem';
import { MercadoNpcs } from '../entities/MercadoNpcs';
import { TchayQueue } from '../entities/TchayQueue';
import { createMercadoEntranceSign } from '../map/createMercadoEntranceSign';
import { DuelStandoffView } from '../ui/DuelStandoffView';
import { prefersReducedMotion } from '../ui/easing';
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
    ROOM2_DUNGEON_SIGNS,
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
import { formatElapsedTime } from '../scoring/ScoreCalculator';
import { SCORE_CONFIG } from '../config/score';
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

/** Quantas cartas o jogador escolhe entre as hordas: a Sala II dá duas seguidas. */
export function getIntermissionCardPicks(roomKey: RoomKey) {
    return roomKey === 'room2' ? 2 : 1;
}

/** Mesa de cartas de cada sala; o esconderijo usa a da sala por onde se entra nele. */
export function getCardTable(roomKey: RoomKey): Exclude<CardTable, 'room3-final'> {
    if (roomKey === 'room2' || roomKey === 'dungeon') return 'room2';
    if (roomKey === 'room3') return 'room3';
    return 'room1';
}

/** A Sala I dá uma carta básica no fim; a Sala III, depois da horda 2, as cartas de área mais fortes. */
export function shouldOfferRoomCompletionUpgrade(roomKey: RoomKey) {
    return roomKey === 'room1' || roomKey === 'room3';
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
    /** A catraca fecha atrás de quem passa; isto lembra que o jogador local já entrou no terminal. */
    private hasPassedTicenGate = false;
    private hasPartnerPassedTicenGate = false;
    private ticenRailTiles: Phaser.Tilemaps.Tile[] = [];
    private ticenGate?: Phaser.GameObjects.Sprite;
    private ticenGateHint?: Phaser.GameObjects.Text;
    private golem?: TopazioGolem;
    private isGolemAwake = false;
    private isCutsceneActive = false;
    private isBusDoorOpen = false;
    /** Fuga em dupla: voto para embarcar, disputa pela vaga e quem foi deixado para trás. */
    private isEscapeVoteArmed = true;
    private hasVotedEscape = false;
    private hasPartnerVotedEscape = false;
    private isDuelActive = false;
    private isDuelOver = false;
    private duelTimers: Phaser.Time.TimerEvent[] = [];
    private readonly duelChests = new Map<number, {
        image: Phaser.GameObjects.Sprite;
        glow: Phaser.GameObjects.Graphics;
        special: DuelSpecialId;
        opened: boolean;
        claimed: boolean;
    }>();
    private duelChestSequence = 0;
    private itemChest?: {
        image: Phaser.GameObjects.Sprite;
        hint: Phaser.GameObjects.Text;
        glow?: Phaser.GameObjects.Graphics;
        roomKey: RoomKey;
    };
    // Sobrevive à ida e volta dos esconderijos: quando a sala começou, se o baú destrancou, o item sorteado e se já foi pego.
    private readonly itemChestRuns = new Map<RoomKey, { startedAt: number; unlocked: boolean; item?: ItemId; claimed: boolean }>();
    private lifestealUntil = 0;
    private victorySubtitle?: string;
    private busDoorObjects: Phaser.GameObjects.GameObject[] = [];
    private isArcadeArmed = true;
    private isGatewayConfirmOpen = false;
    private isClimbingLadder = false;
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
    private chimarraosCollected = 0;
    private ownedItems: ItemId[] = [];
    private equippedItems: ItemId[] = [];
    private roomMap?: Phaser.Tilemaps.Tilemap;
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
        // O fliperama pode ter sido fechado pela troca de sala, sem passar pelo fim da partida dele.
        runTracker.resumeClock();
        this.isWalletOpen = false;
        this.isTicenGateArmed = true;
        this.isTicenGateOpen = false;
        this.hasPassedTicenGate = false;
        this.hasPartnerPassedTicenGate = false;
        this.ticenRailTiles = [];
        this.ticenGate = undefined;
        this.ticenGateHint = undefined;
        this.golem = undefined;
        this.isGolemAwake = false;
        this.isCutsceneActive = false;
        this.isBusDoorOpen = false;
        this.isEscapeVoteArmed = true;
        this.hasVotedEscape = false;
        this.hasPartnerVotedEscape = false;
        this.isDuelActive = false;
        this.isDuelOver = false;
        this.duelTimers = [];
        this.duelChests.clear();
        this.duelChestSequence = 0;
        this.lifestealUntil = 0;
        this.victorySubtitle = undefined;
        this.busDoorObjects = [];
        this.isArcadeArmed = true;
        this.arcadePrompt = undefined;
        this.isGatewayConfirmOpen = false;
        this.isClimbingLadder = false;
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
        this.chimarraosCollected = 0;
        this.ownedItems = [];
        this.equippedItems = [];
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
        // O esconderijo fica embaixo do bueiro da Sala I: volta-se por uma escada até a tampa.
        if (roomKey === 'gaucho-dungeon' && this.dungeonReturnArea) createSewerLadder(this, this.dungeonReturnArea);
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
            this.chimarraosCollected = data.playerProgress.chimarraos ?? 0;
            this.ownedItems = [...(data.playerProgress.items ?? [])];
            this.equippedItems = [...(data.playerProgress.equipped ?? this.ownedItems)];
            restorePlayerProgress(
                data.playerProgress,
                this.player.health,
                (multiplier) => this.player?.setMovementSpeedMultiplier(multiplier),
                this.upgrades
            );
        }
        createItemTextures(this);
        this.applyEquipment();
        this.unsubscribeRunTracker = runTracker.subscribe((snapshot) => {
            // Na derrota solo o checkpoint fica: TENTAR NOVAMENTE e CONTINUAR voltam ao início da sala.
            if (snapshot.status === 'RUNNING' || snapshot.status === 'LOST') return;
            if (!this.isMultiplayerEnabled()) clearCampaignProgress();
        });
        // A Sala I também é checkpoint: a partida nova começa salva no início dela.
        if (roomKey === 'room1' && !this.isMultiplayerEnabled() && runTracker.snapshot().status === 'RUNNING') {
            this.saveRoomStartCheckpoint('room1');
        }
        if (roomKey === 'room2') this.createPiranhasBarPrompt();
        if (roomKey === 'mercado-interior') this.createArcadePrompt();
        if (isTicenRoom(roomKey)) this.createTicenGate(roomKey === 'room51' ? TICEN_GATE.originalTexture : TICEN_GATE.texture);
        const secretGateway = SECRET_DUNGEON_GATEWAYS.find((gateway) => gateway.from === roomKey);
        if (secretGateway) this.createSecretEntranceHint(secretGateway);
        if (roomKey === 'room2') {
            // Por cima das placas, que ficam na frente do jogador (20).
            for (const sign of ROOM2_DUNGEON_SIGNS) {
                this.add.text(sign.x, sign.y, sign.text, { fontFamily: 'PixelGamer, monospace', fontSize: '9px', color: '#6fd8e0' })
                    .setOrigin(0.5).setResolution(4).setAlpha(0.8).setDepth(20.5);
            }
        }
        if (roomKey === 'room4') createMercadoEntranceSign(this);
        // Skatistas, comerciantes e o casal do Mercado Público; a horda espera a travessia.
        this.mercadoNpcs = roomKey === 'room4' ? new MercadoNpcs(this, !savedCombat) : undefined;
        this.createItemChest(roomKey, !savedCombat);
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
        this.roomMap = room.map;

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
        this.combat.shotMultipliers = getPlayerShotMultipliers(roomKey);
        // Os itens já foram vestidos antes do combate existir: a mão precisa ser aplicada de novo.
        this.applyEquipment();
        // No multiplayer o anfitrião decide o golem e o convidado tem um espelho que repete as ações dele.
        if (isTicenRoom(roomKey)) {
            this.golem = new TopazioGolem(
                this,
                this.player,
                room.collisionLayers,
                room.collisionLayers.find((layer) => layer.layer.name === TOPAZIO_BOSS.busLayer),
                this.getTicenBusTexture(),
                () => this.time.delayedCall(TICEN_ESCAPE.doorCutscene.delay, () => this.playBusDoorCutscene()),
                (caption) => this.playGolemCutscene(caption),
                (collected, total) => {
                    // O último topázio vale o bônus da pontuação (fórmula v4).
                    if (collected === total && runTracker.recordTopazCollection()) {
                        this.showFloatingHint(`TODOS OS TOPAZIOS +${SCORE_CONFIG.topazBonus} PONTOS`);
                        return;
                    }
                    this.showFloatingHint(`TOPAZIO ${collected}/${total}`);
                },
                {
                    mirror: this.isMultiplayerGuest(),
                    onAction: (action) => {
                        if (this.isMultiplayerHost()) multiplayerClient.sendEvent({ kind: 'boss.action', action });
                    },
                    getBusTargets: () => this.getBusTargets(),
                    onStun: () => this.playGolemCardRound()
                }
            );
        }
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
            this.finishItemChestRun(roomKey);
            if (roomKey === 'gaucho-dungeon') this.createGauchoHatPickup();
            if (this.isMultiplayerHost()) {
                this.sendEnemySnapshot();
                multiplayerClient.sendEvent({
                    kind: 'combat.complete',
                    rewardClaimed: this.dungeonState?.rewardClaimed ?? false
                });
            }
            if (shouldOfferRoomCompletionUpgrade(roomKey)) {
                this.playRoomCompletionReward(finishRoomCombat);
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
            // Quem saiu sem pegar o chapéu o encontra de novo no chão.
            if (roomKey === 'gaucho-dungeon') this.createGauchoHatPickup();
            room.openExit();
            this.activateRoomExit();
        }

        configureWorldCamera(this, room.map, this.player.sprite);
        this.normalCameraZoom = this.cameras.main.zoom;
        this.lowHealthFilter = this.cameras.main.filters.internal.addColorMatrix();
        this.input.keyboard?.on('keydown-P', this.openPauseMenu, this);
        this.input.keyboard?.on('keydown-I', this.openInventory, this);
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
            ...(this.isMultiplayerEnabled() ? { getCoopStatus: () => this.getCoopStatus() } : {}),
            getVictorySubtitle: () => this.victorySubtitle,
            getBossHealth: () => this.isGolemAwake && this.golem?.health.isAlive
                ? { title: TOPAZIO_BOSS.title, current: this.golem.health.current, max: this.golem.health.max }
                : undefined
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
        // Recomeça no início da sala do último checkpoint, com vida, build e placar daquele momento.
        const checkpoint = this.isMultiplayerEnabled() ? undefined : loadCampaignProgress();
        if (checkpoint?.run) {
            runTracker.restore(checkpoint.run);
            replaceRequestedRoomKey(checkpoint.roomKey);
            this.stopGameplayOverlays();
            this.scene.restart({
                waitForReveal: false,
                roomKey: checkpoint.roomKey,
                spawn: ROOM_DEFINITIONS[checkpoint.roomKey].spawn,
                playerProgress: checkpoint.playerProgress
            });
            return;
        }
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
        // Solo, o checkpoint da sala continua no CONTINUAR do menu.
        if (this.isMultiplayerEnabled()) clearCampaignProgress();
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
        if (this.isDuelActive && !this.isDuelOver && this.player && !this.player.health.isAlive) {
            this.loseDuel();
            return;
        }
        if (this.player && !this.player.health.isAlive && !this.canPartnerRevive()) {
            this.isGameOver = true;
            this.combat?.clear();
            this.physics.pause();
            // Solo a partida continua aberta no servidor para recomeçar do checkpoint.
            runTracker.lose(undefined, this.isMultiplayerEnabled());
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
            || this.isGatewayConfirmOpen || this.isWalletOpen || this.isClimbingLadder || this.isCutsceneActive
        ) return;
        this.player?.update(delta);
        this.updateRevive(delta);
        this.updateRoomGateway();
        this.updateArcadeCabinet();
        this.updateTicenGate();
        this.wakeGolem();
        this.updateTicenGoal();
        this.updateDuelChests();
        this.updateItemChest();
        if (this.isRoomTransitioning) return;
        this.stairClimbEffect?.update();
        if (this.isMultiplayerGuest()) {
            this.updateEnemiesFromSnapshot();
            // O espelho do golem corre o giro e o ônibus erguido deste lado, com o dano no jogador local.
            if (this.isGolemAwake) this.golem?.update(this.player, delta);
        } else {
            for (const enemy of this.drones) {
                // Congelado pelo cajado de gelo: nem anda nem persegue até derreter.
                if (this.combat?.isFrozen(enemy)) continue;
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
            // Depois da Sala III os inimigos aguentam mais; na dupla, mais ainda. A vida salva não multiplica de novo.
            const healthMultiplier = (COMBAT_CONFIG.enemyHealthMultiplierByRoom[this.activeRoomKey] ?? 1)
                * (this.isMultiplayerEnabled() ? COMBAT_CONFIG.multiplayer.enemyHealthMultiplier : 1);
            if (healthMultiplier !== 1) {
                const maxHealth = enemy.health.max * healthMultiplier;
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

    /** Todos os gaúchos do esconderijo caíram: o chapéu fica no chão, uma vez por partida. */
    private createGauchoHatPickup() {
        if (!this.player || this.ownedItems.includes('gaucho-hat')) return;
        createItemTexture(this, GAUCHO_HAT);
        const feet = this.player.sprite.body?.center ?? this.player.sprite;
        const { x, y } = this.findOpenSpotNear(feet.x, feet.y);
        const item = this.physics.add.image(x, y, GAUCHO_HAT.texture).setScale(1.5).setDepth(9);
        const label = this.createWorldHint('PEGUE O CHAPÉU').setOrigin(0, 0.5).setPosition(x + 16, y).setDepth(9);
        const pickup = this.physics.add.overlap(this.player.sprite, item, () => {
            pickup.destroy();
            item.destroy();
            label.destroy();
            this.ownedItems.push('gaucho-hat');
            this.toggleItem('gaucho-hat');
        });
    }

    /** Chão livre perto dos pés do jogador para largar um item: nada de parede, obstáculo ou vazio. */
    private findOpenSpotNear(x: number, y: number) {
        const tile = 16;
        // Em volta, a dois blocos; logo abaixo fica a espada do esconderijo.
        const offsets = [[0, -2], [2, 0], [-2, 0], [2, -2], [-2, -2], [2, 2], [-2, 2], [0, -1], [1, 0], [-1, 0], [0, -3], [3, 0], [-3, 0]];
        const isOpen = (px: number, py: number) => {
            const layers = this.roomMap?.layers ?? [];
            const blocked = this.collisionLayers.some((layer) => layer.getTileAtWorldXY(px, py)?.collides ?? false);
            const hasFloor = layers.some(({ tilemapLayer }) =>
                !!tilemapLayer && !this.collisionLayers.includes(tilemapLayer) && !!tilemapLayer.getTileAtWorldXY(px, py));
            return !blocked && (layers.length === 0 || hasFloor);
        };
        for (const [dx, dy] of offsets) {
            const px = x + dx * tile;
            const py = y + dy * tile;
            // O chapéu no chão ocupa um bloco e meio de largura.
            if ([-8, 0, 8].every((ox) => isOpen(px + ox, py))) return { x: px, y: py };
        }
        return { x, y };
    }

    /** Equipa ou retira um item; equipar tira o que estava no mesmo encaixe. */
    private toggleItem(id: ItemId) {
        if (!this.ownedItems.includes(id)) return;
        if (this.equippedItems.includes(id)) {
            this.equippedItems = this.equippedItems.filter((item) => item !== id);
        } else {
            this.equippedItems = [...this.equippedItems.filter((item) => ITEMS[item].slot !== ITEMS[id].slot), id];
        }
        this.applyEquipment();
    }

    private applyEquipment() {
        for (const id of ITEM_IDS) {
            if (this.equippedItems.includes(id)) this.player?.equipItem(id);
            else this.player?.unequipItem(id);
        }
        // O que vai na mão também muda o combate: golpe da espada flamejante e o gelo do cajado.
        this.combat?.setFlameSword(this.equippedItems.includes('flame-sword'));
        this.combat?.setIceStaff(this.equippedItems.includes('ice-staff'));
    }

    private buildInventory(): InventoryData {
        return {
            chimarraos: this.chimarraosCollected,
            characterId: this.characterId,
            items: [{
                name: 'CARTEIRA',
                texture: WALLET_UI.walletTexture,
                description: `CARTÃO GRANDE FLORIPA INTEGRADO.\nSALDO: ${formatBalance(runTracker.snapshot().score.total)}`
            }, ...this.ownedItems.map((id) => {
                const { name, texture, description, slot } = ITEMS[id];
                return { id, name, texture, description, slot, equipped: this.equippedItems.includes(id) };
            })],
            onToggleItem: (id) => {
                this.toggleItem(id);
                return this.buildInventory();
            }
        };
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
            this.chimarraosCollected += 1;
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
            // Atalho de teste das salas da campanha e do esconderijo dos gaúchos; a dungeon da Sala II fica de fora.
            event.repeat || (isDungeonRoom(this.activeRoomKey) && this.activeRoomKey !== 'gaucho-dungeon')
            || this.isMultiplayerGuest()
            || !this.isGameplayReady || this.isGameOver || this.isRoomCombatComplete || this.isCutsceneActive
        ) return;
        if (this.room3CardCode.push(event.key)) {
            if (this.activeRoomKey === 'room3') {
                this.grantRandomStrongCard();
                return;
            }
            // Na Sala V, cada 8080 tira 10% da vida máxima do golem, para testar estágios, ônibus e cutscene.
            if (this.golem?.health.isAlive) {
                this.golem.takeDamage(this.golem.health.max * 0.1);
                return;
            }
        }
        if (!this.roomClearCode.push(event.key)) return;

        this.combat?.clear();
        for (const enemy of this.drones) {
            if (enemy.health.isAlive) enemy.takeDamage(enemy.health.current);
        }
        // Elimina só a horda atual: o fluxo normal segue para as cartas e a próxima horda,
        // e depois da última, para a conclusão da sala.
        if (this.waves) {
            this.waves.skipCurrentWave();
            return;
        }
        // Sem hordas em andamento, o atalho conclui a sala como antes.
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
        if (!isTicenRoom(this.activeRoomKey) || !this.player) return;
        const center = this.player.sprite.body?.center ?? this.player.sprite;
        if (this.isTicenGateOpen) {
            // Passou para dentro do terminal: a catraca fecha atrás, e quem vem depois passa o próprio cartão.
            if (center.y < TICEN_GATE.y - TICEN_GATE.passedMargin) this.closeTicenGateBehind();
            return;
        }
        // Quem já entrou no terminal não passa o cartão de novo.
        if (this.hasPassedTicenGate) return;
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

    /** O golem dorme até o jogador passar a catraca e subir para a Plataforma D; só então entra no combate. */
    private wakeGolem() {
        // No multiplayer quem acorda o golem é o anfitrião, quando qualquer um dos dois sobe depois da catraca.
        if (!this.golem || this.isGolemAwake || !this.player || this.isMultiplayerGuest()) return;
        const local = this.player.sprite.body?.center ?? this.player.sprite;
        const partner = [...this.remotePlayers.values()][0]?.feet;
        const isLocalUp = this.hasPassedTicenGate && local.y <= TOPAZIO_BOSS.wakeY;
        const isPartnerUp = this.hasPartnerPassedTicenGate && !!partner && partner.y <= TOPAZIO_BOSS.wakeY;
        if (!isLocalUp && !isPartnerUp) return;
        if (this.isMultiplayerHost()) multiplayerClient.sendEvent({ kind: 'boss.wake' });
        this.awakenGolem();
    }

    /** Entra no combate e mostra a barra; no convidado chega pelo aviso do anfitrião. */
    private awakenGolem() {
        if (!this.golem || this.isGolemAwake) return;
        this.isGolemAwake = true;
        this.drones.push(this.golem);
        this.combat?.registerEnemy(this.golem);
        this.cameras.main.shake(400, 0.008);
    }

    /** Cutscenes dos 70% e dos 40%: congela a luta, a câmera vai até o golem, ele ruge e a câmera volta ao jogador. */
    private playGolemCutscene(caption: string) {
        const golem = this.golem;
        if (!golem) return;
        const { duration, zoom } = TOPAZIO_BOSS.roar;
        this.playCutscene(golem.sprite, caption, duration, zoom, () => golem.playRoar(duration));
    }

    /** Textura dos ônibus do TICEN na sala atual: cores originais na Sala V, paleta cyberpunk na 51. */
    private getTicenBusTexture() {
        return ROOM_DEFINITIONS[this.activeRoomKey].tilesets.find(({ mapName }) => mapName === 'ticen_onibus')?.textureKey ?? 'ticen_onibus';
    }

    /** Depois do golem: a câmera vai até o 763.2, as portas abrem e um feixe de luz chama o jogador. */
    private playBusDoorCutscene() {
        const { door, doorCutscene } = TICEN_ESCAPE;
        const focus = { x: door.x + door.width / 2, y: door.y + door.height };
        this.playCutscene(focus, doorCutscene.caption, doorCutscene.hold, doorCutscene.zoom, () => this.openBusDoor());
    }

    private openBusDoor() {
        const { x, y, width, height } = TICEN_ESCAPE.door;
        // Depois do ônibus (camada de colisão) e antes dos personagens (10).
        const light = this.add.rectangle(x, y, width, height, 0xfff2b0).setOrigin(0).setDepth(3);
        const half = width / 2;
        const left = this.add.rectangle(x, y, half, height, 0x283446).setOrigin(0).setDepth(3.1);
        const right = this.add.rectangle(x + width, y, half, height, 0x283446).setOrigin(1, 0).setDepth(3.1);
        this.tweens.add({ targets: [left, right], scaleX: 0, duration: 500, ease: 'Quad.easeInOut' });
        // Feixe de luz saindo da porta até o chão da faixa: fica pulsando para guiar o jogador.
        const beam = this.add.graphics().setDepth(9).setBlendMode(1).setAlpha(0);
        const bottom = y + height;
        for (const [spread, alpha] of [[16, 0.12], [9, 0.18], [3, 0.28]] as const) {
            beam.fillStyle(0xfff2b0, alpha).beginPath().moveTo(x, y).lineTo(x + width, y)
                .lineTo(x + width + spread, bottom + 30).lineTo(x - spread, bottom + 30).closePath().fillPath();
        }
        beam.fillStyle(0xfff2b0, 0.25).fillEllipse(x + width / 2, bottom + 30, width + 40, 14);
        this.tweens.add({ targets: beam, alpha: 1, duration: 500, delay: 300 });
        this.tweens.add({ targets: beam, alpha: 0.55, duration: 900, delay: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.busDoorObjects = [light, left, right, beam];
        this.isBusDoorOpen = true;
    }

    /** Congela a luta, leva a câmera até `focus` com faixas de cinema, roda `onFocus` e volta ao jogador. */
    private playCutscene(
        focus: Readonly<{ x: number; y: number }>,
        caption: string,
        duration: number,
        zoom: number,
        onFocus: () => void,
        onDone: () => void = () => undefined
    ) {
        const player = this.player;
        if (!player) return;
        const { panTime } = TOPAZIO_BOSS.roar;
        const camera = this.cameras.main;
        const bars = new CinematicBarsView(this.scene.get('CombatHud') as Scene, caption);
        this.isCutsceneActive = true;
        player.stopMovement();
        this.physics.pause();
        bars.show(panTime);
        camera.stopFollow();
        camera.pan(focus.x, focus.y, panTime, 'Sine.easeInOut');
        camera.zoomTo(this.normalCameraZoom * zoom, panTime, 'Sine.easeInOut');
        this.time.delayedCall(panTime, onFocus);
        this.time.delayedCall(panTime + duration, () => {
            bars.hide(panTime);
            camera.pan(player.sprite.x, player.sprite.y, panTime, 'Sine.easeInOut');
            camera.zoomTo(this.normalCameraZoom, panTime, 'Sine.easeInOut');
        });
        this.time.delayedCall(panTime * 2 + duration, () => {
            camera.startFollow(player.sprite, true, WORLD_CONFIG.camera.lerpX, WORLD_CONFIG.camera.lerpY);
            this.isCutsceneActive = false;
            if (!this.isPauseMenuOpen && !this.isGameOver) this.physics.resume();
            onDone();
        });
    }

    /** Embarcar no 763.2 via Kobrasol encerra a partida com vitória, depois de derrubar o golem. */
    private updateTicenGoal() {
        if (!isTicenRoom(this.activeRoomKey) || !this.player || this.isGameOver) return;
        // Com o golem na sala, o embarque só abre depois da cutscene das portas.
        if (this.golem && (this.golem.health.isAlive || !this.isBusDoorOpen)) return;
        const { x, y } = this.player.sprite.body?.center ?? this.player.sprite;
        const { left, right, top, bottom } = TICEN_GOAL;
        const isAtDoor = x >= left && x <= right && y >= top && y <= bottom;
        // Em dupla, a porta pergunta se cada um quer fugir; só depois dos dois SIM vem a reviravolta.
        // Se o parceiro saiu da partida, vale o final solo.
        const partner = [...this.remotePlayers.values()][0];
        if (this.golem && partner) {
            const isLocalOut = !this.player.health.isAlive && this.getRevivesLeft() === 0;
            const isPartnerOut = !partner.isAlive && partner.revivesLeft === 0;
            if (!isLocalOut && !isPartnerOut) {
                this.updateEscapeVote(isAtDoor);
                return;
            }
            // Quem caiu sem renascimentos não vota: o outro embarca sozinho e ele é deixado para trás.
            const boarder = isPartnerOut ? { x, y } : partner.feet;
            if (boarder.x < left || boarder.x > right || boarder.y < top || boarder.y > bottom) return;
            this.isDuelOver = true;
            this.playDuelEnding(isPartnerOut);
            return;
        }
        if (!isAtDoor) return;
        this.isGameOver = true;
        this.combat?.clear();
        this.physics.pause();
        if (this.golem) {
            this.playBusEnding();
            return;
        }
        void runTracker.win(undefined, !this.isMultiplayerGuest());
    }

    /** Final solo: senta dentro do 763.2, a tela escurece e o ônibus sai do TICEN; depois vem a vitória. */
    private playBusEnding() {
        const player = this.player;
        if (!player) return;
        player.stopMovement();
        const ending = new BusEndingView(this.scene.get('CombatHud') as Scene, player.sprite.texture.key);
        ending.play(() => this.playBusDeparture(ending, () => void runTracker.win(undefined, !this.isMultiplayerGuest())));
    }

    /** O 763.2 sai do TICEN soltando fumaça, com a tela clareando depois do interior. */
    private playBusDeparture(ending: BusEndingView, onDone: () => void) {
        const player = this.player;
        if (!player) return;
        {
            const { bus, departure } = TICEN_ESCAPE;
            const { frameWidth, frameHeight, tilesWide, tilesHigh } = TOPAZIO_BOSS.bus;
            const layer = this.collisionLayers.find((candidate) => candidate.layer.name === TOPAZIO_BOSS.busLayer);
            for (let dy = 0; dy < tilesHigh; dy += 1) {
                for (let dx = 0; dx < tilesWide; dx += 1) layer?.removeTileAt(bus.col + dx, bus.row + dy);
            }
            const texture = this.getTicenBusTexture();
            const image = this.add.image(bus.col * 16 + frameWidth / 2, bus.row * 16 + frameHeight / 2, texture,
                getBusFrame(this, texture, bus.route)).setDepth(3);
            player.sprite.setVisible(false);
            for (const object of this.busDoorObjects) object.destroy();
            const camera = this.cameras.main;
            camera.stopFollow();
            camera.setZoom(this.normalCameraZoom).centerOn(image.x - 80, image.y);
            ending.reveal();
            // Fumaça do escapamento enquanto arranca para a direita, até sair do terminal.
            this.time.addEvent({ delay: 140, repeat: 10, callback: () => {
                const puff = this.add.circle(image.x - frameWidth / 2, image.y + 14, 4, 0x8a8f99, 0.7).setDepth(3.2);
                this.tweens.add({ targets: puff, x: puff.x - 18, y: puff.y - 10, scale: 2.4, alpha: 0, duration: 700, onComplete: () => puff.destroy() });
            } });
            this.tweens.add({
                targets: image,
                x: image.x + departure.distance,
                duration: departure.duration,
                ease: 'Quad.easeIn',
                onComplete: onDone
            });
        }
    }

    /** Na porta do 763.2 cada um decide se quer fugir; o SIM fica de pé até o parceiro decidir também. */
    private updateEscapeVote(isAtDoor: boolean) {
        if (!this.player?.health.isAlive || this.isDuelActive || this.isDuelOver || this.hasVotedEscape) return;
        if (!isAtDoor) {
            this.isEscapeVoteArmed = true;
            return;
        }
        if (!this.isEscapeVoteArmed) return;
        this.isEscapeVoteArmed = false;
        this.isGatewayConfirmOpen = true;
        this.player.stopMovement();
        this.physics.pause();
        const data: ConfirmPromptData = {
            title: TICEN_DUEL.question,
            onChoice: (confirmed) => {
                this.isGatewayConfirmOpen = false;
                if (!this.isCutsceneActive) this.physics.resume();
                if (!confirmed) return;
                this.hasVotedEscape = true;
                if (this.isMultiplayerHost()) this.checkEscapeVotes();
                else multiplayerClient.sendEvent({ kind: 'escape.vote' });
            }
        };
        this.scene.launch('ConfirmPrompt', data);
        this.scene.bringToTop('ConfirmPrompt');
    }

    /** O anfitrião começa a reviravolta quando os dois disseram SIM. */
    private checkEscapeVotes() {
        if (!this.hasVotedEscape || !this.hasPartnerVotedEscape || this.isDuelActive) return;
        multiplayerClient.sendEvent({ kind: 'escape.duel' });
        this.playDriverCutscene();
    }

    /** O motorista desce, avisa que só cabe um, volta e fecha a porta; depois começa a disputa. */
    private playDriverCutscene() {
        if (this.isDuelActive) return;
        this.isDuelActive = true;
        const { door, doorCutscene } = TICEN_ESCAPE;
        const focus = { x: door.x + door.width / 2, y: door.y + door.height };
        this.playCutscene(focus, TICEN_DUEL.caption, TICEN_DUEL.driver.cutscene, doorCutscene.zoom,
            () => this.playDriver(focus), () => this.startDuel());
    }

    private playDriver(door: Readonly<{ x: number; y: number }>) {
        const { texture, speech, cutscene } = TICEN_DUEL.driver;
        const driver = this.add.sprite(door.x, door.y - 4, texture, 0).setOrigin(0.5, 1).setDepth(getActorDepth(door.y + 24)).setAlpha(0);
        this.tweens.add({ targets: driver, alpha: 1, y: door.y + 22, duration: 600, ease: 'Quad.easeOut' });
        // À esquerda do motorista: a porta fica rente à borda do mapa e o alto da tela é do HUD.
        const bubble = this.createSpeechBubble(door.x - 12, door.y + 6, speech).setVisible(false);
        this.time.delayedCall(700, () => {
            driver.setFrame(1);
            bubble.setVisible(true);
            this.cameras.main.shake(200, 0.004);
        });
        this.time.delayedCall(cutscene - 1200, () => {
            bubble.destroy();
            driver.setFrame(0);
            this.tweens.add({ targets: driver, y: door.y - 4, alpha: 0, duration: 600, onComplete: () => driver.destroy() });
        });
        this.time.delayedCall(cutscene - 400, () => this.closeBusDoor());
    }

    /** Balão de fala branco à esquerda de quem fala, com a ponta apontando para ele em (x, y). */
    private createSpeechBubble(x: number, y: number, text: string) {
        const label = this.add.text(0, 0, text, {
            fontFamily: 'PixelGamer, monospace',
            fontSize: '9px',
            color: '#101018',
            align: 'center',
            wordWrap: { width: 120 }
        }).setOrigin(0.5).setResolution(4);
        const width = label.width + 14;
        const height = label.height + 10;
        const left = -width - 8;
        const box = this.add.graphics();
        box.fillStyle(0xffffff).fillRoundedRect(left, -height / 2, width, height, 5);
        box.lineStyle(1, 0x101018).strokeRoundedRect(left, -height / 2, width, height, 5);
        box.fillStyle(0xffffff).fillTriangle(-9, -5, -9, 5, 0, 0);
        label.setPosition(left + width / 2, 0);
        return this.add.container(x, y, [box, label]).setDepth(22);
    }

    /** A porta do 763.2 fecha e a luz some: ninguém embarca até a disputa acabar. */
    private closeBusDoor() {
        this.isBusDoorOpen = false;
        const objects = this.busDoorObjects;
        this.busDoorObjects = [];
        this.tweens.add({ targets: objects, alpha: 0, duration: 300, onComplete: () => objects.forEach((object) => object.destroy()) });
    }

    /** Fim do motorista: cada um vai para o seu extremo, passa o close de duelo e só então a luta começa. */
    private startDuel() {
        if (!this.player || this.isDuelOver) return;
        this.teleportToDuelCorner();
        this.playDuelStandoff(() => this.beginDuelFight());
    }

    /** Close de faroeste nos olhos dos dois antes da luta; o jogo fica parado enquanto passa. */
    private playDuelStandoff(onDone: () => void) {
        const player = this.player;
        if (!player) return;
        const partner = [...this.remotePlayers.values()][0];
        const textures = [player.sprite.texture.key, partner?.sprite.texture.key ?? player.sprite.texture.key] as const;
        this.isCutsceneActive = true;
        player.stopMovement();
        this.physics.pause();
        new DuelStandoffView(this.scene.get('CombatHud') as Scene, textures).play(() => {
            this.isCutsceneActive = false;
            if (!this.isPauseMenuOpen && !this.isGameOver) this.physics.resume();
            onDone();
        });
    }

    /** Depois do close: a dupla perde as cartas, pega a espada e o anfitrião solta os gaúchos e os baús. */
    private beginDuelFight() {
        if (!this.player || this.isDuelOver) return;
        this.upgrades.reset();
        this.combat?.enterSwordDuel();
        const partner = [...this.remotePlayers.values()][0];
        partner?.holdSword();
        if (this.combat && partner) {
            this.combat.duelTarget = {
                center: partner.feet,
                isAlive: () => partner.isAlive && !this.isDuelOver,
                hit: (damage) => this.hitRival(damage)
            };
        }
        this.showFloatingHint(TICEN_DUEL.start);
        if (!this.isMultiplayerHost()) return;
        const { enemies, chest } = TICEN_DUEL;
        this.duelTimers.push(
            this.time.addEvent({ delay: enemies.interval, repeat: enemies.count - 1, callback: () => this.spawnDuelEnemy() }),
            this.time.addEvent({ delay: chest.interval, loop: true, callback: () => this.spawnDuelChest() })
        );
    }

    /** A espada acerta o parceiro: o dano vai para o cliente dele, que é quem manda na própria vida. */
    private hitRival(damage: number) {
        multiplayerClient.sendEvent({ kind: 'player.damage', amount: damage });
        if (this.time.now < this.lifestealUntil) this.player?.health.heal(1);
    }

    /** Um piso livre dentro do terminal, longe dos dois jogadores e fora da porta do 763.2. */
    private findTicenFloorPoint(minDistance: number) {
        const map = this.roomMap;
        if (!map) return undefined;
        const people = [this.player?.sprite.body?.center, ...[...this.remotePlayers.values()].map((partner) => partner.feet)]
            .filter((point): point is { x: number; y: number } => !!point);
        const { left, right, top, bottom } = TICEN_GOAL;
        for (let attempt = 0; attempt < 80; attempt += 1) {
            const tileX = 2 + Math.floor(Math.random() * (map.width - 4));
            const tileY = 7 + Math.floor(Math.random() * 27);
            const point = { x: tileX * 16 + 8, y: tileY * 16 + 14 };
            if (!this.isTicenTileFree(map, tileX, tileY)) continue;
            if (point.x > left - 24 && point.x < right + 24 && point.y > top - 24 && point.y < bottom + 24) continue;
            if (people.some((person) => Math.hypot(person.x - point.x, person.y - point.y) < minDistance)) continue;
            return point;
        }
        return undefined;
    }

    /** O baú e quem pisa ali sobem um tile a partir do pé: o tile, os vizinhos e o de cima precisam estar livres. */
    private isTicenTileFree(map: Phaser.Tilemaps.Tilemap, tileX: number, tileY: number) {
        const area = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]];
        return !area.some(([dx, dy]) => this.collisionLayers.some((layer) => layer.getTileAt(tileX + dx, tileY + dy)?.collides))
            && !area.some(([dx, dy]) => map.hasTileAt(tileX + dx, tileY + dy, 'itens-topo'));
    }

    /** Pé no chão livre mais perto do ponto, procurando em anéis cada vez maiores até 6 tiles. */
    private findTicenFloorNear(x: number, y: number) {
        const map = this.roomMap;
        if (!map) return undefined;
        const centerX = Math.floor(x / 16);
        const centerY = Math.floor(y / 16);
        for (let ring = 0; ring <= 6; ring += 1) {
            for (let dy = -ring; dy <= ring; dy += 1) {
                for (let dx = -ring; dx <= ring; dx += 1) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
                    if (this.isTicenTileFree(map, centerX + dx, centerY + dy)) return { x: (centerX + dx) * 16 + 8, y: (centerY + dy) * 16 + 14 };
                }
            }
        }
        return undefined;
    }

    /** Começo da disputa: cada um vai para um extremo do terminal, o anfitrião num e o convidado no outro. */
    private teleportToDuelCorner() {
        const body = this.player?.sprite.body as Phaser.Physics.Arcade.Body | null | undefined;
        if (!this.player || !body) return;
        const corner = TICEN_DUEL.corners[this.isMultiplayerHost() ? 0 : 1];
        const feet = this.findTicenFloorNear(corner.x, corner.y);
        if (!feet) return;
        // O ponto achado é o do pé; o sprite fica acima dele na mesma distância que o corpo tem do sprite agora.
        const x = feet.x - (body.center.x - this.player.sprite.x);
        const y = feet.y - (body.center.y - this.player.sprite.y);
        this.player.sprite.setPosition(x, y);
        body.reset(x, y);
        if (!prefersReducedMotion()) this.cameras.main.flash(250, 255, 255, 255);
    }

    /** Roda no anfitrião: um gaúcho de espada entra na disputa e vai atrás de quem estiver mais perto. */
    private spawnDuelEnemy() {
        const point = this.findTicenFloorPoint(110);
        if (!point || this.isDuelOver) return;
        const spawn = { x: point.x, y: point.y, patrolLeft: point.x - 16, patrolRight: point.x + 16 };
        const enemy = this.createEnemy('gaucho', spawn);
        enemy.relentless = true;
        for (const layer of this.collisionLayers) this.physics.add.collider(enemy.sprite, layer);
        this.addEnemyToCombat(enemy);
        multiplayerClient.sendEvent({
            kind: 'enemy.spawn',
            enemies: [{ kind: 'gaucho', ...spawn, health: enemy.health.current, maxHealth: enemy.health.max }]
        });
    }

    /** Roda no anfitrião: um baú brilhando aparece com o próximo especial da lista. */
    private spawnDuelChest() {
        const point = this.findTicenFloorPoint(70);
        if (!point || this.isDuelOver) return;
        const id = ++this.duelChestSequence;
        const { specials } = TICEN_DUEL;
        const special = specials[(id - 1) % specials.length].id;
        multiplayerClient.sendEvent({ kind: 'chest.spawn', id, x: point.x, y: point.y, special });
        this.placeDuelChest(id, point.x, point.y, special);
    }

    /** Brilho extra para achar o baú de longe: halo dourado no chão, um facho de luz subindo e faíscas. */
    private addChestGlow(image: Phaser.GameObjects.Sprite) {
        const { x, y } = image;
        const glow = this.add.graphics().setDepth(getActorDepth(y) - 0.001).setBlendMode(1);
        for (const [radius, alpha] of [[26, 0.12], [17, 0.2], [9, 0.32]] as const) {
            glow.fillStyle(0xffd75a, alpha).fillEllipse(x, y - 2, radius * 2, radius);
        }
        glow.fillStyle(0xfff2b0, 0.16).fillRect(x - 5, y - 70, 10, 66);
        glow.fillStyle(0xfff2b0, 0.22).fillRect(x - 2, y - 70, 4, 66);
        this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.45 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: image, scale: { from: 1, to: 1.15 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const sparks = this.time.addEvent({ delay: 220, loop: true, callback: () => {
            if (!glow.active) {
                sparks.remove();
                return;
            }
            const spark = this.add.rectangle(x + (Math.random() - 0.5) * 18, y - 8, 2, 2, 0xfff2b0).setDepth(getActorDepth(y) + 0.01).setBlendMode(1);
            this.tweens.add({ targets: spark, y: spark.y - 26, alpha: 0, duration: 800, onComplete: () => spark.destroy() });
        } });
        return glow;
    }

    /** Baú de item da sala: trancado até o combate terminar no tempo; quem já tem o item o encontra aberto. */
    private createItemChest(roomKey: RoomKey, isFreshRoom: boolean) {
        this.itemChest = undefined;
        const config = ITEM_CHESTS[roomKey];
        if (!config) return;
        if (isFreshRoom) this.itemChestRuns.set(roomKey, { startedAt: runTracker.snapshot().elapsedTimeMs, unlocked: false, claimed: false });
        const { x, y } = config;
        const image = this.add.sprite(x, y, TICEN_DUEL.chest.texture, 0).setOrigin(0.5, 1).setDepth(getActorDepth(y));
        // Já pego nesta partida, ou nada na lista que o jogador ainda não tenha: o baú fica aberto.
        if (this.itemChestRuns.get(roomKey)?.claimed || getChestCandidates(config.items, this.ownedItems).length === 0) {
            image.setFrame(1);
            return;
        }
        const hint = this.createWorldHint(
            `COMPLETE A ${config.roomName} EM ${formatElapsedTime(config.timeLimitMs)}\nPARA DESBLOQUEAR UM ITEM`
        ).setAlign('center').setPosition(x, y - 32).setVisible(false);
        this.itemChest = { image: image.setTint(0x7a7a8c), hint, roomKey };
        if (this.itemChestRuns.get(roomKey)?.unlocked) this.unlockItemChest();
    }

    /** O combate da sala acabou: dentro do tempo, o baú destranca e passa a brilhar. */
    private finishItemChestRun(roomKey: RoomKey, random = Math.random) {
        const run = this.itemChestRuns.get(roomKey);
        const config = ITEM_CHESTS[roomKey];
        if (!run || !config) return;
        run.unlocked = runTracker.snapshot().elapsedTimeMs - run.startedAt <= config.timeLimitMs;
        // O sorteio sai na hora de destrancar e fica guardado: voltar do esconderijo não troca o item.
        const candidates = getChestCandidates(config.items, this.ownedItems);
        if (run.unlocked) run.item = candidates[Math.floor(random() * candidates.length)];
        if (run.unlocked && this.itemChest) {
            this.unlockItemChest();
            this.showFloatingHint('BAÚ DESBLOQUEADO');
        }
    }

    private unlockItemChest() {
        const chest = this.itemChest;
        if (!chest || chest.glow) return;
        chest.image.clearTint();
        chest.hint.setVisible(false);
        chest.glow = this.addChestGlow(chest.image);
    }

    /** Trancado, o baú explica o desafio a quem chega perto; destrancado, basta encostar para vestir o item. */
    private updateItemChest() {
        const chest = this.itemChest;
        if (!chest || !this.player) return;
        const feet = this.player.sprite.body?.center ?? this.player.sprite;
        const distance = Math.hypot(feet.x - chest.image.x, feet.y - (chest.image.y - 6));
        const { touchRadius } = TICEN_DUEL.chest;
        if (!chest.glow) {
            chest.hint.setVisible(distance <= touchRadius * 2);
            return;
        }
        if (distance > touchRadius) return;
        this.itemChest = undefined;
        this.tweens.killTweensOf(chest.image);
        chest.image.setFrame(1).setScale(1);
        chest.glow.destroy();
        chest.hint.destroy();
        const run = this.itemChestRuns.get(chest.roomKey);
        const item = run?.item;
        if (run) run.claimed = true;
        if (!item) return;
        this.equipFoundItem(item);
        this.showFloatingHint(ITEMS[item].name);
    }

    private placeDuelChest(id: number, x: number, y: number, special: DuelSpecialId) {
        const image = this.add.sprite(x, y, TICEN_DUEL.chest.texture, 0).setOrigin(0.5, 1).setDepth(getActorDepth(y));
        const glow = this.addChestGlow(image);
        playExplosion(this, x, y - 6, 14, 0xfff2b0);
        this.duelChests.set(id, { image, glow, special, opened: false, claimed: false });
    }

    /** Basta encostar: o anfitrião abre na hora; o convidado pede, e o anfitrião diz quem chegou primeiro. */
    private updateDuelChests() {
        if (!this.isDuelActive || this.isDuelOver || !this.player?.health.isAlive) return;
        const feet = this.player.sprite.body?.center ?? this.player.sprite;
        for (const [id, chest] of this.duelChests) {
            if (chest.opened || chest.claimed) continue;
            if (Math.hypot(feet.x - chest.image.x, feet.y - (chest.image.y - 6)) > TICEN_DUEL.chest.touchRadius) continue;
            chest.claimed = true;
            if (this.isMultiplayerHost()) this.openDuelChest(id, true);
            else multiplayerClient.sendEvent({ kind: 'chest.claim', id });
        }
    }

    /** Só o anfitrião decide: o primeiro pedido vale, os outros chegam com o baú já aberto. */
    private openDuelChest(id: number, byHost: boolean) {
        const chest = this.duelChests.get(id);
        if (!chest || chest.opened) return;
        multiplayerClient.sendEvent({ kind: 'chest.opened', id, byHost });
        this.revealDuelChest(id, byHost);
    }

    private revealDuelChest(id: number, byHost: boolean) {
        const chest = this.duelChests.get(id);
        if (!chest || chest.opened) return;
        chest.opened = true;
        this.tweens.killTweensOf(chest.image);
        chest.image.setFrame(1).setScale(1);
        this.tweens.killTweensOf(chest.glow);
        this.tweens.add({ targets: chest.glow, alpha: 0, duration: 400, onComplete: () => chest.glow.destroy() });
        const label = TICEN_DUEL.specials.find(({ id: special }) => special === chest.special)?.label ?? '';
        const hint = this.createWorldHint(label).setPosition(chest.image.x, chest.image.y - 22);
        this.tweens.add({ targets: hint, y: hint.y - 14, alpha: 0, delay: 900, duration: 600, onComplete: () => hint.destroy() });
        this.tweens.add({ targets: chest.image, alpha: 0, delay: 700, duration: 400, onComplete: () => chest.image.destroy() });
        if (byHost === this.isMultiplayerHost()) this.applyDuelSpecial(chest.special);
    }

    private applyDuelSpecial(special: DuelSpecialId) {
        const player = this.player;
        const combat = this.combat;
        if (!player || !combat) return;
        const { speed, shieldDuration, lifestealDuration, spin, clubMultiplier } = TICEN_DUEL;
        switch (special) {
            case 'heart':
                player.health.increaseMax(COMBAT_CONFIG.player.healthPerHeart);
                break;
            case 'helmet':
                this.equipFoundItem('helmet');
                break;
            case 'boots':
                this.equipFoundItem('rubber-boots');
                break;
            case 'silver-boots':
            case 'diamond-boots':
            case 'ice-staff':
                this.equipFoundItem(special);
                break;
            case 'club':
                combat.swordDamageMultiplier *= clubMultiplier;
                break;
            case 'speed':
                player.setTemporaryMovementSpeedMultiplier(speed.multiplier);
                this.time.delayedCall(speed.duration, () => this.player?.setTemporaryMovementSpeedMultiplier(1));
                break;
            case 'shield':
                player.grantInvulnerability(shieldDuration);
                player.sprite.setTint(0x8fd8ff);
                this.time.delayedCall(shieldDuration, () => this.player?.sprite.clearTint());
                break;
            case 'lifesteal':
                this.lifestealUntil = this.time.now + lifestealDuration;
                break;
            case 'spin':
                combat.swordFullCircle = true;
                combat.swordRangeMultiplier = spin.rangeMultiplier;
                this.time.delayedCall(spin.duration, () => {
                    combat.swordFullCircle = false;
                    combat.swordRangeMultiplier = 1;
                });
                break;
        }
    }

    /** Item achado vai para o inventário e já entra no corpo, trocando o que estiver no mesmo lugar. */
    private equipFoundItem(id: ItemId) {
        if (!this.ownedItems.includes(id)) this.ownedItems.push(id);
        this.equippedItems = [...this.equippedItems.filter((item) => ITEMS[item].slot !== ITEMS[id].slot), id];
        this.applyEquipment();
    }

    /** Quem caiu avisa o parceiro: ele fica com a vaga. */
    private loseDuel() {
        if (this.isDuelOver) return;
        this.isDuelOver = true;
        multiplayerClient.sendEvent({ kind: 'duel.lost' });
        this.playDuelEnding(false);
    }

    /**
     * Fim da disputa, igual nas duas telas: quem perdeu morre, a porta do 763.2 reabre, o vencedor entra e
     * senta (a cutscene do solo) e o ônibus vai embora. Quem perdeu vê que foi deixado para trás.
     */
    private playDuelEnding(localWon: boolean) {
        const player = this.player;
        // Sem parceiro (saiu no meio da disputa) só existe o vencedor na tela.
        const partner = [...this.remotePlayers.values()][0];
        if (!player) return;
        for (const timer of this.duelTimers) timer.remove(false);
        this.duelTimers = [];
        this.isGameOver = true;
        this.combat?.clear();
        if (this.isMultiplayerHost()) {
            for (const enemy of this.drones) {
                if (enemy !== this.golem && enemy.health.isAlive) enemy.takeDamage(enemy.health.current);
            }
        }
        player.stopMovement();
        this.physics.pause();
        const loser = localWon ? partner?.sprite : player.sprite;
        const winner = localWon ? player.sprite : partner?.sprite ?? player.sprite;
        if (loser) this.playDeathAnimation(loser);
        const { deathTime, boardTime } = TICEN_DUEL;
        const { door } = TICEN_ESCAPE;
        const doorFeet = { x: door.x + door.width / 2, y: door.y + door.height + 12 };
        this.time.delayedCall(deathTime, () => {
            const camera = this.cameras.main;
            camera.stopFollow();
            camera.pan(doorFeet.x, doorFeet.y, 500, 'Sine.easeInOut');
            camera.zoomTo(this.normalCameraZoom * TICEN_ESCAPE.doorCutscene.zoom, 500, 'Sine.easeInOut');
            if (!this.isBusDoorOpen) this.openBusDoor();
            // O vencedor anda até a porta na própria tela; o parceiro vê pelo estado dele.
            if (localWon) {
                this.tweens.add({ targets: player.sprite, x: doorFeet.x, y: doorFeet.y, duration: boardTime * 0.7, ease: 'Sine.easeInOut' });
                this.tweens.add({ targets: player.sprite, alpha: 0, delay: boardTime * 0.7, duration: boardTime * 0.3 });
            }
        });
        this.time.delayedCall(deathTime + boardTime + 300, () => {
            const ending = new BusEndingView(this.scene.get('CombatHud') as Scene, winner.texture.key);
            ending.play(() => this.playBusDeparture(ending, () => {
                this.victorySubtitle = localWon ? undefined : TICEN_DUEL.leftBehind;
                void runTracker.win(undefined, !this.isMultiplayerGuest());
            }));
        });
    }

    /** Morte de quem perdeu: clarão vermelho, tomba e se desfaz. */
    private playDeathAnimation(sprite: Phaser.GameObjects.Sprite) {
        sprite.setTint(0xff4060);
        this.cameras.main.shake(300, 0.008);
        playExplosion(this, sprite.x, sprite.y, 22, 0xff4060);
        this.tweens.add({ targets: sprite, angle: 90, y: sprite.y + 8, duration: 350, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: sprite, alpha: 0.35, delay: 400, duration: 700 });
    }

    /** Luz verde, braço girando e passagem livre: some o bloqueio invisível da catraca. */
    private openTicenGate() {
        this.isTicenGateOpen = true;
        this.ticenGateHint?.setVisible(false);
        const { openFrameDuration, railLayer, row, widenCols } = TICEN_GATE;
        this.playTicenGateFrames([1, 2, 3]);
        this.time.delayedCall(openFrameDuration * 2, () => {
            // A máquina continua sólida; a passagem abre na grade dos dois lados dela.
            const rails = this.collisionLayers.find((layer) => layer.layer.name === railLayer);
            this.ticenRailTiles = widenCols.flatMap((col) => {
                const tile = rails?.removeTileAt(col, row);
                return tile ? [tile] : [];
            });
        });
    }

    /** Quem passou entra no terminal e a catraca volta a fechar a passagem, avisando o parceiro. */
    private closeTicenGateBehind() {
        this.isTicenGateOpen = false;
        this.hasPassedTicenGate = true;
        const rails = this.collisionLayers.find((layer) => layer.layer.name === TICEN_GATE.railLayer);
        for (const tile of this.ticenRailTiles) rails?.putTileAt(tile, tile.x, tile.y);
        this.ticenRailTiles = [];
        this.playTicenGateFrames([2, 1, 0]);
        if (this.isMultiplayerEnabled()) multiplayerClient.sendEvent({ kind: 'ticen.gate' });
    }

    /** O parceiro passou a catraca dele: aqui ela só gira e fecha, sem abrir a passagem. */
    private playPartnerTicenGate() {
        this.hasPartnerPassedTicenGate = true;
        if (this.isTicenGateOpen) return;
        this.playTicenGateFrames([1, 2, 3, 3, 2, 1, 0]);
    }

    private playTicenGateFrames(frames: readonly number[]) {
        frames.forEach((frame, index) => {
            this.time.delayedCall(TICEN_GATE.openFrameDuration * index, () => this.ticenGate?.setFrame(frame));
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
        runTracker.pauseClock();
        state.arcadeAttempts += 1;
        const data: ArcadeMinigameData = {
            attemptsLeft: arcadeAttemptsLeft(state),
            onFinish: (won, played) => {
                this.isArcadeOpen = false;
                this.physics.resume();
                runTracker.resumeClock();
                if (!played) state.arcadeAttempts -= 1;
                if (!won) return;
                state.arcadeWon = true;
                runTracker.recordArcadeWin();
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
            const leave = () => this.transitionToRoom(returnGateway.from, {
                spawn: returnGateway.returnSpawn,
                dungeonState: this.dungeonState
            });
            this.passSecretGateway(returnGateway.confirm?.exit, () => {
                if (this.activeRoomKey === 'gaucho-dungeon') this.climbSewerLadder(leave);
                else leave();
            });
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

    /** Sobe a escada do bueiro antes de voltar para a Sala I. */
    private climbSewerLadder(leave: () => void) {
        if (!this.player || !this.dungeonReturnArea || this.isClimbingLadder) return;
        this.isClimbingLadder = true;
        this.combat?.clear();
        this.player.climbInPlace();
        // A trava só sai quando a próxima sala recria a cena: no multiplayer, o convidado espera o anfitrião.
        climbSewerLadder(this, this.player.sprite, this.dungeonReturnArea, leave);
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
        const playerProgress = capturePlayerProgress(this.player, this.upgrades, this.chimarraosCollected, this.ownedItems, this.equippedItems);
        const checkpointRooms: readonly RoomKey[] = ['room1', 'room2', 'room3', 'room4', 'room5', 'dungeon'];
        if (!this.isMultiplayerEnabled() && checkpointRooms.includes(roomKey)) {
            // Todo início de sala é checkpoint; a dungeon é uma rota secreta da fase 2.
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
            if (!enemy.health.isAlive || enemy.kind === 'golem') return [];
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

    /** Sair pelo menu mantém o checkpoint do início da sala; o progresso dentro dela não é salvo. */
    saveContinuation() {
        if (this.isMultiplayerEnabled() || !this.player || !loadCampaignProgress()) return false;
        this.combat?.clear();
        return true;
    }

    private saveRoomStartCheckpoint(roomKey: RoomKey) {
        if (!this.player) return;
        saveCampaignProgress({
            roomKey,
            playerProgress: capturePlayerProgress(this.player, this.upgrades, this.chimarraosCollected, this.ownedItems, this.equippedItems),
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
        // Cada sala sorteia da sua mesa (BASIC/AREA/ROOM3 em catalog.ts), de novo a cada escolha.
        const drawCards = () => drawTableCards(getCardTable(this.activeRoomKey), undefined, this.upgrades.availableCards());
        const finish = () => this.waitForPartnerCard(() => {
            new WaveThreatView(overlayScene, this.cameras.main).play(() => {
                this.isWaveIntermissionOpen = false;
                if (this.isGameplayReady && !this.isGameOver) this.physics.resume();
                resume();
            });
        });
        // Cada mesa é sorteada depois da escolha anterior, para não repetir a carta que subiu de nível.
        const picks = getIntermissionCardPicks(this.activeRoomKey);
        const choose = (pick: number) => {
            const options = picks > 1 ? { hint: `Escolha ${pick} de ${picks}` } : {};
            new UpgradeSelectionView(overlayScene, drawCards(), options).play((selected) => {
                this.acquireUpgrade(selected);
                if (pick < picks) choose(pick + 1);
                else finish();
            });
        };
        choose(1);
    }

    /** Golem atordoado em 60%: cinco cartas que o jogador ainda não pegou. O atordoamento só conta depois da escolha. */
    private playGolemCardRound() {
        const acquired = this.upgrades.exportProgress().map(([id]) => id);
        const cards = drawGolemCards(acquired, undefined, this.upgrades.availableCards());
        this.cardBarrier.open();
        // Sem carta nova para oferecer, ainda conta como escolhida: no multiplayer o parceiro espera as duas escolhas.
        // Caído também escolhe: a carta vale quando ele levantar, e a dupla não fica travada.
        if (cards.length === 0) {
            this.waitForPartnerCard(() => undefined);
            return;
        }
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;
        const overlayScene = this.scene.get('CombatHud') as Scene;
        new UpgradeSelectionView(overlayScene, cards, { title: 'GOLEM ATORDOADO', hint: 'Escolha uma carta e aproveite' }).play((selected) => {
            this.acquireUpgrade(selected);
            this.waitForPartnerCard(() => {
                this.isWaveIntermissionOpen = false;
                if (this.isGameplayReady && !this.isGameOver && !this.isPauseMenuOpen) this.physics.resume();
            });
        });
    }

    /** Oferece uma escolha depois da onda final e só então libera a saída da sala. */
    private playRoomCompletionReward(onComplete: () => void) {
        this.cardBarrier.open();
        this.combat?.clear();
        this.physics.pause();
        this.isWaveIntermissionOpen = true;
        this.piranhasBarPrompt?.setVisible(false);

        const overlayScene = this.scene.get('CombatHud') as Scene;
        const isRoom3 = this.activeRoomKey === 'room3';
        new UpgradeSelectionView(
            overlayScene,
            drawTableCards(isRoom3 ? 'room3-final' : getCardTable(this.activeRoomKey), undefined, this.upgrades.availableCards()),
            {
                title: isRoom3 ? 'SALA III CONCLUÍDA' : 'SALA I CONCLUÍDA',
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
            drawTableCards(getCardTable(this.activeRoomKey), undefined, this.upgrades.availableCards()),
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
        this.input.keyboard?.off('keydown-I', this.openInventory, this);
        this.input.off('pointerdown', this.handleSwordPointer, this);
        this.input.keyboard?.off('keydown-G', this.openPiranhasMenu, this);
        this.input.keyboard?.off('keydown', this.handleSecretCodeKey, this);
        this.events.off(Phaser.Scenes.Events.RESUME, this.resetPauseMenuState, this);
    }

    private openInventory() {
        this.openPauseMenu('inventory');
    }

    private openPauseMenu(view: PauseMenuData['view'] = 'pause') {
        if (
            !this.isGameplayReady || this.isPauseMenuOpen || this.isPiranhasMenuOpen
            || this.isWaveIntermissionOpen || this.isArcadeOpen || this.isGatewayConfirmOpen || this.isWalletOpen
            || this.isClimbingLadder || this.isCutsceneActive || !this.player?.health.isAlive
        ) return;

        this.isPauseMenuOpen = true;
        const data: PauseMenuData = {
            upgrades: this.upgrades.exportProgress(),
            view,
            inventory: this.buildInventory()
        };
        this.scene.launch('PauseMenu', data);
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
            onPlayerSwing: (x, y, angle, flame) => multiplayerClient.sendEvent({ kind: 'player.swing', x, y, angle, flame }),
            onPlayerEffect: (effect) => multiplayerClient.sendEvent({ kind: 'player.effect', ...effect }),
            onEnemyHit: (enemy, damage, direction) => multiplayerClient.sendEvent({
                kind: 'enemy.hit',
                index: this.drones.indexOf(enemy),
                damage,
                dx: direction.x,
                dy: direction.y
            }),
            onEnemyFreeze: (enemy, duration) => multiplayerClient.sendEvent({
                kind: 'enemy.hit',
                index: this.drones.indexOf(enemy),
                damage: 0,
                dx: 0,
                dy: 0,
                freeze: duration
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
            companion: cardsActive && this.upgrades.companionCount > 0,
            worn: encodeWornItems(this.equippedItems)
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
        // Na disputa pela vaga ninguém levanta o outro.
        if (!this.player || !this.isMultiplayerEnabled() || this.isDuelActive) return;
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
        if (this.hasVotedEscape && !this.isDuelActive) message = TICEN_DUEL.waiting;
        else if (this.cardBarrier.isWaitingForPeer || this.cardRelease) message = 'AGUARDANDO O PARCEIRO ESCOLHER...';
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

    /** Jogadores vivos com o id da partida, igual nos dois clientes: o golem alterna os ônibus entre eles. */
    private getBusTargets(): BusTarget[] {
        const targets: BusTarget[] = [];
        if (this.player?.health.isAlive) {
            targets.push({ id: multiplayerClient.playerId ?? 'local', center: this.player.sprite.body?.center ?? this.player.sprite });
        }
        for (const [id, partner] of this.remotePlayers) {
            if (partner.target.health.isAlive) targets.push({ id, center: partner.target.sprite.body.center });
        }
        return targets;
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
            // O golem afina na horizontal quando gira; os outros inimigos não mandam escala.
            if (row[5] !== undefined) enemy.sprite.setScale(row[5], 1);
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
        this.hasVotedEscape = false;
        // Quem abandona a disputa perde a vaga para quem ficou.
        if (this.isDuelActive && !this.isDuelOver) {
            this.isDuelOver = true;
            this.playDuelEnding(true);
            return;
        }
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
                for (const partner of this.remotePlayers.values()) partner.hideSwordFor(COMBAT_CONFIG.melee.swingDuration);
                this.combat?.playPartnerSwing(event.x, event.y, event.angle, event.flame === true);
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
            case 'ticen.gate':
                this.playPartnerTicenGate();
                break;
            case 'boss.wake':
                this.awakenGolem();
                break;
            case 'boss.action':
                this.golem?.applyRemoteAction(event.action);
                break;
            case 'escape.vote':
                this.hasPartnerVotedEscape = true;
                if (this.isMultiplayerHost()) this.checkEscapeVotes();
                break;
            case 'escape.duel':
                this.playDriverCutscene();
                break;
            case 'chest.spawn':
                this.placeDuelChest(event.id, event.x, event.y, event.special);
                break;
            case 'chest.claim':
                if (this.isMultiplayerHost()) this.openDuelChest(event.id, false);
                break;
            case 'chest.opened':
                this.revealDuelChest(event.id, event.byHost);
                break;
            case 'duel.lost':
                if (this.isDuelOver) break;
                this.isDuelOver = true;
                this.playDuelEnding(true);
                break;
            case 'world.ready':
                break;
        }
    }

    private applyPartnerHit(event: Extract<CoopEvent, { kind: 'enemy.hit' }>) {
        const enemy = this.drones[event.index];
        // O gelo vale dos dois lados: no anfitrião o inimigo para de verdade; no convidado aparece congelado.
        if (enemy && typeof event.freeze === 'number' && event.freeze > 0) {
            this.combat?.freezeEnemy(enemy, Math.min(event.freeze, COMBAT_CONFIG.iceStaff.freezeDuration));
        }
        if (!this.isMultiplayerHost() || !enemy?.health.isAlive || event.damage <= 0) return;
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
