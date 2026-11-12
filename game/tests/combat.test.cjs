const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const ts = require('typescript');

// Usa a geometria e a resolução de overlaps reais do Phaser, sem DOM/WebGL.
const phaserRoot = path.dirname(require.resolve('phaser/package.json'));
const ArcadeWorld = require(path.join(phaserRoot, 'src/physics/arcade/World'));
const ArcadeBody = require(path.join(phaserRoot, 'src/physics/arcade/Body'));
const phaser = {
    Scene: require(path.join(phaserRoot, 'src/scene/Scene')),
    Physics: { Arcade: { Body: ArcadeBody } },
    Math: { Linear: (start, end, amount) => start + (end - start) * amount },
    Animations: { Events: require(path.join(phaserRoot, 'src/animations/events')) },
    Geom: {
        Line: require(path.join(phaserRoot, 'src/geom/line/Line')),
        Rectangle: require(path.join(phaserRoot, 'src/geom/rectangle/Rectangle')),
        Intersects: { LineToRectangle: require(path.join(phaserRoot, 'src/geom/intersects/LineToRectangle')) }
    }
};
const modules = new Map();
function load(relative) {
    const filename = path.resolve(__dirname, relative);
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(
        (name) => name === 'phaser' ? phaser : load(path.resolve(path.dirname(filename), `${name}.ts`)),
        module, module.exports
    );
    modules.set(filename, module.exports);
    return module.exports;
}
const { Health } = load('../src/game/combat/Health.ts');
const { CombatSystem, createProjectileId } = load('../src/game/combat/CombatSystem.ts');
const {
    COMBAT_CONFIG,
    getPlayerShotMultipliers,
    getWaveEnemyKinds,
    ROOM2_STAIR_GUARD_SPAWNS
} = load('../src/game/config/combat.ts');
const { WORLD_CONFIG } = load('../src/game/config/world.ts');
const { Drone } = load('../src/game/entities/Drone.ts');
const { isShieldedHit } = load('../src/game/entities/GuardaCyber.ts');
const {
    createReachableDroneSpawns,
    DroneWaves,
    selectDroneSpawns,
    selectDroneSpawnsWithPriority
} = load('../src/game/combat/DroneWaves.ts');
const {
    drawTableCards,
    drawUpgradeCards,
    drawUpgradeCardsFeaturing,
    getTableCards
} = load('../src/game/upgrades/drawUpgradeCards.ts');
const {
    getUpgradeCard,
    AREA_UPGRADE_IDS,
    ROOM3_EXCLUSIVE_UPGRADE_IDS,
    ROOM3_UPGRADE_IDS,
    UPGRADE_CARDS
} = load('../src/game/upgrades/catalog.ts');
const { PlayerUpgradeState } = load('../src/game/upgrades/PlayerUpgradeState.ts');
const {
    capturePlayerProgress,
    restorePlayerProgress
} = load('../src/game/progress/PlayerProgress.ts');
const {
    clearCampaignProgress,
    loadCampaignProgress,
    saveCampaignProgress
} = load('../src/game/progress/CampaignProgress.ts');
const {
    createMainMenuActions,
    createPlayMenuActions
} = load('../src/game/ui/MainMenuView.ts');
const { MENU_CONFIG, getMenuLayout } = load('../src/game/config/menu.ts');
const { getHeartFillLevels } = load('../src/game/ui/HeartHealthView.ts');
const { getPauseUpgradeEntries } = load('../src/game/ui/PauseMenuView.ts');
const { MusicDirector } = load('../src/game/audio/MusicDirector.ts');
const {
    getStairProgress,
    toStairPassageArea
} = load('../src/game/map/StairPassage.ts');
const {
    isInsidePiranhasBarArea,
    PIRANHAS_BAR_CONFIG,
    PIRANHAS_BAR_ITEMS
} = load('../src/game/config/piranhasBar.ts');
const {
    getRequestedRoomKey,
    getRoomSearch,
    ROOM_DEFINITIONS
} = load('../src/game/config/rooms.ts');
const {
    isInsideRoomGateway,
    isTouchingDungeonReturn,
    isTouchingSecretDungeonEntrance,
    ROOM1_TO_GAUCHO_DUNGEON_GATEWAY,
    ROOM1_TO_ROOM2_GATEWAY,
    ROOM2_TO_DUNGEON_GATEWAY,
    ROOM2_TO_ROOM3_GATEWAY,
    ROOM_EXIT_GATEWAYS
} = load('../src/game/config/roomGateway.ts');
const {
    generateDungeonLayout,
    getDungeonObstacleTiles,
    isDungeonBoundaryWall,
    isDungeonWall
} = load('../src/game/map/ProceduralDungeon.ts');
const {
    createDungeonSessionState,
    DUNGEON_WAVE_ENEMY_COUNT
} = load('../src/game/config/dungeon.ts');
const { ROOM_EXIT_LIGHT_STYLE } = load('../src/game/map/RoomExitPortal.ts');
const { LAMP_LIGHT_TEXTURE } = load('../src/game/map/createLampLights.ts');
const { ROOM_CLEAR_CODE, SecretCodeMatcher } = load('../src/game/config/secretCodes.ts');
const { getInitialSceneRoute } = load('../src/game/scenes/Preloader.ts');
const {
    calculateDamagePoints,
    calculateMultiKillBonus,
    calculateScore,
    calculateTimePoints
} = load('../src/game/scoring/ScoreCalculator.ts');
const { RunTracker, runTracker } = load('../src/game/scoring/RunTracker.ts');
const { SCORE_CONFIG } = load('../src/game/config/score.ts');

test('pontuação v4 aplica dungeon, tempo, dano, mortes, multi-kill e vitória', () => {
    const score = calculateScore({
        won: true,
        dungeonsCompleted: 1,
        elapsedTimeMs: 12_999,
        enemiesDefeated: 3,
        hitsTaken: 0,
        multiKillBonuses: [calculateMultiKillBonus(3)]
    });
    assert.deepEqual(score, {
        victoryPoints: 1_000,
        dungeonPoints: 1_000,
        timePoints: 5_880,
        enemyPoints: 300,
        multiKillPoints: 350,
        damagePoints: 2_000,
        arcadePoints: 0,
        topazPoints: 0,
        total: 10_530
    });
    assert.equal(calculateTimePoints(900_000), 0);
    assert.equal(calculateDamagePoints(1), 1_200);
    assert.equal(calculateDamagePoints(2), 600);
    assert.equal(calculateDamagePoints(3), 0);
});

test('tracker deduplica mortes, acertos e fechamento do mesmo projétil', () => {
    const tracker = new RunTracker();
    tracker.startNew('SINGLE_PLAYER', new Date('2026-01-01T00:00:00.000Z'));
    tracker.registerProjectile('shot-1');
    assert.equal(tracker.recordEnemyDeath('enemy-1', 'shot-1'), true);
    assert.equal(tracker.recordEnemyDeath('enemy-1', 'shot-1'), false);
    assert.equal(tracker.recordEnemyDeath('enemy-2', 'shot-1'), true);
    assert.equal(tracker.finalizeProjectile('shot-1'), 250);
    assert.equal(tracker.finalizeProjectile('shot-1'), 0);
    assert.equal(tracker.recordPlayerHit(0), false);
    assert.equal(tracker.recordPlayerHit(1), true);
    const snapshot = tracker.snapshot(Date.parse('2026-01-01T00:00:10.000Z'));
    assert.equal(snapshot.enemiesDefeated, 2);
    assert.equal(snapshot.hitsTaken, 1);
    assert.equal(snapshot.multiKills.length, 1);
    assert.equal(snapshot.score.total, 450, 'tempo e dano entram apenas ao terminar');
    const finalSnapshot = tracker.lose(new Date('2026-01-01T00:00:10.000Z'));
    assert.equal(finalSnapshot.score.total, 7_550);
});

test('tracker concede uma vez o bônus de cada dungeon e preserva no checkpoint', () => {
    const tracker = new RunTracker();
    tracker.startNew('SINGLE_PLAYER', new Date('2026-01-01T00:00:00.000Z'));
    assert.equal(tracker.recordDungeonCompletion('dungeon'), true);
    assert.equal(tracker.recordDungeonCompletion('dungeon'), false);
    assert.equal(tracker.snapshot().score.dungeonPoints, 1_000);

    const restored = new RunTracker();
    restored.restore(tracker.checkpoint());
    assert.equal(restored.recordDungeonCompletion('dungeon'), false);
    assert.equal(restored.recordDungeonCompletion('gaucho-dungeon'), true);
    assert.equal(restored.snapshot().score.dungeonPoints, 2_000);
});

test('conclusão de sala pontua apenas as dungeons', () => {
    const { recordRoomCompletionScore } = load('../src/game/scenes/World.ts');
    runTracker.startNew('SINGLE_PLAYER');
    assert.equal(recordRoomCompletionScore('room1'), false);
    assert.equal(runTracker.snapshot().score.dungeonPoints, 0);
    assert.equal(recordRoomCompletionScore('dungeon'), true);
    assert.equal(recordRoomCompletionScore('dungeon'), false);
    assert.equal(recordRoomCompletionScore('gaucho-dungeon'), true);
    assert.equal(runTracker.snapshot().score.dungeonPoints, 2_000);
    runTracker.abandon();
});

test('projéteis continuam únicos depois da troca de sala', () => {
    const room1Projectile = createProjectileId('same-run');
    const room2Projectile = createProjectileId('same-run');
    assert.notEqual(room1Projectile, room2Projectile);

    const tracker = new RunTracker();
    tracker.startNew('SINGLE_PLAYER', new Date('2026-01-01T00:00:00.000Z'));
    tracker.recordEnemyDeath('room1-enemy', room1Projectile);
    tracker.finalizeProjectile(room1Projectile);
    tracker.recordEnemyDeath('room2-enemy', room2Projectile);
    tracker.finalizeProjectile(room2Projectile);
    const snapshot = tracker.snapshot();
    assert.equal(snapshot.enemiesDefeated, 2);
    assert.equal(snapshot.score.enemyPoints, 200);
});

test('run inicia com zero e recebe o bônus de tempo somente ao terminar', () => {
    const tracker = new RunTracker();
    tracker.startNew('SINGLE_PLAYER', new Date('2026-01-01T00:00:00.000Z'));
    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).score.total, 0);
    const result = tracker.lose(new Date('2026-01-01T00:00:05.000Z'));
    assert.equal(result.score.timePoints, 5_950);
    assert.equal(result.score.total, 7_950);
});

test('código secreto reconhece 9090 mesmo após teclas anteriores', () => {
    const matcher = new SecretCodeMatcher(ROOM_CLEAR_CODE);
    assert.equal(matcher.push('1'), false);
    assert.equal(matcher.push('9'), false);
    assert.equal(matcher.push('0'), false);
    assert.equal(matcher.push('9'), false);
    assert.equal(matcher.push('0'), true);
    assert.equal(matcher.push('0'), false, 'o código deve ser consumido após ativar');
});

test('room2 possui entrada oficial no centro da via vertical', () => {
    assert.deepEqual(ROOM_DEFINITIONS.room2.spawn, { x: 184, y: 536 });
    assert.equal(ROOM_DEFINITIONS.room2.title, 'Sala II:\nO Antigo Terminal');
});

test('rota direta preserva parametros e aponta para a room2', () => {
    assert.equal(getRequestedRoomKey('?room=2'), 'room2');
    assert.equal(getRoomSearch('room2', '?debug=1'), '?debug=1&room=2');
    assert.equal(getRoomSearch('room1', '?debug=1&room=2'), '?debug=1');
});

test('recarregar com room2 inicia diretamente a transição da Sala II', () => {
    assert.deepEqual(getInitialSceneRoute('?room=2'), {
        key: 'RoomTransition',
        data: { roomKey: 'room2' }
    });
    assert.deepEqual(getInitialSceneRoute(''), {
        key: 'MainMenu',
        data: undefined
    });
});

test('portal ocupa somente o corredor liberado no topo da room1', () => {
    const { area, portal } = ROOM1_TO_ROOM2_GATEWAY;
    assert.equal(ROOM1_TO_ROOM2_GATEWAY.from, 'room1');
    assert.equal(ROOM1_TO_ROOM2_GATEWAY.to, 'room2');
    assert.equal(isInsideRoomGateway(portal.x, portal.y), true);
    assert.equal(isInsideRoomGateway(area.left, area.bottom), true);
    assert.equal(isInsideRoomGateway(area.left - 1, portal.y), false);
    assert.equal(isInsideRoomGateway(area.right + 1, portal.y), false);
    assert.equal(isInsideRoomGateway(portal.x, area.bottom + 1), false);
});

test('entrada secreta exige encostar na parede final do Terminal Velho', () => {
    const { area } = ROOM2_TO_DUNGEON_GATEWAY;
    const x = (area.left + area.right) / 2;
    const y = (area.top + area.bottom) / 2;
    assert.equal(isTouchingSecretDungeonEntrance(x, y, false), false);
    assert.equal(isTouchingSecretDungeonEntrance(x, y, true), true);
    assert.equal(isTouchingSecretDungeonEntrance(area.left - 1, y, true), false);
    assert.equal(isTouchingSecretDungeonEntrance(x, area.bottom + 1, true), false);
});

test('dungeon procedural é determinística, cercada e mantém a entrada conectada', () => {
    const first = generateDungeonLayout(0x12345678);
    const second = generateDungeonLayout(0x12345678);
    const variation = generateDungeonLayout(0x87654321);
    assert.deepEqual(first.walls, second.walls);
    assert.deepEqual(first.obstacles, second.obstacles);
    assert.notDeepEqual(first.walls, variation.walls);
    assert.equal(first.obstacles.length, 12);
    assert.ok(first.obstacles.every(({ x, y, variant }) =>
        !isDungeonWall(first, x, y) && variant >= 0 && variant < 8));
    assert.ok(first.obstacles.every((obstacle, index) =>
        first.obstacles.slice(index + 1).every((other) =>
            Math.hypot(obstacle.x - other.x, obstacle.y - other.y) >= 3)));
    assert.ok(first.obstacles.some((obstacle) => getDungeonObstacleTiles(obstacle).length > 1));
    assert.ok(first.obstacles.every((obstacle) => getDungeonObstacleTiles(obstacle).every(({ x, y }) =>
        !isDungeonWall(first, x, y))));

    for (let x = 0; x < first.width; x += 1) {
        assert.equal(isDungeonWall(first, x, 0), true);
        assert.equal(isDungeonWall(first, x, first.height - 1), true);
    }
    for (let y = 0; y < first.height; y += 1) {
        assert.equal(isDungeonWall(first, 0, y), true);
        assert.equal(isDungeonWall(first, first.width - 1, y), true);
    }

    const start = {
        x: Math.floor(first.spawn.x / 16),
        y: Math.floor(first.spawn.y / 16)
    };
    const visited = new Set([start.y * first.width + start.x]);
    const pending = [start];
    for (let index = 0; index < pending.length; index += 1) {
        const current = pending[index];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const x = current.x + dx;
            const y = current.y + dy;
            const key = y * first.width + x;
            if (visited.has(key) || isDungeonWall(first, x, y)) continue;
            visited.add(key);
            pending.push({ x, y });
        }
    }
    assert.ok(visited.size > 300);
    assert.ok([...visited].some((key) => key % first.width >= first.width - 6));
    const renderedWalls = [];
    for (let y = 0; y < first.height; y += 1) {
        for (let x = 0; x < first.width; x += 1) {
            if (isDungeonBoundaryWall(first, x, y)) renderedWalls.push({ x, y });
        }
    }
    assert.ok(renderedWalls.length > 0);
    assert.ok(renderedWalls.length < first.walls.filter(Boolean).length);
    assert.ok(renderedWalls.every(({ x, y }) => isDungeonWall(first, x, y)));
    assert.equal(isTouchingDungeonReturn(
        first.returnArea.left,
        (first.returnArea.top + first.returnArea.bottom) / 2,
        first.returnArea
    ), true);
});

test('dungeon sempre oferece pontos alcançáveis para sua onda', () => {
    // As três primeiras seeds tinham um corredor fechado por obstáculo e não criavam a onda.
    const seeds = [399851389, 217003655, 3393303098, ...Array.from({ length: 32 }, (_, index) => (index + 1) * 7919)];
    for (const seed of seeds) {
        const layout = generateDungeonLayout(seed);
        const grid = {
            width: layout.width,
            height: layout.height,
            tileWidth: 16,
            tileHeight: 16
        };
        const obstacleTiles = new Set(layout.obstacles.flatMap(getDungeonObstacleTiles)
            .map(({ x, y }) => y * layout.width + x));
        const spawns = createReachableDroneSpawns(
            grid,
            (x, y) => isDungeonWall(layout, x, y)
                || obstacleTiles.has(y * layout.width + x),
            layout.spawn
        );
        assert.doesNotThrow(() => selectDroneSpawns(
            DUNGEON_WAVE_ENEMY_COUNT,
            layout.spawn,
            spawns
        ), `seed ${seed}`);
    }
});

test('sair pela rota secreta guarda drones vivos, ondas restantes e o item do bar', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const waves = new DroneWaves(() => {}, () => {}, (resume) => resume(), [10, 20]);
    waves.update([]);
    const alive = fighter(100, 200, 60);
    Object.assign(alive.sprite, { x: 100, y: 200 });
    alive.takeDamage(20);
    const dead = fighter(300, 200, 60);
    dead.takeDamage(60);
    world.activeRoomKey = 'room2';
    world.dungeonState = createDungeonSessionState(0x12345678);
    world.drones = [alive, dead];
    world.waves = waves;
    world.hasSelectedPiranhasItem = true;

    world.rememberCombatProgress();

    assert.equal(world.dungeonState.seed, 0x12345678);
    assert.equal(world.dungeonState.piranhasItemConsumed, true);
    assert.deepEqual(world.dungeonState.savedCombat.room2, {
        enemies: [{
            kind: 'drone',
            x: 100,
            y: 200,
            health: 40,
            patrolLeft: 84,
            patrolRight: 116
        }],
        pendingWaves: [20],
        hordeRemaining: 0,
        cleared: false
    });
});

test('ondas misturam drones, patinetes e guardas sem alterar a quantidade', () => {
    const room1FirstWave = getWaveEnemyKinds('room1', 0, 10);
    const room1SecondWave = getWaveEnemyKinds('room1', 1, 20);
    const room2FirstWave = getWaveEnemyKinds('room2', 0, 10);
    const dungeonWave = getWaveEnemyKinds('dungeon', 0, DUNGEON_WAVE_ENEMY_COUNT);

    assert.equal(room1FirstWave.length, 10);
    assert.deepEqual(new Set(room1FirstWave), new Set(['drone']));
    assert.deepEqual(new Set(room1SecondWave), new Set(['drone', 'scooter', 'guard']));
    assert.deepEqual(room2FirstWave.slice(0, 2), ['guard', 'guard']);
    assert.deepEqual(new Set(dungeonWave), new Set(['drone', 'scooter', 'guard']));
});

test('escudo do guarda reduz somente impactos recebidos pela frente', () => {
    assert.equal(isShieldedHit('left', { x: 1, y: 0 }), true);
    assert.equal(isShieldedHit('left', { x: -1, y: 0 }), false);
    assert.equal(isShieldedHit('up', { x: 0, y: 1 }), true);
    assert.equal(isShieldedHit('up', { x: 1, y: 0 }), false);
});

test('saida da room1 usa um halo circular centralizado e exige entrar no corredor', () => {
    const { area, portal } = ROOM1_TO_ROOM2_GATEWAY;
    assert.equal(ROOM_EXIT_LIGHT_STYLE.texture, LAMP_LIGHT_TEXTURE);
    assert.ok(ROOM_EXIT_LIGHT_STYLE.spillScale > ROOM_EXIT_LIGHT_STYLE.mainScale);
    assert.ok(ROOM_EXIT_LIGHT_STYLE.mainAlpha > ROOM_EXIT_LIGHT_STYLE.spillAlpha);
    assert.equal(portal.x, (area.left + area.right) / 2);
    assert.equal(area.bottom, 2 * 16);
    assert.equal(portal.y, 0.25 * 16);
});

test('cardápio do Piranhas usa três itens e seus assets individuais', () => {
    assert.equal(PIRANHAS_BAR_ITEMS.length, 3);
    assert.equal(PIRANHAS_BAR_ITEMS.find((item) => item.id === 'cookie-magico').description, '???');
    for (const filename of [
        'cookie-magico-transparent.png',
        'gin-de-10-melancia-transparent.png',
        'gin-de-10-tropical-transparent.png'
    ]) {
        assert.equal(existsSync(path.resolve(__dirname, `../public/assets/items/piranhas-bar/${filename}`)), true);
    }
});

test('interação do Piranhas funciona somente na calçada em frente ao bar', () => {
    const area = PIRANHAS_BAR_CONFIG.interactionArea;
    assert.equal(isInsidePiranhasBarArea((area.left + area.right) / 2, area.bottom), true);
    assert.equal(isInsidePiranhasBarArea(area.left - 1, area.bottom), false);
    assert.equal(isInsidePiranhasBarArea(area.right + 1, area.bottom), false);
    assert.equal(isInsidePiranhasBarArea((area.left + area.right) / 2, area.top - 1), false);
    assert.equal(isInsidePiranhasBarArea((area.left + area.right) / 2, area.bottom + 1), false);
});

test('itens do Piranhas aplicam velocidade, coração extra e efeito do cookie', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const health = new Health(4);
    let speedMultiplier = 1;
    let controlsInverted = false;
    let resumes = 0;
    world.player = {
        health,
        setMovementSpeedMultiplier(value) { speedMultiplier = value; },
        getMovementSpeedMultiplier() { return speedMultiplier; },
        setControlsInverted(value) { controlsInverted = value; }
    };
    world.physics = { resume() { resumes++; } };
    world.time = { now: 2_000 };
    world.isGameplayReady = true;

    world.consumePiranhasItem(PIRANHAS_BAR_ITEMS.find((item) => item.id === 'gin-tropical'));
    assert.equal(speedMultiplier, PIRANHAS_BAR_CONFIG.tropicalSpeedMultiplier);

    world.consumePiranhasItem(PIRANHAS_BAR_ITEMS.find((item) => item.id === 'gin-melancia'));
    assert.equal(health.max, 6);
    assert.equal(health.current, 6);

    world.consumePiranhasItem(PIRANHAS_BAR_ITEMS.find((item) => item.id === 'cookie-magico'));
    assert.equal(controlsInverted, true);
    assert.equal(world.nauseaEndsAt, 2_000 + PIRANHAS_BAR_CONFIG.nauseaDuration);
    assert.equal(resumes, 3);
});

test('efeito da escada progride do pé até o patamar superior', () => {
    const area = toStairPassageArea(16, 16);
    const centerX = (area.left + area.right) / 2;
    assert.equal(getStairProgress(centerX, area.bottom, area), 0);
    assert.equal(getStairProgress(centerX, area.top, area), 1);
    assert.equal(getStairProgress(centerX, (area.top + area.bottom) / 2, area), 0.5);
    assert.equal(getStairProgress(area.left - 1, area.top, area), null);
});

function fighter(x, y, maxHealth, id = 'fighter') {
    const health = new Health(maxHealth);
    return {
        id, health, sprite: {
            active: true,
            body: { center: { x, y } },
            destroy() { this.active = false; this.body = null; }
        },
        takeDamage(amount) { health.takeDamage(amount); }
    };
}
function setup(positions = [[150, 100]], wallTiles = [], upgrades = new PlayerUpgradeState(), tracker, melee = false) {
    const player = fighter(100, 100, COMBAT_CONFIG.player.maxHealth, 'player');
    const drones = positions.map(([x, y], index) =>
        fighter(x, y, COMBAT_CONFIG.drone.maxHealth, `enemy-${index}`));
    const groups = [];
    const colliders = [];
    const overlaps = [];
    const physicsWorld = new ArcadeWorld({ sys: { scale: { width: 800, height: 640 } } }, { useTree: false });
    const attachBody = (sprite, x, y) => {
        sprite.body = new ArcadeBody(physicsWorld);
        sprite.body.gameObject = sprite;
        sprite.body.position.set(x - 4, y - 4);
        sprite.body.setSize(8, 8, false);
    };
    for (const actor of [player, ...drones]) {
        const { x, y } = actor.sprite.body.center;
        attachBody(actor.sprite, x, y);
    }
    const damageLabels = [];
    const companions = [];
    const rings = [];
    const effects = [];
    const scene = {
        sound: { play() {} },
        tweens: { add() {} },
        add: {
            image() {
                return {
                    setOrigin() { return this; },
                    setDepth() { return this; },
                    setRotation() { return this; },
                    setScale() { return this; },
                    setPosition() { return this; },
                    setVisible() { return this; },
                    destroy() {}
                };
            },
            sprite(x, y, texture, frame) {
                const companion = {
                    x, y, texture, frame,
                    setScale(value) { this.scale = value; return this; },
                    setTint(value) { this.color = value; return this; },
                    setDepth(value) { this.depth = value; return this; },
                    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; }
                };
                companions.push(companion);
                return companion;
            },
            circle(x, y, radius) {
                const circle = {
                    x, y, radius,
                    setStrokeStyle() { return this; },
                    setDepth() { return this; },
                    setScale() { return this; },
                    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
                    setBlendMode() { return this; },
                    setVisible() { return this; },
                    destroy() {}
                };
                rings.push(circle);
                return circle;
            },
            graphics() {
                // Registra o que os efeitos em área desenham, sem renderizar nada.
                const layer = { circles: [], lines: 0 };
                for (const method of ['setDepth', 'setBlendMode', 'setPosition', 'setScale', 'setRotation', 'fillStyle', 'lineStyle', 'fillCircle', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fillPath', 'clear', 'lineBetween', 'destroy']) {
                    layer[method] = function () { return this; };
                }
                layer.strokeCircle = function (_x, _y, radius) { this.circles.push(radius); return this; };
                layer.lineBetween = function () { this.lines += 1; return this; };
                effects.push(layer);
                return layer;
            },
            text(x, y, text) {
                const label = {
                    x, y, text, active: true,
                    setOrigin() { return this; },
                    setDepth() { return this; },
                    destroy() { this.active = false; }
                };
                damageLabels.push(label);
                return label;
            }
        },
        textures: { exists: () => true },
        physics: {
            world: { bounds: new phaser.Geom.Rectangle(0, 0, 800, 640) },
            add: {
                group() {
                    const group = {
                        isParent: true, physicsType: 0, collisionCategory: 1, collisionMask: 1,
                        shots: [],
                        getLength() { return this.shots.length; },
                        getChildren() { return this.shots; },
                        create(x, y) {
                            const shot = {
                                x, y, active: true,
                                setDepth() { return this; },
                                setTint(color) { this.color = color; return this; },
                                setScale(value) { this.scale = value; return this; },
                                setRotation(value) { this.rotation = value; return this; },
                                setBodySize(width, height) { this.body.setSize(width, height, false); return this; },
                                setVelocity(x, y) { this.velocity = { x, y }; return this; },
                                destroy() { this.active = false; this.body.enable = false; }
                            };
                            attachBody(shot, x, y);
                            this.shots.push(shot);
                            return shot;
                        }
                    };
                    groups.push(group);
                    return group;
                },
                collider(group, wall, callback) { colliders.push({ group, wall, callback }); },
                overlap(object1, object2, callback) {
                    const target = object1.isParent ? object2 : object1;
                    overlaps.push({
                        hit(shot) {
                            shot.body.position.copy(target.body.position);
                            shot.body.updateCenter();
                            physicsWorld.overlap(object1, object2, callback);
                        }
                    });
                }
            }
        }
    };
    const walls = [{ getTilesWithinWorldXY: () => wallTiles }];
    const combat = new CombatSystem(scene, player, drones, walls, upgrades, tracker, undefined, melee);
    return { combat, player, drones, groups, colliders, overlaps, attachBody, damageLabels, companions, rings, effects };
}

test('vida diminui, não cura com dano negativo e não fica abaixo de zero', () => {
    const health = new Health(100);
    health.takeDamage(30);
    health.takeDamage(-20);
    assert.equal(health.current, 70);
    health.takeDamage(200);
    assert.equal(health.current, 0);
    assert.equal(health.isAlive, false);

    const expandableHealth = new Health(4);
    expandableHealth.takeDamage(2);
    expandableHealth.increaseMax(2, 2);
    assert.equal(expandableHealth.max, 6);
    assert.equal(expandableHealth.current, 4);
});

test('corações representam vida cheia, meia vida e vida perdida', () => {
    assert.deepEqual(getHeartFillLevels(4, 4), [1, 1]);
    assert.deepEqual(getHeartFillLevels(3, 4), [1, 0.5]);
    assert.deepEqual(getHeartFillLevels(1, 4), [0.5, 0]);
    assert.deepEqual(getHeartFillLevels(0, 4), [0, 0]);
    assert.deepEqual(getHeartFillLevels(5, 6), [1, 1, 0.5]);
});

test('drone usa os atributos padrão do personagem com metade do dano', () => {
    for (const stat of ['maxHealth', 'range', 'fireInterval', 'projectileSpeed']) {
        assert.equal(COMBAT_CONFIG.drone[stat], COMBAT_CONFIG.player[stat]);
    }
    assert.equal(COMBAT_CONFIG.player.maxHealth, 4);
    assert.equal(COMBAT_CONFIG.player.damage, 2);
    assert.equal(COMBAT_CONFIG.drone.maxHealth, 4);
    assert.equal(COMBAT_CONFIG.drone.damage, 1);
    assert.equal(COMBAT_CONFIG.drone.damage, COMBAT_CONFIG.player.damage / 2);
    assert.equal(COMBAT_CONFIG.scooter.maxHealth, 3);
    assert.equal(COMBAT_CONFIG.guard.maxHealth, 6);
});

test('botoes da derrota disparam somente a primeira acao selecionada', () => {
    const { DefeatView } = load('../src/game/ui/DefeatView.ts');
    const interactiveObjects = [];
    const graphic = () => {
        const object = { listeners: {} };
        for (const method of [
            'setDepth', 'setStrokeStyle', 'setOrigin', 'setInteractive', 'disableInteractive',
            'setScrollFactor', 'setAlpha', 'setResolution', 'setVisible', 'setX', 'clear', 'fillStyle',
            'fillRect', 'lineStyle', 'strokeRect', 'setColor'
        ]) object[method] = () => object;
        object.add = () => object;
        object.on = (event, callback) => {
            object.listeners[event] = callback;
            if (event === 'pointerdown') interactiveObjects.push(object);
            return object;
        };
        object.once = (event, callback) => {
            object.listeners[event] = callback;
            if (event === 'pointerdown') interactiveObjects.push(object);
            return object;
        };
        return object;
    };
    let restarts = 0;
    let quits = 0;
    const scene = {
        add: { container: graphic, rectangle: graphic, graphics: graphic, text: graphic },
        tweens: { add() {} }
    };
    const actions = {
        onRestart: () => { restarts++; },
        onQuit: () => { quits++; }
    };

    new DefeatView(scene, actions).create();
    interactiveObjects[0].listeners.pointerdown();
    interactiveObjects[0].listeners.pointerdown();
    assert.equal(restarts, 1);
    assert.equal(quits, 0);

    new DefeatView(scene, actions).create();
    interactiveObjects[3].listeners.pointerdown();
    interactiveObjects[3].listeners.pointerdown();
    assert.equal(quits, 1);
});

test('nenhum personagem dispara fora de alcance', () => {
    const { combat, groups } = setup([[301, 100]]);
    combat.update(2000);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 0);
});

test('drone respeita o raio padrão; seu tiro é vermelho e aponta para o jogador', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.range = COMBAT_CONFIG.player.range - 20;
    const { combat, groups } = setup([[190, 100]], [], upgrades);
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 1);
    assert.equal(groups[1].shots[0].color, 0xff3030);
    assert.ok(groups[1].shots[0].velocity.x < 0);
});

test('jogador escolhe o inimigo vivo mais próximo e respeita o intervalo entre tiros', () => {
    const { combat, groups, drones } = setup([[200, 100], [100, 140]]);
    combat.update(0);
    assert.ok(Math.abs(groups[0].shots[0].velocity.x) < 0.001);
    assert.ok(groups[0].shots[0].velocity.y > 0);
    combat.update(COMBAT_CONFIG.player.fireInterval - 1);
    assert.equal(groups[0].shots.length, 1);
    drones[1].takeDamage(60);
    combat.update(1);
    assert.equal(groups[0].shots.length, 2);
    assert.ok(groups[0].shots[1].velocity.x > 0);
});

test('bônus da cuia aumenta a cadência de tiro em 50%', () => {
    const { combat, groups } = setup([[150, 100]]);
    combat.update(0);
    assert.equal(groups[0].shots.length, 1);

    combat.setPlayerFireRateMultiplier(WORLD_CONFIG.chimarrao.effectMultiplier);
    const boostedInterval = COMBAT_CONFIG.player.fireInterval
        / WORLD_CONFIG.chimarrao.effectMultiplier;
    combat.update(boostedInterval - 1);
    assert.equal(groups[0].shots.length, 1);
    combat.update(1);
    assert.equal(groups[0].shots.length, 2);

    combat.setPlayerFireRateMultiplier(1);
    combat.update(COMBAT_CONFIG.player.fireInterval - 1);
    assert.equal(groups[0].shots.length, 2);
    combat.update(1);
    assert.equal(groups[0].shots.length, 3);
});

test('drones mantêm intervalos de disparo independentes', () => {
    const { combat, groups } = setup([[150, 100], [100, 150]]);
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[1].shots.length, 2);
    combat.update(COMBAT_CONFIG.drone.fireInterval - 1);
    assert.equal(groups[1].shots.length, 2);
    combat.update(1);
    assert.equal(groups[1].shots.length, 4);
});

test('patinete e guarda são alvos do jogador, mas não disparam projéteis', () => {
    for (const kind of ['scooter', 'guard']) {
        const { combat, groups, drones } = setup([[150, 100]]);
        drones[0].kind = kind;
        combat.update(COMBAT_CONFIG.drone.fireInterval);
        assert.equal(groups[0].shots.length, 1);
        assert.equal(groups[1].shots.length, 0);
    }
});

test('parede entre os personagens impede disparos dos dois lados', () => {
    const { combat, groups } = setup([[150, 100]], [
        { getLeft: () => 120, getTop: () => 90, width: 16, height: 32 }
    ]);
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 0);
});

test('jogador atira no golem mesmo com quiosque ou pilar no meio, e o tiro atravessa até ele', () => {
    const { combat, groups, drones } = setup([[150, 100]], [
        { getLeft: () => 120, getTop: () => 90, width: 16, height: 32 }
    ]);
    drones[0].kind = 'golem';
    combat.update(COMBAT_CONFIG.player.fireInterval);
    assert.equal(groups[0].shots.length, 1, 'o golem fica por cima dos obstáculos e continua na mira');
    assert.equal(combat.projectiles.get(groups[0].shots[0]).passesWalls, true);
    assert.equal(groups[1].shots.length, 0, 'o golem não atira como drone');
});

test('tiro normal ganha 10% de dano e 5% de velocidade a cada sala', () => {
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
    near(getPlayerShotMultipliers('room1').damage, 1);
    near(getPlayerShotMultipliers('room2').damage, 1.1);
    near(getPlayerShotMultipliers('room5').damage, 1.4);
    near(getPlayerShotMultipliers('room5').speed, 1.2);
    near(getPlayerShotMultipliers('mercado-interior').damage, getPlayerShotMultipliers('room4').damage);

    const base = setup();
    base.combat.update(COMBAT_CONFIG.player.fireInterval);
    const baseSpeed = base.groups[0].shots[0].velocity.x;
    const { combat, groups, overlaps, drones } = setup();
    combat.shotMultipliers = getPlayerShotMultipliers('room3');
    combat.update(COMBAT_CONFIG.player.fireInterval);
    near(groups[0].shots[0].velocity.x, baseSpeed * 1.1);
    overlaps[0].hit(groups[0].shots[0]);
    near(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth - COMBAT_CONFIG.player.damage * 1.2);
});

test('cada projétil causa dano uma vez e dois acertos derrotam o drone', () => {
    const { combat, groups, overlaps, drones } = setup();
    combat.update(COMBAT_CONFIG.player.fireInterval);
    const firstShot = groups[0].shots[0];
    overlaps[0].hit(firstShot);
    overlaps[0].hit(firstShot);
    assert.equal(firstShot.active, false);
    assert.equal(drones[0].sprite.active, true, 'O callback deve remover o projétil, não destruir o alvo');
    assert.ok(drones[0].sprite.body);
    assert.equal(drones[0].health.current, 2);
    assert.equal(drones[0].health.isAlive, true);

    combat.update(COMBAT_CONFIG.player.fireInterval);
    const secondShot = groups[0].shots[1];
    overlaps[0].hit(secondShot);
    assert.equal(drones[0].health.current, 0);
    assert.equal(drones[0].health.isAlive, false);
});

test('tiro inimigo reduz a vida do jogador e jogador morto interrompe o combate', () => {
    const { combat, groups, overlaps, player } = setup();
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    overlaps[1].hit(groups[1].shots[0]);
    assert.equal(player.health.current, Math.max(
        0,
        COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.drone.damage
    ));
    assert.equal(player.health.current, 3, 'O primeiro tiro do drone deve tirar apenas meio coração');
    assert.equal(player.sprite.active, true);
    assert.ok(player.sprite.body);
    player.takeDamage(COMBAT_CONFIG.player.maxHealth);
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[0].shots.length, 1);
    assert.equal(groups[1].shots.length, 1);
});

test('projéteis são removidos ao colidir com o mapa, expirar ou sair do mundo', () => {
    const { combat, groups, colliders, drones } = setup();
    combat.update(0);
    const first = groups[0].shots[0];
    colliders[0].callback(first);
    assert.equal(first.active, false);
    combat.update(COMBAT_CONFIG.player.fireInterval);
    const second = groups[0].shots[1];
    second.x = -1;
    combat.update(1);
    assert.equal(second.active, false);
    combat.update(COMBAT_CONFIG.player.fireInterval);
    const third = groups[0].shots[2];
    drones[0].takeDamage(60);
    combat.update(COMBAT_CONFIG.projectile.lifetime);
    assert.equal(third.active, false);
});

test('limpeza de combate remove projéteis dos dois lados e pode ser repetida', () => {
    const { combat, groups } = setup();
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    combat.clear();
    combat.clear();
    assert.ok(groups.every((group) => group.shots.every((shot) => !shot.active)));
});

test('cartas alteram atributos, habilidades, limites e reparo do jogador', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('attack-range'));
    upgrades.acquire(getUpgradeCard('projectile-speed'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('fire-rate'));
    upgrades.acquire(getUpgradeCard('double-shot'));
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('piercing-shot'));
    upgrades.acquire(getUpgradeCard('companion-drone'));
    upgrades.acquire(getUpgradeCard('emergency-repair'));
    upgrades.acquire(getUpgradeCard('max-health'));

    assert.equal(upgrades.range, COMBAT_CONFIG.player.range * 1.2);
    assert.equal(upgrades.projectileSpeed, COMBAT_CONFIG.player.projectileSpeed * 1.25);
    assert.equal(upgrades.damage, COMBAT_CONFIG.player.damage + 2);
    assert.equal(upgrades.fireInterval, COMBAT_CONFIG.player.fireInterval * 0.8);
    assert.equal(upgrades.projectileCount, 2);
    assert.equal(upgrades.piercingTargets, 3);
    assert.equal(upgrades.companionCount, 1);
    assert.equal(upgrades.companionStatRatio, 0.75);
    assert.equal(upgrades.companionDamageRatio, 0.5);
    assert.equal(upgrades.maxHealth, COMBAT_CONFIG.player.maxHealth + 2);

    const health = new Health(100);
    health.takeDamage(50);
    upgrades.repairAfterRoom(health);
    assert.equal(health.current, 52);
});

test('upgrades de atributo acumulam no máximo três níveis', () => {
    for (const id of ['attack-range', 'projectile-speed', 'projectile-damage', 'fire-rate']) {
        const upgrades = new PlayerUpgradeState();
        const card = getUpgradeCard(id);
        assert.deepEqual(Array.from({ length: 4 }, () => upgrades.acquire(card)), [
            true, true, true, false
        ]);
        assert.deepEqual(upgrades.exportProgress(), [[id, 3]]);
        assert.equal(upgrades.availableCards().some((available) => available.id === id), false);
    }
});

test('progresso entre salas preserva vida, habilidades e bônus permanentes', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('double-shot'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    const sourceHealth = new Health(8);
    sourceHealth.takeDamage(3);
    const progress = capturePlayerProgress({
        health: sourceHealth,
        getMovementSpeedMultiplier: () => 1.2
    }, upgrades, 3, ['gaucho-hat']);

    const restoredUpgrades = new PlayerUpgradeState();
    const restoredHealth = new Health(4);
    let restoredSpeed = 1;
    restorePlayerProgress(
        progress,
        restoredHealth,
        (multiplier) => { restoredSpeed = multiplier; },
        restoredUpgrades
    );

    assert.equal(restoredHealth.current, 5);
    assert.equal(restoredHealth.max, 8);
    assert.equal(restoredSpeed, 1.2);
    assert.equal(restoredUpgrades.projectileCount, 2);
    assert.equal(restoredUpgrades.damage, COMBAT_CONFIG.player.damage + 1);
    assert.equal(progress.chimarraos, 3, 'chimarrões pegos seguem para a próxima sala');
    assert.deepEqual(progress.items, ['gaucho-hat'], 'o chapéu segue para a próxima sala');
    assert.deepEqual(Object.keys(progress).sort(), [
        'chimarraos',
        'currentHealth',
        'equipped',
        'items',
        'maxHealth',
        'movementSpeedMultiplier',
        'upgrades'
    ], 'náusea e controles invertidos não pertencem ao progresso permanente');
});

test('resumo da pausa lista upgrades escolhidos com seus níveis e descrições', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('companion-drone'));

    const entries = getPauseUpgradeEntries(upgrades.exportProgress());
    assert.deepEqual(entries.map(({ card, level }) => ({
        id: card.id,
        level,
        description: card.description
    })), [
        {
            id: 'projectile-damage',
            level: 2,
            description: 'Aumenta o dano dos projéteis em 1 por nível.'
        },
        {
            id: 'companion-drone',
            level: 1,
            description: 'Drone: 75% de alcance, velocidade e cadência; 50% de dano arredondado (mín. 1).'
        }
    ]);
});

test('mundo envia os upgrades atuais ao abrir o menu de pausa', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const launches = [];
    world.isGameplayReady = true;
    world.player = { health: new Health(COMBAT_CONFIG.player.maxHealth) };
    world.upgrades.acquire(getUpgradeCard('projectile-damage'));
    world.upgrades.acquire(getUpgradeCard('projectile-damage'));
    world.scene = {
        launch(key, data) { launches.push({ key, data }); },
        bringToTop() {},
        pause() {}
    };

    world.chimarraosCollected = 4;

    world.openPauseMenu();
    world.isPauseMenuOpen = false;
    world.openInventory();

    assert.deepEqual(launches.map(({ key, data }) => [key, data.view]), [['PauseMenu', 'pause'], ['PauseMenu', 'inventory']]);
    const { data } = launches[0];
    assert.deepEqual(data.upgrades, [['projectile-damage', 2]]);
    assert.equal(data.inventory.chimarraos, 4, 'o inventário mostra os chimarrões pegos');
    assert.equal(data.inventory.characterId, 'padrao');
    assert.deepEqual(data.inventory.items.map(({ name }) => name), ['CARTEIRA'], 'a carteira já vem guardada');
    assert.match(data.inventory.items[0].description, /SALDO: R\$ /);
});

test('todo início de sala é checkpoint, inclusive a room1', () => {
    const values = new Map();
    const storage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
    const playerProgress = {
        currentHealth: 3,
        maxHealth: 4,
        movementSpeedMultiplier: 1,
        upgrades: [['double-shot', 1]]
    };

    assert.equal(loadCampaignProgress(storage), undefined);
    saveCampaignProgress({ roomKey: 'room1', playerProgress }, storage);
    assert.deepEqual(loadCampaignProgress(storage), { roomKey: 'room1', playerProgress }, 'a room1 já é checkpoint');

    saveCampaignProgress({ roomKey: 'room2', playerProgress }, storage);
    assert.deepEqual(loadCampaignProgress(storage), { roomKey: 'room2', playerProgress });

    clearCampaignProgress(storage);
    assert.equal(loadCampaignProgress(storage), undefined);
});

test('menu principal abre opções de jogo e desabilita continuar sem checkpoint', () => {
    let selected = '';
    const mainMenu = createMainMenuActions(
        () => { selected = 'play'; },
        () => { selected = 'leaderboard'; }
    );
    assert.deepEqual(mainMenu.map(({ label }) => label), [
        'JOGAR', 'PLACAR', 'OPÇÕES', 'SAIR'
    ]);
    mainMenu[0].onSelect();
    assert.equal(selected, 'play');

    const withoutCheckpoint = createPlayMenuActions({
        onNewGame: () => { selected = 'new'; }
    }, () => { selected = 'back'; });
    assert.deepEqual(withoutCheckpoint.map(({ label }) => label), [
        'CONTINUAR', 'JOGAR SOLO', 'VOLTAR'
    ]);
    assert.equal(withoutCheckpoint[0].enabled, false);
    assert.equal(withoutCheckpoint[0].onSelect, undefined);
    withoutCheckpoint[1].onSelect();
    assert.equal(selected, 'new');

    const withCheckpoint = createPlayMenuActions({
        onNewGame: () => { selected = 'new'; },
        onContinue: () => { selected = 'continue'; }
    }, () => { selected = 'back'; });
    assert.deepEqual(withCheckpoint.map(({ label }) => label), [
        'CONTINUAR', 'JOGAR SOLO', 'VOLTAR'
    ]);
    assert.equal(withCheckpoint[0].enabled, true);
    withCheckpoint[0].onSelect();
    assert.equal(selected, 'continue');

    const withMultiplayer = createPlayMenuActions({
        onNewGame: () => { selected = 'new'; },
        onContinue: () => { selected = 'continue'; },
        onMultiplayer: () => { selected = 'multiplayer'; }
    }, () => { selected = 'back'; });
    assert.deepEqual(withMultiplayer.map(({ label }) => label), [
        'CONTINUAR', 'JOGAR SOLO', 'MULTIPLAYER', 'VOLTAR'
    ]);
    withMultiplayer[2].onSelect();
    assert.equal(selected, 'multiplayer');
});

test('sorteio oferece três cartas distintas com ao menos uma habilidade', () => {
    for (let seed = 1; seed <= 50; seed++) {
        let state = seed;
        const random = () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 2 ** 32;
        };
        const cards = drawUpgradeCards(random);
        assert.equal(cards.length, 3);
        assert.equal(new Set(cards.map((card) => card.id)).size, 3);
        assert.ok(cards.some((card) => card.kind === 'ability'));
    }
});

test('morte causada pelo projétil soma pontos à run ativa exatamente uma vez', () => {
    const tracker = new RunTracker();
    tracker.startNew('SINGLE_PLAYER', new Date('2026-01-01T00:00:00.000Z'));
    const { combat, groups, overlaps } = setup([[150, 100]], [], new PlayerUpgradeState(), tracker);

    combat.update(COMBAT_CONFIG.player.fireInterval);
    overlaps[0].hit(groups[0].shots[0]);
    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).enemiesDefeated, 0);

    combat.update(COMBAT_CONFIG.player.fireInterval);
    overlaps[0].hit(groups[0].shots[1]);

    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).enemiesDefeated, 1);
    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).score.total, 100);
});

test('Sala I cria 10 inimigos e depois 8 apenas quando todos os anteriores morrerem', () => {
    const counts = [];
    const drones = [];
    const waves = new DroneWaves((count) => {
        counts.push(count);
        drones.push(...Array.from({ length: count }, () => fighter(0, 0, 60)));
    });
    waves.update(drones);
    assert.deepEqual(counts, [10]);
    for (const drone of drones.slice(0, 9)) drone.takeDamage(60);
    waves.update(drones);
    assert.deepEqual(counts, [10]);
    drones[9].takeDamage(60);
    waves.update(drones);
    assert.deepEqual(counts, [10, 8]);
    assert.equal(drones.length, 18);
    waves.update(drones);
    for (const drone of drones) drone.takeDamage(60);
    waves.update(drones);
    waves.update(drones);
    assert.deepEqual(counts, [10, 8], 'Não deve existir uma terceira onda');
    const restartedCounts = [];
    new DroneWaves((count) => restartedCounts.push(count)).update([]);
    assert.deepEqual(restartedCounts, [10]);
});

test('segunda onda aguarda o fim da vinheta sem dispará-la mais de uma vez', () => {
    const counts = [];
    const drones = [];
    let resumeWave;
    let intermissions = 0;
    const waves = new DroneWaves(
        (count) => {
            counts.push(count);
            drones.push(...Array.from({ length: count }, () => fighter(0, 0, 60)));
        },
        () => {},
        (resume) => {
            intermissions += 1;
            resumeWave = resume;
        }
    );

    waves.update(drones);
    for (const drone of drones) drone.takeDamage(60);
    waves.update(drones);
    waves.update(drones);
    assert.deepEqual(counts, [10]);
    assert.equal(intermissions, 1);
    resumeWave();
    assert.deepEqual(counts, [10, 8]);
});

test('Sala I tem duas ondas e a horda da Sala II cresce depois da carta', () => {
    assert.deepEqual([...COMBAT_CONFIG.wavesByRoom.room1], [10, 8]);
    assert.deepEqual([...COMBAT_CONFIG.wavesByRoom.room2], [17, 137]);
    const [first, second] = COMBAT_CONFIG.hordeByRoom.room2;
    assert.ok(second.maxAlive > first.maxAlive * 2, 'a segunda horda precisa ser bem maior');
    assert.ok(second.interval < first.interval);
    assert.deepEqual([...COMBAT_CONFIG.wavesByRoom.dungeon], [10]);
});

test('somente a Sala I oferece outra seleção de upgrade ao ser concluída', () => {
    const { shouldOfferRoomCompletionUpgrade } = load('../src/game/scenes/World.ts');
    assert.equal(shouldOfferRoomCompletionUpgrade('room1'), true);
    assert.equal(shouldOfferRoomCompletionUpgrade('room2'), false);
    assert.equal(shouldOfferRoomCompletionUpgrade('room3'), true, 'depois da horda 2 da Sala III');
    assert.equal(shouldOfferRoomCompletionUpgrade('dungeon'), false);
});

test('recompensa final da Sala I aplica a carta antes de liberar a saída', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { UpgradeSelectionView } = load('../src/game/ui/UpgradeSelectionView.ts');
    const originalPlay = UpgradeSelectionView.prototype.play;
    const world = new World();
    let selectCard;
    let selectionOptions;
    let clears = 0;
    let pauses = 0;
    let resumes = 0;
    let completions = 0;
    const root = {
        setDepth() { return this; },
        setScrollFactor() { return this; }
    };
    const overlay = { add: { container: () => root } };
    world.combat = { clear() { clears++; } };
    world.physics = {
        pause() { pauses++; },
        resume() { resumes++; }
    };
    world.scene = { get: () => overlay };
    world.isGameplayReady = true;

    UpgradeSelectionView.prototype.play = function (onSelect) {
        selectCard = onSelect;
        selectionOptions = this.options;
    };
    try {
        world.playRoomCompletionReward(() => { completions++; });
    } finally {
        UpgradeSelectionView.prototype.play = originalPlay;
    }

    assert.equal(clears, 1);
    assert.equal(pauses, 1);
    assert.equal(completions, 0, 'A sala não deve ser liberada antes da escolha');
    assert.equal(world.isWaveIntermissionOpen, true);
    assert.deepEqual(selectionOptions, {
        title: 'SALA I CONCLUÍDA',
        hint: 'Escolha uma recompensa'
    });

    selectCard(getUpgradeCard('projectile-damage'));
    assert.equal(world.upgrades.damage, COMBAT_CONFIG.player.damage + 1);
    assert.equal(world.isWaveIntermissionOpen, false);
    assert.equal(completions, 1);
    assert.equal(resumes, 1);
});

test('reparo escolhido na recompensa da dungeon cura na própria conclusão', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { UpgradeSelectionView } = load('../src/game/ui/UpgradeSelectionView.ts');
    const originalPlay = UpgradeSelectionView.prototype.play;
    const world = new World();
    const health = new Health(COMBAT_CONFIG.player.maxHealth);
    health.takeDamage(3);
    let selectCard;
    let completions = 0;
    const root = {
        setDepth() { return this; },
        setScrollFactor() { return this; }
    };
    world.player = { health };
    world.dungeonState = createDungeonSessionState(123);
    world.combat = { clear() {} };
    world.physics = { pause() {}, resume() {} };
    world.scene = { get: () => ({ add: { container: () => root } }) };
    world.activeRoomKey = 'dungeon';
    world.isGameplayReady = true;

    UpgradeSelectionView.prototype.play = function (onSelect) {
        selectCard = onSelect;
    };
    try {
        world.playDungeonReward(() => {
            completions++;
            world.upgrades.repairAfterRoom(health);
        });
    } finally {
        UpgradeSelectionView.prototype.play = originalPlay;
    }

    assert.equal(health.current, 1);
    assert.equal(completions, 0);
    selectCard(getUpgradeCard('emergency-repair'));
    assert.equal(completions, 1);
    assert.equal(health.current, 3, 'O reparo deve recuperar dois pontos de vida');
    assert.equal(world.dungeonState.rewardClaimed, true);
});

test('dungeon configura somente uma onda e respeita inimigos restantes', () => {
    const counts = [];
    const drones = [];
    let completed = 0;
    const remainingEnemies = 4;
    const waves = new DroneWaves(
        (count) => {
            counts.push(count);
            drones.push(...Array.from({ length: count }, () => fighter(0, 0, 60)));
        },
        () => { completed += 1; },
        (resume) => resume(),
        [remainingEnemies]
    );
    waves.update(drones);
    assert.deepEqual(counts, [remainingEnemies]);
    for (const drone of drones) drone.takeDamage(60);
    waves.update(drones);
    waves.update(drones);
    assert.deepEqual(counts, [remainingEnemies]);
    assert.equal(completed, 1);
});

test('novos drones entram no combate com tiros, dano e atraso inicial', () => {
    const { combat, player, drones, groups, overlaps, attachBody } = setup([]);
    const drone = fighter(150, 100, COMBAT_CONFIG.drone.maxHealth);
    attachBody(drone.sprite, 150, 100);
    drones.push(drone);
    combat.registerDrone(drone);
    combat.registerDrone(drone);
    assert.equal(overlaps.length, 2, 'Não duplica colisões ao registrar duas vezes');
    combat.update(0);
    assert.equal(groups[0].shots.length, 1);
    assert.equal(groups[1].shots.length, 0);
    overlaps[1].hit(groups[0].shots[0]);
    assert.equal(
        drone.health.current,
        COMBAT_CONFIG.drone.maxHealth - COMBAT_CONFIG.player.damage
    );
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[1].shots.length, 1);
    overlaps[0].hit(groups[1].shots[0]);
    assert.equal(player.health.current, Math.max(
        0,
        COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.drone.damage
    ));
});

test('projéteis menores acompanham a direção do tiro e a colisão retangular', () => {
    const { combat, groups } = setup([[100, 150]]);
    combat.update(0);
    const shot = groups[0].shots[0];
    assert.equal(shot.scale, 0.85);
    assert.ok(Math.abs(shot.rotation - Math.PI / 2) < 0.001);
    assert.ok(Math.abs(shot.body.width - COMBAT_CONFIG.projectile.height) < 0.001);
    assert.ok(Math.abs(shot.body.height - COMBAT_CONFIG.projectile.width) < 0.001);
});

test('tiro duplo, dano aumentado e perfuração afetam o combate real', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('double-shot'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('piercing-shot'));
    const { combat, groups, drones, overlaps, damageLabels } = setup(
        [[150, 100], [170, 100]],
        [],
        upgrades
    );

    combat.update(0);
    assert.equal(groups[0].shots.length, 2);
    const shot = groups[0].shots[0];
    overlaps[0].hit(shot);
    assert.equal(shot.active, true);
    assert.equal(drones[0].health.current, Math.max(
        0,
        COMBAT_CONFIG.drone.maxHealth - upgrades.damage
    ));
    overlaps[1].hit(shot);
    assert.equal(shot.active, false);
    assert.equal(drones[1].health.current, Math.max(
        0,
        COMBAT_CONFIG.drone.maxHealth - upgrades.damage
    ));
    const displayedDamage = Math.min(COMBAT_CONFIG.drone.maxHealth, upgrades.damage);
    assert.deepEqual(damageLabels.map((label) => label.text), [
        `-${displayedDamage}`,
        `-${displayedDamage}`
    ]);
});

test('drone companheiro usa alcance útil, dano inteiro e cadência reduzida', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('companion-drone'));
    const { combat, groups, companions, drones, overlaps, damageLabels } = setup(
        [[110, 100]],
        [],
        upgrades
    );
    combat.update(0);
    assert.equal(companions.length, 1);
    const companionShot = groups[0].shots.find((shot) => shot.color === 0x39ff14);
    assert.ok(companionShot);
    assert.ok(Math.abs(Math.hypot(companionShot.velocity.x, companionShot.velocity.y)
        - upgrades.projectileSpeed * upgrades.companionStatRatio) < 0.001);

    overlaps[0].hit(companionShot);
    assert.equal(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth - 1);
    assert.equal(damageLabels.at(-1).text, '-1');

    combat.update(upgrades.fireInterval / upgrades.companionStatRatio - 1);
    assert.equal(groups[0].shots.filter((shot) => shot.color === 0x39ff14).length, 1);
    combat.update(1);
    assert.equal(groups[0].shots.filter((shot) => shot.color === 0x39ff14).length, 2);
});

test('ondas têm posições suficientes, distintas e longe da área inicial e do jogador', () => {
    const { spawn, spawnSafeRadius } = WORLD_CONFIG.player;
    for (let y = 80; y <= 544; y += 16) {
        for (let x = 88; x <= 712; x += 16) {
            const points = selectDroneSpawns(10, { x, y });
            assert.equal(new Set(points).size, 10);
            for (const point of points) {
                assert.ok(Math.hypot(point.x - x, point.y - y) >= COMBAT_CONFIG.spawnDistanceFromPlayer);
                const closestX = Math.max(point.patrolLeft, Math.min(spawn.x, point.patrolRight));
                assert.ok(Math.hypot(closestX - spawn.x, point.y - spawn.y) >= spawnSafeRadius + 16);
            }
        }
    }
    assert.equal(selectDroneSpawns(10, spawn).length, 10);
});

test('onda única da room2 reserva dois guardas na base da escadaria', () => {
    const regularSpawns = Array.from({ length: 12 }, (_, index) => ({
        x: 320 + index * 16,
        y: 160,
        patrolLeft: 312 + index * 16,
        patrolRight: 328 + index * 16
    }));
    const selected = selectDroneSpawnsWithPriority(
        10,
        ROOM_DEFINITIONS.room2.spawn,
        ROOM2_STAIR_GUARD_SPAWNS,
        regularSpawns
    );

    assert.equal(selected.length, 10);
    assert.deepEqual(selected.slice(0, 2), [...ROOM2_STAIR_GUARD_SPAWNS]);
});

test('room2 cria drones somente no setor alcançável pelo jogador', () => {
    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room2.json'), 'utf8'));
    const tileLayers = [];
    const collectTileLayers = (layers) => layers.forEach((layer) => {
        if (layer.type === 'group') collectTileLayers(layer.layers);
        if (layer.type === 'tilelayer') tileLayers.push(layer);
    });
    collectTileLayers(map.layers);
    const colliderLayers = tileLayers.filter((layer) =>
        (layer.properties ?? []).some((property) => property.name === 'collider' && property.value)
    );
    const isBlocked = (tileX, tileY) => colliderLayers.some((layer) =>
        layer.data[tileY * map.width + tileX] !== 0
    );
    const walkableLayerNames = new Set(['floor', 'stairs', 'street', 'floor-terminal']);
    const walkableLayers = tileLayers.filter((layer) => walkableLayerNames.has(layer.name));
    const isWalkable = (tileX, tileY) => walkableLayers.some((layer) =>
        layer.data[tileY * map.width + tileX] !== 0
    );
    const candidates = createReachableDroneSpawns({
        width: map.width,
        height: map.height,
        tileWidth: map.tilewidth,
        tileHeight: map.tileheight
    }, isBlocked, WORLD_CONFIG.player.spawn, isWalkable);

    assert.ok(candidates.length >= 20);
    assert.ok(candidates.every((point) => isWalkable(
        Math.floor(point.x / map.tilewidth),
        Math.floor(point.y / map.tileheight)
    )), 'nenhum drone pode nascer no vazio fora do desenho do mapa');
    for (let y = map.tileheight * 2; y < map.height * map.tileheight; y += map.tileheight * 2) {
        for (let x = map.tilewidth * 2; x < map.width * map.tilewidth; x += map.tilewidth * 2) {
            if (isBlocked(Math.floor(x / map.tilewidth), Math.floor(y / map.tileheight))) continue;
            const selected = selectDroneSpawns(10, { x, y }, candidates);
            assert.equal(new Set(selected).size, 10);
            assert.ok(selected.every((point) => !isBlocked(
                Math.floor(point.x / map.tilewidth),
                Math.floor(point.y / map.tileheight)
            )));
        }
    }
});

test('room2 reconhece o piso dentro de grupos do Tiled', () => {
    const { isRoom2WalkableLayer } = load('../src/game/scenes/World.ts');
    assert.equal(isRoom2WalkableLayer('flowers/floor'), true);
    assert.equal(isRoom2WalkableLayer('floor-terminal'), true);
    assert.equal(isRoom2WalkableLayer('new-street'), true);
    assert.equal(isRoom2WalkableLayer('flowers/flowers'), false);
});

test('room2 cria luzes a partir da camada superior dos postes', () => {
    const { isRoom2LampLayer } = load('../src/game/map/createRoom.ts');
    assert.equal(isRoom2LampLayer('superior-postes'), true);
    assert.equal(isRoom2LampLayer('grupo/superior-postes'), true);
    assert.equal(isRoom2LampLayer('base-postes'), false);

    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room2.json'), 'utf8'));
    const lampLayer = map.layers.find((layer) => layer.name === 'superior-postes');
    assert.ok(lampLayer);
    assert.equal(lampLayer.data.filter((gid) => gid === 758).length, 2);
});

test('postes, teto, placas e grades ficam na frente do personagem', () => {
    const { getRoom2LayerDepth } = load('../src/game/map/createRoom.ts');
    assert.ok(getRoom2LayerDepth('superior-postes') > 10);
    assert.ok(getRoom2LayerDepth('grupo/superior-postes') > 10);
    assert.ok(getRoom2LayerDepth('old-terminal-teto-front') > 10);
    assert.ok(getRoom2LayerDepth('grupo/old-terminal-teto-front') > 10);
    assert.ok(getRoom2LayerDepth('old-terminal-teto-back') > 10);
    assert.ok(getRoom2LayerDepth('linhas-placa') > 10);
    assert.ok(getRoom2LayerDepth('poste-old-terminal') > 10);
    assert.ok(getRoom2LayerDepth('placa-onibus') > 10);
    assert.ok(getRoom2LayerDepth('grades') > 10);
    // Sala III: tronco e vigas da pérgola cobrem o jogador.
    for (const name of ['figueira-topo', 'figueira-tronco', 'pendulo', 'pendulo-back', 'detalhe-penduloi']) {
        assert.ok(getRoom2LayerDepth(name) > 10, name);
    }
    assert.ok(getRoom2LayerDepth('terminal/grades') > 10);
    assert.ok(getRoom2LayerDepth('grades') < getRoom2LayerDepth('old-terminal-teto-front'));
    assert.ok(getRoom2LayerDepth('grades') < getRoom2LayerDepth('old-terminal-teto-back'));
    assert.ok(getRoom2LayerDepth('base-postes') < 10);
    assert.ok(getRoom2LayerDepth('poste') < 10);
    assert.ok(getRoom2LayerDepth('street') < 10);
});

test('jogador começa no centro inferior, com o corpo dentro do mapa e livre de paredes', () => {
    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room01.json'), 'utf8'));
    const { spawn, hitbox, scale } = WORLD_CONFIG.player;
    assert.equal(spawn.x, map.width * map.tilewidth / 2);
    assert.ok(spawn.y > map.height * map.tileheight * 0.8);
    const blockedIds = new Set(map.tilesets.flatMap((tileset) => (tileset.tiles ?? [])
        .filter((tile) => tile.properties?.some((property) => property.name === 'collider' && property.value))
        .map((tile) => tileset.firstgid + tile.id)));
    const left = Math.floor((spawn.x + (hitbox.offsetX - 19) * scale) / map.tilewidth);
    const right = Math.floor((spawn.x + (hitbox.offsetX + hitbox.width - 19) * scale) / map.tilewidth);
    const top = Math.floor((spawn.y + (hitbox.offsetY - 19) * scale) / map.tileheight);
    const bottom = Math.floor((spawn.y + (hitbox.offsetY + hitbox.height - 19) * scale) / map.tileheight);
    assert.ok(left >= 0 && top >= 0 && right < map.width && bottom < map.height);
    for (const layer of map.layers.filter((layer) => layer.type === 'tilelayer')) {
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) assert.equal(blockedIds.has(layer.data[y * map.width + x]), false);
        }
    }
});

test('drones nascem e patrulham em áreas livres de obstáculos no mapa real', () => {
    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room01.json'), 'utf8'));
    const blockedIds = new Set(map.tilesets.flatMap((tileset) => (tileset.tiles ?? [])
        .filter((tile) => tile.properties?.some((property) => property.name === 'collider' && property.value))
        .map((tile) => tileset.firstgid + tile.id)));
    for (const spawn of COMBAT_CONFIG.droneSpawns) {
        const { hitbox, scale } = WORLD_CONFIG.drone;
        const left = Math.floor((spawn.patrolLeft + (hitbox.offsetX - 16) * scale) / map.tilewidth);
        const right = Math.floor((spawn.patrolRight + (hitbox.offsetX + hitbox.width - 16) * scale - 0.001) / map.tilewidth);
        const top = Math.floor((spawn.y + (hitbox.offsetY - 16) * scale) / map.tileheight);
        const bottom = Math.floor((spawn.y + (hitbox.offsetY + hitbox.height - 16) * scale - 0.001) / map.tileheight);
        for (const layer of map.layers.filter((layer) => layer.type === 'tilelayer')) {
            for (let y = top; y <= bottom; y++) {
                for (let x = left; x <= right; x++) {
                    assert.equal(blockedIds.has(layer.data[y * map.width + x]), false,
                        `Patrulha (${spawn.x}, ${spawn.y}) cruza obstáculo em ${layer.name} (${x}, ${y})`);
                }
            }
        }
    }
});

function chasingDrone(wallTiles = []) {
    const explosions = [];
    const cameraShakes = [];
    const animations = new Map();
    const world = new ArcadeWorld({ sys: { scale: { width: 800, height: 640 } } }, {});
    const sprite = {
        x: 300, y: 208, active: true, body: new ArcadeBody(world),
        setScale(value) { this.scale = value; },
        setDepth() {}, setCollideWorldBounds() {}, play() {},
        setFlipX(value) { this.flipX = value; },
        setTint() {}, clearTint() {},
        disableBody() { this.active = false; this.body.enable = false; }
    };
    const graphics = { clear() { return this; }, fillStyle() { return this; }, fillRect() { return this; }, setDepth() { return this; } };
    const scene = {
        sound: { play() {} },
        cameras: { main: { shake: (...args) => cameraShakes.push(args) } },
        physics: { add: { sprite: () => sprite } },
        anims: {
            exists: (key) => key === 'drone-hover' || animations.has(key),
            generateFrameNumbers: (_key, { start, end }) => Array.from({ length: end - start + 1 }, (_, index) => start + index),
            create(config) { animations.set(config.key, config); }
        },
        time: { delayedCall() {} },
        add: {
            graphics: () => graphics,
            sprite(x, y, texture, frame) {
                const effect = Object.assign(new EventEmitter(), {
                    x, y, texture, frame, active: true,
                    setDepth() { return this; },
                    play(key) { this.animation = key; },
                    destroy() { this.active = false; this.removeAllListeners(); }
                });
                explosions.push(effect);
                return effect;
            }
        }
    };
    const drone = new Drone(scene, { x: 300, y: 208, patrolLeft: 260, patrolRight: 360 }, [
        { getTilesWithinWorldXY: () => wallTiles }
    ]);
    sprite.body.position.set(sprite.x - sprite.body.halfWidth, sprite.y - sprite.body.halfHeight);
    sprite.body.updateCenter();
    const playerAt = (dx, dy = 0) => fighter(sprite.body.center.x + dx, sprite.body.center.y + dy, 100);
    return { drone, sprite, playerAt, explosions, cameraShakes, animations, scene };
}

test('corpo do drone não é empurrável, mas permanece separável pelo motor físico', () => {
    const { sprite } = chasingDrone();
    assert.equal(sprite.body.immovable, false);
    assert.equal(sprite.body.pushable, false);
});

test('drone explode uma única vez ao morrer, usando a sequência pedida e removendo o efeito ao terminar', () => {
    const { drone, sprite, explosions, cameraShakes, animations, scene } = chasingDrone();
    const { DRONE_EXPLOSION, playDroneExplosion } = load('../src/game/effects/playDroneExplosion.ts');
    drone.takeDamage(COMBAT_CONFIG.drone.maxHealth - 1);
    assert.equal(explosions.length, 0);
    drone.takeDamage(1);
    drone.takeDamage(100);
    assert.equal(explosions.length, 1);
    assert.deepEqual(cameraShakes, [[
        COMBAT_CONFIG.drone.deathShake.duration,
        COMBAT_CONFIG.drone.deathShake.intensity
    ]]);
    assert.equal(sprite.body.enable, false);
    const effect = explosions[0];
    assert.equal(effect.x, sprite.body.center.x);
    assert.equal(effect.y, sprite.body.center.y);
    assert.equal(effect.animation, DRONE_EXPLOSION.texture);
    const animation = animations.get(effect.animation);
    assert.deepEqual(animation.frames, [306, 307, 308, 309]);
    assert.equal(animation.repeat, 0);
    assert.equal(animation.frameRate, 10);
    playDroneExplosion(scene, 400, 300);
    assert.equal(animations.size, 1);
    effect.emit(phaser.Animations.Events.ANIMATION_COMPLETE);
    assert.equal(effect.active, false);
    assert.equal(explosions[1].active, true, 'Cada explosão tem seu próprio ciclo de vida');
});

test('drone persegue jogador visível em qualquer direção sem acelerar na diagonal', () => {
    const { drone, sprite, playerAt } = chasingDrone();
    drone.update(playerAt(-100, 100));
    assert.ok(sprite.body.velocity.x < 0);
    assert.ok(sprite.body.velocity.y > 0);
    assert.ok(Math.abs(sprite.body.velocity.length() - WORLD_CONFIG.drone.chaseSpeed) < 0.001);
    assert.equal(sprite.flipX, true);
    drone.update(playerAt(100, -100));
    assert.ok(sprite.body.velocity.x > 0);
    assert.ok(sprite.body.velocity.y < 0);
    assert.equal(sprite.flipX, false);
});

test('drone da horda persegue de qualquer distância e mesmo atrás de parede', () => {
    const wall = [{ collides: true, getBounds: () => new phaser.Geom.Rectangle(0, 0, 2_000, 2_000) }];
    const { drone, sprite, playerAt } = chasingDrone(wall);
    const far = WORLD_CONFIG.drone.detectionRadius * 3;
    const { chaseSpeed } = WORLD_CONFIG.drone;
    drone.update(playerAt(far));
    assert.notEqual(Math.abs(sprite.body.velocity.x), chaseSpeed, 'fora da horda, longe e sem visão, só patrulha');
    drone.relentless = true;
    drone.update(playerAt(far));
    assert.equal(sprite.body.velocity.x, chaseSpeed);
});

test('drone só detecta no raio configurado e não oscila na borda durante a perseguição', () => {
    const { drone, sprite, playerAt } = chasingDrone();
    const { detectionRadius, loseTargetRadius, speed, chaseSpeed } = WORLD_CONFIG.drone;
    drone.update(playerAt(detectionRadius + 1));
    assert.equal(sprite.body.velocity.x, speed);
    drone.update(playerAt(detectionRadius));
    assert.equal(sprite.body.velocity.x, chaseSpeed);
    drone.update(playerAt(detectionRadius + 1));
    assert.equal(sprite.body.velocity.x, chaseSpeed);
    drone.update(playerAt(loseTargetRadius + 1));
    assert.equal(sprite.body.velocity.x, speed);
    assert.equal(sprite.body.velocity.y, 0);
});

test('drone mantém distância de tiro e orientação estável ao seguir verticalmente', () => {
    const { drone, sprite, playerAt } = chasingDrone();
    drone.update(playerAt(-100, 0));
    assert.equal(sprite.flipX, true);
    drone.update(playerAt(1, 100));
    assert.equal(sprite.flipX, true);
    drone.update(playerAt(0, WORLD_CONFIG.drone.stopDistance - 1));
    assert.equal(sprite.body.velocity.length(), 0);
    drone.update(playerAt(0, WORLD_CONFIG.drone.stopDistance + 10));
    assert.equal(sprite.body.velocity.y, WORLD_CONFIG.drone.chaseSpeed);
});

test('paredes impedem detectar e interrompem a perseguição ao bloquear a visão', () => {
    const tiles = [];
    const { drone, sprite, playerAt } = chasingDrone(tiles);
    const player = playerAt(100, 100);
    drone.update(player);
    assert.ok(sprite.body.velocity.y > 0);
    tiles.push({ getLeft: () => 340, getTop: () => 240, width: 32, height: 32 });
    drone.update(player);
    assert.equal(sprite.body.velocity.x, WORLD_CONFIG.drone.speed);
    assert.equal(sprite.body.velocity.y, 0);
    drone.update(player);
    assert.equal(sprite.body.velocity.y, 0);
});

test('drone abandona jogador morto e deixa de agir ao ser destruído', () => {
    const { drone, sprite, playerAt } = chasingDrone();
    const player = playerAt(100, 100);
    drone.update(player);
    player.takeDamage(100);
    drone.update(player);
    assert.equal(sprite.body.velocity.y, 0);
    drone.takeDamage(COMBAT_CONFIG.drone.maxHealth);
    drone.update(playerAt(-100));
    assert.equal(sprite.active, false);
    assert.equal(sprite.body.enable, false);
});

test('mundo registra uma única colisão interna para o grupo de drones', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const group = {};
    const colliders = [];
    world.physics = { add: {
        group: () => group,
        collider: (first, second) => colliders.push([first, second])
    } };
    assert.equal(world.createDroneBodies(), group);
    assert.deepEqual(colliders, [[group, group]]);
});

test('multiplayer desloca jogadores a partir do spawn da sala ativa', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { multiplayerClient } = load('../src/game/network/MultiplayerClient.ts');
    const world = new World();
    world.registry = { get: (key) => key === 'multiplayerEnabled' };
    multiplayerClient.playerId = 'player-2';
    multiplayerClient.match = {
        type: 'match.ready',
        roomId: 'publica',
        players: ['player-1', 'player-2']
    };

    assert.deepEqual(world.getPlayerSpawn(ROOM_DEFINITIONS.room2.spawn), {
        x: ROOM_DEFINITIONS.room2.spawn.x + 36,
        y: ROOM_DEFINITIONS.room2.spawn.y
    });
    multiplayerClient.disconnect();
});

test('mundo somente atravessa o portal depois de liberar a saida', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const launches = [];
    let pauses = 0;
    let stops = 0;
    let clears = 0;
    world.player = {
        health: new Health(4),
        sprite: { body: { center: { ...ROOM1_TO_ROOM2_GATEWAY.portal } } },
        getMovementSpeedMultiplier() { return 1; },
        stopMovement() { stops++; }
    };
    world.combat = { clear() { clears++; } };
    world.physics = { pause() { pauses++; } };
    world.scene = {
        launch(key, data) { launches.push({ key, data }); },
        bringToTop() {}
    };

    world.updateRoomGateway();
    assert.equal(launches.length, 0);

    world.isRoomExitOpen = true;
    world.updateRoomGateway();
    world.updateRoomGateway();

    assert.equal(launches.length, 1);
    assert.deepEqual(launches[0], {
        key: 'RoomTransition',
        data: {
            roomKey: 'room2',
            source: 'world',
            playerProgress: {
                currentHealth: 4,
                maxHealth: 4,
                movementSpeedMultiplier: 1,
                upgrades: [],
                chimarraos: 0,
                items: [],
                equipped: []
            }
        }
    });
    assert.equal(pauses, 1);
    assert.equal(stops, 1);
    assert.equal(clears, 1);
});

test('9090 elimina só a horda atual: as cartas e a próxima horda seguem; na última, a sala conclui', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    let clears = 0;
    let completions = 0;
    let intermissions = 0;
    let resumeIntermission;
    const createDrone = (health) => ({
        health: { current: health, isAlive: true },
        takeDamage(amount) {
            this.health.current = Math.max(0, this.health.current - amount);
            this.health.isAlive = this.health.current > 0;
        }
    });
    world.activeRoomKey = 'room3';
    world.isGameplayReady = true;
    world.drones = [];
    world.combat = { clear() { clears++; } };
    // Duas hordas de 5 que nascem de 2 em 2: a primeira ainda tem gente para nascer quando o atalho entra.
    const hordes = [{ batchSize: 2, maxAlive: 2, interval: 1_000 }, { batchSize: 2, maxAlive: 2, interval: 1_000 }];
    world.waves = new DroneWaves(
        (count) => { for (let index = 0; index < count; index++) world.drones.push(createDrone(30)); return count; },
        () => { completions++; },
        (resume) => { intermissions++; resumeIntermission = resume; },
        [5, 5],
        hordes
    );
    world.completeRoomCombat = () => { completions++; };
    world.waves.update(world.drones, 16);
    assert.equal(world.drones.length, 2, 'a horda 1 começou');

    for (const key of '909') world.handleSecretCodeKey({ key, repeat: false });
    assert.ok(world.drones.every((drone) => drone.health.isAlive));
    world.handleSecretCodeKey({ key: '0', repeat: false });
    assert.ok(world.drones.every((drone) => !drone.health.isAlive), 'a horda atual morre');
    assert.equal(clears, 1);
    assert.equal(completions, 0, 'a sala não conclui no meio');
    world.waves.update(world.drones, 16);
    assert.equal(world.drones.length, 2, 'quem faltava nascer na horda 1 não nasce');
    assert.equal(intermissions, 1, 'as cartas abrem antes da horda 2');

    resumeIntermission();
    assert.equal(world.drones.length, 4, 'a horda 2 começa depois das cartas');
    for (const key of '9090') world.handleSecretCodeKey({ key, repeat: false });
    world.waves.update(world.drones, 16);
    assert.equal(completions, 1, 'na última horda o atalho leva à conclusão da sala');

    // Sem hordas em andamento, o atalho conclui a sala como antes.
    world.activeRoomKey = 'gaucho-dungeon';
    world.isRoomCombatComplete = false;
    world.waves = undefined;
    world.drones = [createDrone(20)];
    for (const key of '9090') world.handleSecretCodeKey({ key, repeat: false });
    assert.equal(world.drones[0].health.isAlive, false);
    assert.equal(completions, 2, 'o segredo conclui o esconderijo dos gaúchos');

    world.activeRoomKey = 'dungeon';
    world.drones = [createDrone(20)];
    for (const key of '9090') world.handleSecretCodeKey({ key, repeat: false });
    assert.equal(world.drones[0].health.isAlive, true, 'o segredo não vale na dungeon da Sala II');
});

test('mundo bloqueia combate e HUD até a revelação; reinício não espera outra transição', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    let combatUpdates = 0;
    let movementUpdates = 0;
    let resumes = 0;
    let restartData;
    const launches = [];
    const stoppedScenes = [];
    world.player = { health: new Health(100), update() { movementUpdates++; } };
    world.combat = { update() { combatUpdates++; }, clear() {}, hasSword: () => false };
    world.activeRoomKey = 'dungeon';
    world.activeSpawn = ROOM_DEFINITIONS.dungeon.spawn;
    world.physics = { resume() { resumes++; }, pause() {} };
    world.scene = {
        launch(key, data) { launches.push({ key, data }); },
        stop(key) { stoppedScenes.push(key); },
        restart(data) { restartData = data; }
    };
    world.update(1000, 16);
    assert.equal(combatUpdates, 0);
    assert.equal(movementUpdates, 0);
    assert.equal(launches.length, 0);
    world.startGameplay();
    world.startGameplay();
    assert.equal(resumes, 1);
    assert.equal(launches.length, 1);
    assert.equal(launches[0].key, 'CombatHud');
    const { getUseAction } = launches[0].data;
    assert.equal(getUseAction(), undefined, 'sem espada e longe do bar, o botão USAR de toque some');
    world.piranhasBarPrompt = { visible: true };
    assert.equal(getUseAction(), 'interact');
    world.combat.hasSword = () => true;
    assert.equal(getUseAction(), 'sword');
    world.player.health.takeDamage(100);
    assert.equal(getUseAction(), undefined, 'na derrota o botão USAR some');
    world.player.health = new Health(100);
    world.piranhasBarPrompt = undefined;
    world.update(2000, 16);
    assert.equal(combatUpdates, 1);
    assert.equal(movementUpdates, 1);
    world.player.health.takeDamage(100);
    world.update(2016, 16);
    assert.equal(restartData, undefined, 'a derrota sozinha não pode reiniciar a partida');
    runTracker.startNew('SINGLE_PLAYER');
    runTracker.recordDungeonCompletion('dungeon');
    launches[0].data.onRestart();
    assert.deepEqual(stoppedScenes, [
        'PauseMenu',
        'ArcadeMinigame',
        'ConfirmPrompt',
        'WalletMenu',
        'RoomTransition',
        'ReturnToMenuTransition',
        'CombatHud'
    ]);
    assert.equal(restartData.waitForReveal, false);
    assert.equal(restartData.roomKey, 'room1');
    assert.deepEqual(restartData.spawn, ROOM_DEFINITIONS.room1.spawn);
    assert.equal(runTracker.snapshot().score.dungeonPoints, 0, 'o placar deve pertencer à nova partida');
    runTracker.abandon();
});

test('voltar ao menu após derrota usa a transição suave de saída', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const stopped = [];
    const launched = [];
    let launchData;
    const topScenes = [];
    world.scene = {
        stop(key) { stopped.push(key); },
        launch(key, data) { launched.push(key); launchData = data; },
        bringToTop(key) { topScenes.push(key); }
    };

    world.returnToMainMenuFromDefeat();

    assert.deepEqual(stopped, [
        'PauseMenu',
        'ArcadeMinigame',
        'ConfirmPrompt',
        'WalletMenu',
        'RoomTransition',
        'ReturnToMenuTransition',
        'CombatHud'
    ]);
    assert.deepEqual(launched, ['ReturnToMenuTransition']);
    assert.deepEqual(launchData, { saveContinuation: false });
    assert.deepEqual(topScenes, ['ReturnToMenuTransition']);
});

test('transição de retorno não coloca o menu acima de overlays como o placar', () => {
    const { ReturnToMenuTransition } = load('../src/game/scenes/ReturnToMenuTransition.ts');
    const { musicDirector } = load('../src/game/audio/MusicDirector.ts');
    const originalTransitionTo = musicDirector.transitionTo;
    const transition = new ReturnToMenuTransition();
    const actions = [];
    const rectangle = {};
    for (const method of ['setOrigin', 'setScale', 'setDepth', 'setScrollFactor']) {
        rectangle[method] = () => rectangle;
    }
    transition.add = { rectangle: () => rectangle };
    transition.tweens = { add: ({ onComplete }) => onComplete() };
    transition.scene = {
        get: () => ({ saveContinuation: () => true }),
        stop: (key) => actions.push(['stop', key]),
        launch: (key) => actions.push(['launch', key]),
        sendToBack: (key) => actions.push(['back', key]),
        bringToTop: (key) => actions.push(['top', key])
    };
    musicDirector.transitionTo = () => undefined;

    try {
        transition.create();
    } finally {
        musicDirector.transitionTo = originalTransitionTo;
    }

    assert.deepEqual(actions, [
        ['stop', 'World'],
        ['stop', 'PauseMenu'],
        ['launch', 'MainMenu'],
        ['back', 'MainMenu'],
        ['stop', undefined]
    ]);
});

test('encerramento do mundo não falha quando a câmera já foi removida', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const stopped = [];
    world.scene = { stop(key) { stopped.push(key); } };
    world.cameras = { main: undefined };
    world.input = { off() {} };
    world.events = { off() {} };
    const previousPhaser = global.Phaser;
    global.Phaser = { Scenes: { Events: { RESUME: 'resume' } } };
    try {
        assert.doesNotThrow(() => world.shutdown());
        assert.deepEqual(stopped, ['CombatHud']);
    } finally {
        global.Phaser = previousPhaser;
    }
});

test('menu principal remove qualquer cena restante da partida anterior', () => {
    const { MainMenu } = load('../src/game/scenes/MainMenu.ts');
    const menu = new MainMenu();
    const stopped = [];
    menu.scene = { stop(key) { stopped.push(key); } };

    menu.stopResidualGameplayScenes();

    assert.deepEqual(stopped, [
        'World',
        'CombatHud',
        'PauseMenu',
        'ArcadeMinigame',
        'ConfirmPrompt',
        'WalletMenu',
        'RoomTransition'
    ]);
});

test('transição só libera o mundo quando a animação de revelação termina', () => {
    const { RoomTransition } = load('../src/game/scenes/RoomTransition.ts');
    const transition = new RoomTransition();
    const tweens = [];
    const timers = [];
    const launches = [];
    let starts = 0;
    let stopped = false;
    const graphic = () => {
        const object = {};
        for (const method of ['setOrigin', 'setScale', 'setDepth', 'setScrollFactor', 'setAlpha', 'setText']) {
            object[method] = () => object;
        }
        return object;
    };
    transition.add = { rectangle: graphic, text: graphic };
    transition.sound = {
        locked: false,
        add() {
            return {
                volume: 0,
                isPlaying: false,
                play() { this.isPlaying = true; },
                stop() { this.isPlaying = false; },
                destroy() {},
                setVolume(value) { this.volume = value; return this; }
            };
        }
    };
    transition.tweens = {
        add(config) { tweens.push(config); },
        addCounter(config) { return { config, stop() {} }; }
    };
    transition.time = { delayedCall(_delay, callback) { timers.push(callback); } };
    const worldScene = {
        sound: transition.sound,
        tweens: { addCounter(config) { return { config, stop() {} }; } },
        startGameplay() { starts++; }
    };
    transition.scene = {
        launch(key, data) { launches.push({ key, data }); },
        sendToBack() {},
        stop(key) { if (!key) stopped = true; },
        get() { return worldScene; }
    };
    transition.create();
    assert.equal(launches.length, 0);
    tweens[0].onComplete();
    assert.equal(launches[0].key, 'World');
    assert.equal(launches[0].data.waitForReveal, true);
    assert.equal(launches[0].data.roomKey, 'room1');
    assert.deepEqual(launches[0].data.spawn, ROOM_DEFINITIONS.room1.spawn);
    while (timers.length) timers.shift()();
    assert.equal(starts, 0);
    assert.equal(stopped, false);
    const reveal = tweens.find((tween) => tween.scaleX === 0);
    assert.ok(reveal);
    reveal.onComplete();
    assert.equal(starts, 1);
    assert.equal(stopped, true);
});

test('transição para room2 inicia o mundo no ponto indicado', () => {
    const { RoomTransition } = load('../src/game/scenes/RoomTransition.ts');
    const transition = new RoomTransition();
    const launches = [];
    const stopped = [];
    transition.scene = {
        stop(key) { stopped.push(key); },
        launch(key, data) { launches.push({ key, data }); },
        sendToBack() {}
    };

    transition.startWorldUnderTransition('room2');

    assert.deepEqual(stopped, ['CombatHud', 'MainMenu']);
    assert.equal(launches[0].key, 'World');
    assert.equal(launches[0].data.roomKey, 'room2');
    assert.deepEqual(launches[0].data.spawn, ROOM_DEFINITIONS.room2.spawn);
});

test('passagem entre salas reinicia World sem relancar o menu', () => {
    const { RoomTransition } = load('../src/game/scenes/RoomTransition.ts');
    const transition = new RoomTransition();
    const launches = [];
    const stopped = [];
    let restartData;
    const world = { scene: { restart(data) { restartData = data; } } };
    transition.scene = {
        stop(key) { stopped.push(key); },
        launch(key, data) { launches.push({ key, data }); },
        get() { return world; },
        sendToBack() {}
    };

    const playerProgress = {
        currentHealth: 3,
        maxHealth: 6,
        movementSpeedMultiplier: 1.2,
        upgrades: [['double-shot', 1]]
    };
    transition.startWorldUnderTransition('room2', 'world', playerProgress);

    assert.equal(launches.length, 0);
    assert.equal(restartData.roomKey, 'room2');
    assert.deepEqual(restartData.spawn, ROOM_DEFINITIONS.room2.spawn);
    assert.deepEqual(restartData.playerProgress, playerProgress);
    assert.deepEqual(stopped, ['CombatHud', 'MainMenu']);
});

test('abertura da room2 escreve Sala II antes de revelar o mapa', () => {
    const { RoomTransitionView } = load('../src/game/ui/RoomTransitionView.ts');
    const timers = [];
    const writtenTitles = [];
    const graphic = () => {
        const object = {};
        for (const method of ['setOrigin', 'setScale', 'setDepth', 'setScrollFactor', 'setAlpha']) {
            object[method] = () => object;
        }
        object.setText = (value) => {
            writtenTitles.push(value);
            return object;
        };
        return object;
    };
    const scene = {
        add: { rectangle: graphic, text: graphic },
        tweens: { add() {} },
        time: { delayedCall(_delay, callback) { timers.push(callback); } }
    };
    const view = new RoomTransitionView(scene, ROOM_DEFINITIONS.room2.title);
    let completed = false;

    view.typeTitle(() => { completed = true; });
    while (timers.length) timers.shift()();

    assert.equal(writtenTitles.at(-1), 'Sala II:\nO Antigo Terminal');
    assert.equal(completed, true);
});

test('diretor de música encerra uma faixa antes de iniciar gradualmente a próxima', () => {
    const sounds = [];
    const transitions = [];
    const scene = {
        sound: {
            locked: false,
            add(key, config) {
                const sound = {
                    key,
                    volume: config.volume,
                    isPlaying: false,
                    stopped: false,
                    destroyed: false,
                    play() { this.isPlaying = true; },
                    stop() { this.stopped = true; this.isPlaying = false; },
                    destroy() { this.destroyed = true; },
                    setVolume(value) { this.volume = value; return this; }
                };
                sounds.push(sound);
                return sound;
            },
            once(_event, callback) { this.unlockCallback = callback; },
            off(_event, callback) {
                if (this.unlockCallback === callback) this.unlockCallback = undefined;
            }
        },
        tweens: {
            addCounter(config) {
                const tween = { stopped: false, stop() { this.stopped = true; } };
                transitions.push({ config, tween });
                return tween;
            }
        }
    };
    const finish = (transition) => {
        transition.config.onUpdate({ getValue: () => 1 });
        transition.config.onComplete();
    };
    const director = new MusicDirector();

    director.play(scene, { key: 'menu', volume: 0.08 }, 2500);
    assert.equal(sounds[0].volume, 0);
    transitions[0].config.onUpdate({ getValue: () => 0.5 });
    assert.equal(sounds[0].volume, 0.04);
    director.play(scene, { key: 'menu', volume: 0.08 }, 2500);
    assert.equal(transitions.length, 1, 'o mesmo pedido não deve reiniciar o fade');
    finish(transitions[0]);

    director.play(scene, { key: 'room', volume: 0.08 }, 2500);
    assert.equal(sounds.length, 1);
    transitions[1].config.onUpdate({ getValue: () => 0.5 });
    assert.equal(sounds[0].volume, 0.04);
    finish(transitions[1]);

    assert.equal(sounds[0].stopped, true);
    assert.equal(sounds[0].destroyed, true);
    assert.equal(sounds.length, 2);
    assert.equal(sounds[1].key, 'room');
    assert.equal(sounds[1].volume, 0);
    transitions[2].config.onUpdate({ getValue: () => 0.5 });
    assert.equal(sounds[1].volume, 0.04);
    finish(transitions[2]);

    director.play(scene, { key: 'menu', volume: 0.08 }, 2500);
    assert.equal(sounds.length, 2);
    finish(transitions[3]);
    assert.equal(sounds[1].stopped, true);
    assert.equal(sounds[2].key, 'menu');
    assert.equal(sounds[2].volume, 0);
    finish(transitions[4]);
    assert.equal(sounds[2].volume, 0.08);

    director.stop(scene);
    scene.sound.locked = true;
    const deferredDirector = new MusicDirector();
    const transitionCount = transitions.length;
    deferredDirector.play(scene, { key: 'locked-menu', volume: 0.08 }, 2500);
    assert.equal(sounds[3].volume, 0);
    assert.equal(transitions.length, transitionCount);

    scene.sound.locked = false;
    scene.sound.unlockCallback();
    assert.equal(transitions.length, transitionCount + 1);
    transitions.at(-1).config.onUpdate({ getValue: () => 0.5 });
    assert.equal(sounds[3].volume, 0.04);
});

test('diretor força o GainNode real para zero antes de iniciar a música', () => {
    const transitions = [];
    const context = { currentTime: 4 };
    const gain = {
        value: 1,
        cancelScheduledValues() {},
        setValueAtTime(value) { this.value = value; }
    };
    const sounds = [];
    const manager = {
        context,
        locked: false,
        sounds,
        add(key) {
            const sound = {
                key,
                manager,
                pendingRemove: false,
                volumeNode: { gain },
                get volume() { return gain.value; },
                isPlaying: false,
                play() { this.isPlaying = true; },
                stop() { this.isPlaying = false; },
                destroy() { this.pendingRemove = true; },
                // Simula o comportamento problemático: a configuração muda,
                // mas o ganho do WebAudio continua em 1 enquanto suspenso.
                setVolume(value) { this.configuredVolume = value; return this; }
            };
            sounds.push(sound);
            return sound;
        },
        once() {},
        off() {}
    };
    const scene = {
        sound: manager,
        tweens: {
            addCounter(config) {
                const tween = { stop() {} };
                transitions.push({ config, tween });
                return tween;
            }
        }
    };

    const director = new MusicDirector();
    director.play(scene, { key: 'menu', volume: 0.12 }, 1800);

    assert.equal(sounds.length, 1);
    assert.equal(sounds[0].isPlaying, true);
    assert.equal(gain.value, 0, 'o nó de áudio não pode ser liberado no ganho padrão 1');
    assert.equal(transitions.length, 1);
});

test('menu usa o layout central, e o lateral somente com ?telas', () => {
    assert.equal(getMenuLayout(''), MENU_CONFIG.layouts.center);
    assert.equal(getMenuLayout('?room=2'), MENU_CONFIG.layouts.center);
    assert.equal(getMenuLayout('?telas'), MENU_CONFIG.layouts.side);
    assert.equal(getMenuLayout('?room=2&telas'), MENU_CONFIG.layouts.side);
    const textures = Object.values(MENU_CONFIG.layouts)
        .flatMap((layout) => layout.backgrounds.map(({ texture }) => texture));
    assert.equal(new Set(textures).size, textures.length);
});

test('multiplayer: inimigo mira o jogador vivo mais próximo', () => {
    const { nearestLivingTarget } = load('../src/game/network/coop.ts');
    const target = (x, isAlive = true) => ({
        health: { isAlive },
        sprite: { body: { center: { x, y: 0 } } },
        takeDamage() {}
    });
    const near = target(10, false);
    const middle = target(20);
    const far = target(90);

    assert.equal(nearestLivingTarget({ x: 0, y: 0 }, [far, near, middle]), middle);
    assert.equal(nearestLivingTarget({ x: 0, y: 0 }, [near]), undefined);
});

test('multiplayer: reviver exige o parceiro por perto e recomeça ao sair', () => {
    const { advanceRevive, isWithinReviveRadius } = load('../src/game/network/coop.ts');
    const { multiplayer } = COMBAT_CONFIG;

    assert.equal(multiplayer.reviveDuration, 5000);
    assert.equal(advanceRevive(4000, 16, true), 4016);
    assert.equal(advanceRevive(4000, 16, false), 0);
    assert.equal(isWithinReviveRadius({ x: 0, y: 0 }, { x: multiplayer.reviveRadius, y: 0 }), true);
    assert.equal(isWithinReviveRadius({ x: 0, y: 0 }, { x: multiplayer.reviveRadius + 1, y: 0 }), false);
});

test('multiplayer: cartas só liberam após as duas escolhas, em qualquer ordem', () => {
    const { CardBarrier } = load('../src/game/network/coop.ts');
    const barrier = new CardBarrier();
    let releases = 0;

    barrier.open();
    barrier.chooseLocal(() => { releases += 1; });
    assert.equal(barrier.isWaitingForPeer, true);
    assert.equal(releases, 0);
    barrier.choosePeer();
    assert.equal(releases, 1);
    assert.equal(barrier.isWaitingForPeer, false);

    barrier.open();
    barrier.choosePeer();
    assert.equal(releases, 1);
    barrier.chooseLocal(() => { releases += 1; });
    assert.equal(releases, 2);
    barrier.choosePeer();
    assert.equal(releases, 2);
});

test('multiplayer: vida de inimigo só desce e o estado vazio derruba o inimigo', () => {
    const { applyEnemySnapshotHealth } = load('../src/game/network/coop.ts');
    const enemy = {
        health: { current: 6, get isAlive() { return this.current > 0; } },
        takeDamage(amount) { this.health.current -= amount; return amount; }
    };

    assert.equal(applyEnemySnapshotHealth(enemy, [0, 0, 8, 0, 0]), 0);
    assert.equal(enemy.health.current, 6);
    assert.equal(applyEnemySnapshotHealth(enemy, [0, 0, 4, 0, 0]), 2);
    assert.equal(applyEnemySnapshotHealth(enemy, null), 4);
    assert.equal(enemy.health.isAlive, false);
});

test('multiplayer: convidado não decide dano nem dispara pelos inimigos', () => {
    const { combat, groups, drones, overlaps } = setup([[150, 100]]);
    const hits = [];
    combat.setNetwork({
        isHost: false,
        getEnemyTarget: () => undefined,
        onEnemyShot() {},
        onPlayerShot() {},
        onEnemyHit: (enemy, damage) => hits.push({ enemy, damage })
    });

    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[1].shots.length, 0);
    assert.equal(groups[0].shots.length, 1);
    const health = drones[0].health.current;
    overlaps[0].hit(groups[0].shots[0]);
    assert.equal(drones[0].health.current, health);
    assert.deepEqual(hits, [{ enemy: drones[0], damage: COMBAT_CONFIG.player.damage }]);
});

test('multiplayer: anfitrião caído mantém inimigos atirando no parceiro', () => {
    const { combat, groups, player } = setup([[150, 100]]);
    const partner = { health: { isAlive: true }, sprite: { body: { center: { x: 150, y: 150 } } } };
    const sent = [];
    combat.setNetwork({
        isHost: true,
        getEnemyTarget: () => partner,
        onEnemyShot: (x, y, angle) => sent.push(angle),
        onPlayerShot() {},
        onEnemyHit() {}
    });
    player.takeDamage(player.health.current);

    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 1);
    assert.equal(sent.length, 1);
    assert.ok(groups[1].shots[0].velocity.y > 0);
});

function downedWorld() {
    const { World } = load('../src/game/scenes/World.ts');
    const { multiplayerClient } = load('../src/game/network/MultiplayerClient.ts');
    const world = new World();
    world.registry = { get: (key) => key === 'multiplayerEnabled' };
    const health = new Health(4);
    health.takeDamage(4);
    const body = { enable: true, center: { x: 0, y: 0 } };
    const sprite = { x: 0, y: 0, body, setAngle() { return this; } };
    world.player = {
        health, sprite,
        revive(amount) { health.heal(amount); body.enable = true; }
    };
    world.remotePlayers.set('parceiro', { isAlive: true, feet: { x: 0, y: 0 } });
    return { world, health, body, multiplayerClient };
}

test('multiplayer: corpo caído perde a física e volta ao reviver', () => {
    const { world, health, body, multiplayerClient } = downedWorld();
    multiplayerClient.revivesUsed = 0;

    world.updateRevive(16);
    assert.equal(body.enable, false);
    world.updateRevive(COMBAT_CONFIG.multiplayer.reviveDuration);
    assert.equal(health.isAlive, true);
    assert.equal(body.enable, true);
    assert.equal(multiplayerClient.revivesUsed, 1);
    multiplayerClient.disconnect();
});

test('multiplayer: sem renascimentos o jogador permanece morto', () => {
    const { world, health, body, multiplayerClient } = downedWorld();
    multiplayerClient.revivesUsed = COMBAT_CONFIG.multiplayer.maxRevives;

    world.updateRevive(COMBAT_CONFIG.multiplayer.reviveDuration * 2);
    assert.equal(world.reviveElapsed, 0);
    world.revivePlayer();
    assert.equal(health.isAlive, false);
    assert.equal(body.enable, false);
    assert.equal(multiplayerClient.revivesUsed, COMBAT_CONFIG.multiplayer.maxRevives);
    multiplayerClient.disconnect();
});

test('multiplayer: carta de vida não levanta quem está caído', () => {
    const { world, health } = downedWorld();
    world.upgrades.reset();
    const card = world.upgrades.availableCards().find(({ effect }) => effect.type === 'increase-max-health');

    world.acquireUpgrade(card);
    assert.equal(health.isAlive, false);
    assert.equal(health.max, 4 + card.effect.amount);
    world.upgrades.reset();
});

test('bueiro da Room 1 leva ao esconderijo dos gaúchos sem precisar de parede', () => {
    const gateway = ROOM1_TO_GAUCHO_DUNGEON_GATEWAY;
    const x = (gateway.area.left + gateway.area.right) / 2;
    const y = (gateway.area.top + gateway.area.bottom) / 2;
    assert.equal(gateway.to, 'gaucho-dungeon');
    assert.equal(gateway.wall, undefined);
    assert.equal(isInsideRoomGateway(gateway.returnSpawn.x, gateway.returnSpawn.y + 11, gateway), false);
    assert.equal(isTouchingSecretDungeonEntrance(x, y, true, gateway), true);
    assert.equal(isTouchingSecretDungeonEntrance(x, y, true), false);
    assert.equal(getRequestedRoomKey('?room=gaucho-dungeon'), 'gaucho-dungeon');
});

test('esconderijo só tem gaúchos e a primeira horda da Sala II traz 5 bicicletas', () => {
    assert.deepEqual(new Set(getWaveEnemyKinds('gaucho-dungeon', 0, 10)), new Set(['gaucho']));
    const room2 = getWaveEnemyKinds('room2', 0, COMBAT_CONFIG.wavesByRoom.room2[0]);
    assert.deepEqual(room2.slice(0, 2), ['guard', 'guard'], 'os guardas da escada vêm primeiro');
    const counts = {};
    for (const kind of room2) counts[kind] = (counts[kind] ?? 0) + 1;
    assert.deepEqual(counts, { guard: 6, drone: 2, scooter: 2, gaucho: 2, bike: 5 });
    assert.equal(new Set(getWaveEnemyKinds('room1', 1, 20)).has('gaucho'), false);
});

function gauchoAt(callbacks) {
    const { Gaucho } = load('../src/game/entities/Gaucho.ts');
    const world = new ArcadeWorld({ sys: { scale: { width: 800, height: 640 } } }, {});
    const sprite = {
        x: 300, y: 208, active: true, body: new ArcadeBody(world),
        setScale() { return this; }, setDepth() { return this; }, setCollideWorldBounds() { return this; },
        play() {}, setTint() {}, clearTint() {},
        disableBody() { this.active = false; this.body.enable = false; }
    };
    const graphics = { clear() { return this; }, fillStyle() { return this; }, fillRect() { return this; }, setDepth() { return this; } };
    const scene = {
        sound: { play() {} },
        cameras: { main: { shake() {} } },
        physics: { add: { sprite: () => sprite } },
        anims: {
            exists: () => true,
            generateFrameNumbers: () => [],
            create() {}
        },
        time: { delayedCall() {} },
        add: {
            graphics: () => graphics,
            sprite: () => Object.assign(new (require('node:events').EventEmitter)(), {
                setDepth() { return this; }, play() {}, destroy() {}
            })
        }
    };
    const gaucho = new Gaucho(
        scene,
        { x: 300, y: 208, patrolLeft: 260, patrolRight: 360 },
        [{ getTilesWithinWorldXY: () => [] }],
        callbacks
    );
    sprite.body.position.set(sprite.x - sprite.body.halfWidth, sprite.y - sprite.body.halfHeight);
    sprite.body.updateCenter();
    const playerAt = (dx) => fighter(sprite.body.center.x + dx, sprite.body.center.y, COMBAT_CONFIG.player.maxHealth);
    return { gaucho, sprite, playerAt };
}

test('gaúcho bate de perto respeitando o intervalo e não acerta quem está longe', () => {
    const strikes = [];
    const { gaucho, playerAt } = gauchoAt({ onStrike: (target) => strikes.push(target) });
    const far = playerAt(COMBAT_CONFIG.gaucho.range + 5);
    gaucho.update(far, 16);
    assert.equal(far.health.current, COMBAT_CONFIG.player.maxHealth);

    const near = playerAt(COMBAT_CONFIG.gaucho.range - 5);
    gaucho.update(near, 16);
    assert.equal(near.health.current, COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.gaucho.damage);
    assert.deepEqual(strikes, [near]);

    gaucho.update(near, COMBAT_CONFIG.gaucho.attackInterval / 2);
    assert.equal(near.health.current, COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.gaucho.damage);
    gaucho.update(near, COMBAT_CONFIG.gaucho.attackInterval);
    assert.equal(near.health.current, COMBAT_CONFIG.player.maxHealth - 2 * COMBAT_CONFIG.gaucho.damage);
});

test('gaúcho ignora jogador caído e avisa onde morreu', () => {
    const defeats = [];
    const { gaucho, sprite, playerAt } = gauchoAt({ onDefeated: (x, y) => defeats.push([x, y]) });
    const down = playerAt(5);
    down.takeDamage(down.health.current);
    gaucho.update(down, 16);
    assert.equal(sprite.body.velocity.y, 0);

    gaucho.takeDamage(gaucho.health.current);
    gaucho.takeDamage(1);
    assert.deepEqual(defeats, [[sprite.body.center.x, sprite.body.center.y]]);
    assert.equal(sprite.active, false);
});

test('espada acerta só quem está no arco e no alcance, sem tiro automático', () => {
    const { combat, player, drones, groups } = setup(
        [[125, 100], [75, 100], [180, 100]],
        [],
        new PlayerUpgradeState(),
        undefined,
        true
    );
    const [front, behind, far] = drones;
    const { maxHealth } = COMBAT_CONFIG.drone;
    const swordDamage = COMBAT_CONFIG.player.damage * COMBAT_CONFIG.melee.damageMultiplier;
    player.getAimDirection = () => ({ x: 1, y: 0 });

    combat.update(1_000);
    assert.equal(groups[0].getLength(), 0);

    assert.equal(combat.swing(0), false);
    assert.equal(combat.hasSword(), false, 'botão USAR de toque não mostra a espada antes da coleta');
    combat.equipSword();
    assert.equal(combat.hasSword(), true);
    assert.equal(combat.swing(0), true);
    assert.equal(combat.hasSword(), true, 'a espada continua na mão depois do golpe');
    assert.equal(front.health.current, maxHealth - swordDamage);
    assert.equal(behind.health.current, maxHealth);
    assert.equal(far.health.current, maxHealth);

    assert.equal(combat.swing(0), false);
    combat.update(COMBAT_CONFIG.melee.interval);
    assert.equal(combat.swing(Math.PI), true);
    assert.equal(behind.health.current, maxHealth - swordDamage);

    // Clique no fim da recarga sai sozinho, na direção para onde o personagem olha agora.
    combat.update(COMBAT_CONFIG.melee.interval - COMBAT_CONFIG.melee.bufferWindow / 2);
    assert.equal(combat.swing(), false);
    combat.update(COMBAT_CONFIG.melee.bufferWindow);
    assert.equal(front.health.isAlive, false);
});

test('espada não funciona nas salas com tiro', () => {
    const { combat, drones } = setup([[125, 100]]);
    combat.equipSword();
    assert.equal(combat.swing(0), false);
    assert.equal(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth);
});

function coopNetwork(isHost, record) {
    return {
        isHost,
        getEnemyTarget() {},
        onEnemyShot() {},
        onPlayerShot() {},
        onPlayerSwing: (x, y, angle) => record.swings.push({ x, y, angle }),
        onEnemyHit: (enemy, damage, direction) => record.hits.push({ enemy, damage, direction })
    };
}

test('multiplayer: golpe do convidado vai ao anfitrião e não aplica dano local', () => {
    const { combat, drones, player } = setup([[125, 100]], [], new PlayerUpgradeState(), undefined, true);
    player.getAimDirection = () => ({ x: 1, y: 0 });
    const record = { swings: [], hits: [] };
    combat.setNetwork(coopNetwork(false, record));
    combat.equipSword();

    assert.equal(combat.swing(0), true);
    assert.equal(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth);
    assert.equal(record.swings.length, 1);
    assert.equal(record.hits.length, 1);
    assert.equal(record.hits[0].enemy, drones[0]);
    assert.equal(record.hits[0].damage, COMBAT_CONFIG.player.damage * COMBAT_CONFIG.melee.damageMultiplier);
    assert.deepEqual(record.hits[0].direction, { x: 1, y: 0 });
});

test('multiplayer: efeitos das cartas de área vão ao parceiro e se repetem na tela dele', () => {
    for (const [id, effect] of [
        ['shock-pulse', 'shockwave'],
        ['blast-shot', 'explosion'],
        ['chain-lightning', 'lightning'],
        ['death-blast', 'explosion'],
        ['light-beams', 'beams'],
        ['nova-pulse', 'shockwave'],
        ['thunder-storm', 'lightning']
    ]) {
        const upgrades = new PlayerUpgradeState();
        upgrades.acquire(getUpgradeCard(id));
        const { combat, drones, overlaps, groups, effects } = setup([[140, 100], [160, 100]], [], upgrades);
        drones[0].health.current = 1;
        const sent = [];
        combat.setNetwork({ ...coopNetwork(true, { swings: [], hits: [] }), onPlayerEffect: (e) => sent.push(e) });
        combat.update(0);
        for (const shot of groups[0].shots) overlaps[0].hit(shot);
        combat.update(1_000);
        assert.ok(sent.some((e) => e.effect === effect), `${id} envia ${effect}`);

        const before = effects.length;
        for (const e of sent) combat.playPartnerEffect(JSON.parse(JSON.stringify(e)));
        assert.equal(effects.length, before + sent.length, `${id} desenha o efeito recebido`);
    }
});

test('multiplayer: detonação do convidado sai quando o anfitrião confirma o abate', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('death-blast'));
    const { combat, drones, effects } = setup([[140, 100], [160, 100], [400, 100]], [], upgrades);
    const record = { swings: [], hits: [] };
    const sent = [];
    combat.setNetwork({ ...coopNetwork(false, record), onPlayerEffect: (e) => sent.push(e) });
    // O anfitrião já matou o alvo e avisou o convidado.
    drones[0].health.current = 0;
    combat.detonateConfirmedKill(drones[0], 'abate');

    assert.deepEqual(record.hits.map((hit) => hit.enemy), [drones[1]], 'só o vizinho no raio, sem o abatido');
    assert.equal(record.hits[0].damage, upgrades.damage * getUpgradeCard('death-blast').effect.damageRatio);
    assert.equal(drones[1].health.current, COMBAT_CONFIG.drone.maxHealth, 'quem aplica o dano é o anfitrião');
    assert.deepEqual(sent.map((e) => e.effect), ['explosion']);
    assert.equal(effects.length, 1, 'a explosão aparece também para o convidado');
});

test('multiplayer: abate confirmado pelo anfitrião dispara a detonação do convidado', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const enemy = { id: 'enemy-0' };
    const detonated = [];
    world.drones = [enemy];
    world.combat = { detonateConfirmedKill: (target, id) => detonated.push({ target, id }) };
    world.playHitStop = () => {};
    world.handleCoopEvent({ kind: 'enemy.killed', index: 0 });
    world.handleCoopEvent({ kind: 'enemy.killed', index: 5 });

    assert.equal(detonated.length, 1, 'índice inexistente é ignorado');
    assert.equal(detonated[0].target, enemy);
    assert.equal(detonated[0].id, 'enemy-0:coop-kill');
});

test('multiplayer: tiro perfurante atravessa inimigos também na tela do parceiro', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('piercing-shot'));
    const { combat, drones, groups, overlaps } = setup([[150, 100], [170, 100], [190, 100]], [], upgrades);
    const shots = [];
    combat.setNetwork({ ...coopNetwork(true, { swings: [], hits: [] }), onPlayerShot: (...args) => shots.push(args) });
    combat.update(0);
    assert.equal(shots[0][5], upgrades.piercingTargets, 'quem atira avisa quantas perfurações o tiro tem');

    // No jogo os inimigos nascem depois do setNetwork; aqui entram de novo para ganhar o overlap do parceiro.
    combat.enemyCooldowns.clear();
    const start = overlaps.length;
    drones.forEach((drone) => combat.registerDrone(drone));
    const partnerShots = groups[groups.length - 1];
    const partnerHit = (index, shot) => overlaps[start + index * 2].hit(shot);

    combat.spawnPartnerShot(100, 100, 0, 300, 0xffffff, 1);
    const piercing = partnerShots.shots[0];
    partnerHit(0, piercing);
    assert.equal(piercing.active, true, 'atravessa o primeiro');
    partnerHit(0, piercing);
    assert.equal(piercing.active, true, 'o mesmo inimigo não gasta outra perfuração');
    partnerHit(1, piercing);
    assert.equal(piercing.active, false, 'para no segundo');

    combat.spawnPartnerShot(100, 100, 0, 300, 0xffffff);
    const common = partnerShots.shots[1];
    partnerHit(2, common);
    assert.equal(common.active, false, 'tiro comum para no primeiro');
});

test('multiplayer: faíscas e drone só aparecem para o parceiro quando estão agindo', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { multiplayerClient } = load('../src/game/network/MultiplayerClient.ts');
    const world = new World();
    world.registry = { get: (key) => key === 'multiplayerEnabled' };
    world.player = {
        sprite: { x: 0, y: 0, body: { center: { x: 0, y: 0 } } },
        health: new Health(5),
        getNetworkState: () => ({ x: 0, y: 0, facing: 'down' })
    };
    world.upgrades.acquire(getUpgradeCard('spark-orbit'));
    world.upgrades.acquire(getUpgradeCard('companion-drone'));
    const sent = [];
    const originalSend = multiplayerClient.sendPlayerState;
    multiplayerClient.sendPlayerState = (state) => sent.push(state);
    const sync = (roomKey) => {
        world.activeRoomKey = roomKey;
        world.multiplayerSyncElapsed = 0;
        world.updateMultiplayer(50);
        return sent.at(-1);
    };
    try {
        assert.equal(sync('room2').orbitCount, 4);
        assert.equal(sync('room2').companion, true);
        assert.equal(sync('gaucho-dungeon').orbitCount, 0, 'sala corpo a corpo não usa as cartas');
        assert.equal(sync('gaucho-dungeon').companion, false);
        world.player.health.takeDamage(5);
        assert.equal(sync('room2').orbitCount, 0, 'caído não ataca com as faíscas');
        assert.equal(sync('room2').companion, false);
    } finally {
        multiplayerClient.sendPlayerState = originalSend;
    }
});

test('multiplayer: golpe do anfitrião causa dano e só avisa o parceiro do movimento', () => {
    const { combat, drones, player } = setup([[125, 100]], [], new PlayerUpgradeState(), undefined, true);
    player.getAimDirection = () => ({ x: 1, y: 0 });
    const record = { swings: [], hits: [] };
    combat.setNetwork(coopNetwork(true, record));
    combat.equipSword();

    combat.swing(0);
    assert.ok(drones[0].health.current < COMBAT_CONFIG.drone.maxHealth);
    assert.equal(record.swings.length, 1);
    assert.equal(record.hits.length, 0);
});

function itemWorld() {
    const { World } = load('../src/game/scenes/World.ts');
    const { Player } = load('../src/game/entities/Player.ts');
    const { multiplayerClient } = load('../src/game/network/MultiplayerClient.ts');
    const world = new World();
    const player = Object.create(Player.prototype);
    player.movementSpeedMultiplier = 1;
    player.temporaryMovementSpeedMultiplier = 1;
    player.equipmentSpeedMultiplier = 1;
    player.sprite = {};
    world.player = player;
    const fireRateMultipliers = [];
    world.combat = {
        setPlayerFireRateMultiplier(multiplier) { fireRateMultipliers.push(multiplier); }
    };
    const timers = [];
    world.time = {
        delayedCall(delay, callback) {
            const timer = {
                delay,
                callback,
                removed: false,
                remove() { this.removed = true; }
            };
            timers.push(timer);
            return timer;
        }
    };
    const pickups = [];
    world.physics = {
        add: {
            image() { return { setDepth() { return this; }, destroy() { this.destroyed = true; } }; },
            overlap(_player, _item, callback) { pickups.push(callback); return { destroy() {} }; }
        }
    };
    const sent = [];
    const originalSend = multiplayerClient.sendEvent;
    multiplayerClient.sendEvent = (event) => sent.push(event);
    const restore = () => { multiplayerClient.sendEvent = originalSend; multiplayerClient.disconnect(); };
    return { world, player, pickups, fireRateMultipliers, timers, sent, multiplayerClient, restore };
}

test('cuia de gaúcho aumenta movimento e tiro em 50% por três segundos', () => {
    const { world, player, pickups, fireRateMultipliers, timers, restore } = itemWorld();
    world.dropChimarrao(0, 0, () => 0.99);
    assert.equal(pickups.length, 0);

    world.dropChimarrao(0, 0, () => 0);
    pickups.pop()();
    assert.equal(player.getMovementSpeedMultiplier(), 1, 'não altera o bônus permanente da build');
    assert.equal(player.getEffectiveMovementSpeedMultiplier(), WORLD_CONFIG.chimarrao.effectMultiplier);
    assert.deepEqual(fireRateMultipliers, [WORLD_CONFIG.chimarrao.effectMultiplier]);
    assert.equal(timers[0].delay, WORLD_CONFIG.chimarrao.effectDuration);

    timers[0].callback();
    assert.equal(player.getEffectiveMovementSpeedMultiplier(), 1);
    assert.deepEqual(fireRateMultipliers, [WORLD_CONFIG.chimarrao.effectMultiplier, 1]);
    restore();
});

test('todo gaúcho larga cuia na dungeon dele, e só 20% nas salas normais', () => {
    const { world, pickups, restore } = itemWorld();
    world.activeRoomKey = 'room2';
    world.dropChimarrao(0, 0, () => 0.19);
    world.dropChimarrao(0, 0, () => 0.2);
    assert.equal(pickups.length, 1, 'sala normal sorteia 20%');

    world.activeRoomKey = 'gaucho-dungeon';
    world.dropChimarrao(0, 0, () => 0.999);
    assert.equal(pickups.length, 2, 'na dungeon sempre larga');
    restore();
});

test('pegar outra cuia renova os três segundos sem acumular o bônus', () => {
    const { world, player, pickups, fireRateMultipliers, timers, restore } = itemWorld();
    world.dropChimarrao(0, 0, () => 0);
    pickups.pop()();
    world.dropChimarrao(0, 0, () => 0);
    pickups.pop()();

    assert.equal(timers.length, 2);
    assert.equal(timers[0].removed, true);
    assert.equal(timers[1].delay, WORLD_CONFIG.chimarrao.effectDuration);
    assert.equal(player.getEffectiveMovementSpeedMultiplier(), WORLD_CONFIG.chimarrao.effectMultiplier);
    assert.deepEqual(fireRateMultipliers, [
        WORLD_CONFIG.chimarrao.effectMultiplier,
        WORLD_CONFIG.chimarrao.effectMultiplier
    ]);
    restore();
});

test('multiplayer: só o anfitrião sorteia o chimarrão e quem pega primeiro fica com ele', () => {
    const { world, player, pickups, sent, multiplayerClient, restore } = itemWorld();
    world.registry = { get: (key) => key === 'multiplayerEnabled' };

    Object.defineProperty(multiplayerClient, 'isHost', { configurable: true, value: false });
    world.dropChimarrao(10, 20, () => 0);
    assert.equal(pickups.length, 0);
    assert.equal(sent.length, 0);

    Object.defineProperty(multiplayerClient, 'isHost', { configurable: true, value: true });
    world.dropChimarrao(10, 20, () => 0);
    assert.deepEqual(sent, [{ kind: 'item.drop', id: 1, x: 10, y: 20 }]);

    // O parceiro pegou antes: o item some aqui e não dá bônus.
    world.handleCoopEvent({ kind: 'item.collected', id: 1 });
    assert.equal(world.droppedItems.size, 0);
    assert.equal(player.getEffectiveMovementSpeedMultiplier(), 1);

    world.handleCoopEvent({ kind: 'item.drop', id: 2, x: 0, y: 0 });
    sent.length = 0;
    pickups.pop()();
    assert.deepEqual(sent, [{ kind: 'item.collected', id: 2 }]);
    assert.equal(player.getEffectiveMovementSpeedMultiplier(), WORLD_CONFIG.chimarrao.effectMultiplier);
    delete multiplayerClient.isHost;
    restore();
});

test('multiplayer: convidado adota a semente do anfitrião ao trocar de sala', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const transitions = [];
    world.beginRoomTransition = (roomKey, options) => transitions.push({ roomKey, options });
    world.dungeonState = createDungeonSessionState(111);

    world.handleCoopEvent({ kind: 'room.transition', roomKey: 'gaucho-dungeon', seed: 222 });
    assert.equal(world.dungeonState.seed, 222);
    assert.equal(transitions[0].options.dungeonState, world.dungeonState);

    world.dungeonState = undefined;
    world.handleCoopEvent({ kind: 'room.transition', roomKey: 'dungeon', seed: 333 });
    assert.equal(world.dungeonState.seed, 333);
});

test('sala vencida fica marcada ao sair para reabrir a saída na volta', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    world.activeRoomKey = 'room1';
    world.dungeonState = createDungeonSessionState(1);
    world.drones = [];
    world.isRoomCombatComplete = true;
    world.rememberCombatProgress();
    assert.deepEqual(world.dungeonState.savedCombat.room1, { enemies: [], pendingWaves: [], hordeRemaining: 0, cleared: true });
});

test('recompensa do esconderijo não gasta a da dungeon principal', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    world.activeRoomKey = 'gaucho-dungeon';
    world.dungeonState = { ...createDungeonSessionState(1), rewardClaimed: true };
    world.player = {};
    let opened = 0;
    world.combat = { clear() { opened++; } };
    world.physics = { pause() {} };
    world.scene = { get: () => { throw new Error('abre a carta'); } };
    assert.throws(() => world.playDungeonReward(() => assert.fail('não deveria pular a recompensa')), /abre a carta/);
    assert.equal(opened, 1);
});

test('multiplayer usa /ws no site publicado e a porta 8080 localmente', () => {
    const { getDefaultServerUrl } = load('../src/game/network/MultiplayerClient.ts');
    assert.equal(
        getDefaultServerUrl({ protocol: 'https:', host: 'escape-from-floripa.negoci.online', hostname: 'escape-from-floripa.negoci.online' }),
        'wss://escape-from-floripa.negoci.online/ws'
    );
    assert.equal(
        getDefaultServerUrl({ protocol: 'http:', host: 'localhost:1234', hostname: 'localhost' }),
        'ws://localhost:8080'
    );
});

test('nome da sala aceita só o que o servidor mantém', () => {
    const { editRoomName } = load('../src/game/ui/MainMenuView.ts');
    let name = '';
    for (const key of ['S', 'a', 'l', 'a', '-', '1', ' ', 'ç', 'Shift', 'Enter']) name = editRoomName(name, key);
    assert.equal(name, 'sala-1');
    assert.equal(editRoomName(name, 'Backspace'), 'sala-');
    assert.equal(editRoomName('', 'Backspace'), '');
    assert.equal(editRoomName('a'.repeat(20), 'b').length, 20);
});

test('dica da espada aparece ao equipar e some no primeiro golpe que sai', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    let swings = false;
    let destroyed = 0;
    const hint = { setOrigin() { return this; }, setDepth() { return this; }, setResolution() { return this; }, destroy() { destroyed++; } };
    world.add = { text: () => hint };
    world.combat = { equipSword() {}, swing: () => swings };
    world.player = {};
    world.isGameplayReady = true;
    const rightClick = { rightButtonDown: () => true };

    world.equipSword();
    assert.equal(world.swordHint, hint);
    world.handleSwordPointer(rightClick);
    assert.equal(destroyed, 0, 'Golpe em recarga não conta');

    swings = true;
    world.handleSwordPointer(rightClick);
    assert.equal(destroyed, 1);
    assert.equal(world.swordHint, undefined);
});

test('menu multiplayer lista as salas abertas com a opção de entrar', () => {
    const { createMultiplayerMenuActions } = load('../src/game/ui/MainMenuView.ts');
    const joined = [];
    const handlers = { onCreate() {}, onJoin: (room) => joined.push(room), onBack() {} };

    const empty = createMultiplayerMenuActions([], handlers);
    assert.deepEqual(empty.map(({ label }) => label), ['CRIAR SALA', 'NENHUMA SALA ABERTA', 'VOLTAR']);
    assert.equal(empty[1].enabled, false);

    const listed = createMultiplayerMenuActions(['sala-1', 'b', 'c', 'd', 'e'], handlers);
    assert.equal(listed.length, 6);
    assert.equal(listed[1].label, 'SALA-1   [ ENTRAR ]');
    listed[1].onSelect();
    assert.deepEqual(joined, ['sala-1']);
});

test('carta com textura mostra a imagem, e as outras mantêm o ícone desenhado', () => {
    const { UpgradeSelectionView } = load('../src/game/ui/UpgradeSelectionView.ts');
    const images = [];
    let drawnIcons = 0;
    let scale;
    const object = () => ({
        setStrokeStyle() { return this; }, setInteractive() { return this; }, setOrigin() { return this; },
        setPosition() { return this; }, on() { return this; }, once() { return this; }, add() { return this; },
        lineStyle() { return this; }, fillStyle() { return this; }, fillCircle() { return this; }, strokeCircle() { return this; },
        beginPath() { return this; }, moveTo() { return this; }, lineTo() { return this; }, strokePath() { return this; },
        fillRect() { return this; }, strokeRect() { return this; }, fillRoundedRect() { return this; }, strokeRoundedRect() { return this; },
        fillTriangle() { return this; }, strokeTriangle() { return this; }, setDepth() { return this; }, setScrollFactor() { return this; }
    });
    const scene = {
        add: {
            container: object,
            rectangle: object,
            text: object,
            graphics() { drawnIcons += 1; return object(); },
            image(x, y, texture) {
                images.push(texture);
                return { width: 109, height: 140, setScale(value) { scale = value; return this; } };
            }
        }
    };
    const view = new UpgradeSelectionView(scene, []);
    const card = { id: 'gin-tropical', kind: 'stat', title: 'Gin', description: '' };

    view.createCard({ ...card, texture: 'piranhas-gin-tropical' }, 0, () => {});
    assert.deepEqual(images, ['piranhas-gin-tropical']);
    assert.equal(scale, 58 / 140);
    assert.equal(drawnIcons, 0);

    view.createCard({ ...card, id: 'attack-range' }, 0, () => {});
    assert.equal(images.length, 1);
    assert.equal(drawnIcons, 1);
});

test('na dupla só o anfitrião envia a vitória ao placar', async () => {
    const { scoreApi } = load('../src/game/scoring/ScoreApi.ts');
    const original = { ...scoreApi };
    const calls = [];
    scoreApi.startRun = async () => ({});
    scoreApi.finishVictory = async (runId) => { calls.push(['vitoria', runId]); return {}; };
    scoreApi.discardRun = async (runId) => { calls.push(['descarte', runId]); };
    try {
        const host = new RunTracker();
        host.startNew('MULTIPLAYER');
        await host.win();
        const guest = new RunTracker();
        guest.startNew('MULTIPLAYER');
        const snapshot = await guest.win(undefined, false);
        assert.equal(snapshot.status, 'WON', 'o convidado também vê a vitória na tela');
        assert.deepEqual(calls.map(([kind]) => kind), ['vitoria', 'descarte']);
    } finally {
        Object.assign(scoreApi, original);
    }
});

test('derrota solo mantém a partida aberta para recomeçar do checkpoint da sala', async () => {
    const { scoreApi } = load('../src/game/scoring/ScoreApi.ts');
    const original = { ...scoreApi };
    const calls = [];
    scoreApi.startRun = async () => ({});
    scoreApi.discardRun = async (runId) => { calls.push(runId); };
    try {
        const solo = new RunTracker();
        solo.startNew('SINGLE_PLAYER');
        const checkpoint = solo.checkpoint();
        assert.equal(solo.lose(undefined, false).status, 'LOST');
        solo.restore(checkpoint);
        assert.equal(solo.snapshot().status, 'RUNNING', 'tentar de novo segue a mesma partida');
        const duo = new RunTracker();
        duo.startNew('MULTIPLAYER');
        duo.lose();
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(calls.length, 1, 'só a derrota da dupla descarta a partida no placar');
    } finally {
        Object.assign(scoreApi, original);
    }
});

test('tentar novamente recomeça no início da sala do checkpoint, com o progresso daquele momento', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const values = new Map();
    const playerProgress = { currentHealth: 4, maxHealth: 4, movementSpeedMultiplier: 1, upgrades: [] };
    runTracker.startNew('SINGLE_PLAYER');
    const run = runTracker.checkpoint();
    const urls = [];
    globalThis.window = {
        localStorage: {
            getItem(key) { return values.get(key) ?? null; },
            setItem(key, value) { values.set(key, value); },
            removeItem(key) { values.delete(key); }
        },
        location: { search: '', pathname: '/', hash: '' },
        history: { replaceState(_state, _title, url) { urls.push(url); } }
    };
    try {
        saveCampaignProgress({ roomKey: 'room3', playerProgress, run });
        runTracker.lose(undefined, false);
        const world = new World();
        let restartData;
        world.scene = { stop() {}, restart(data) { restartData = data; } };
        world.restartFromDefeatMenu();
        assert.equal(restartData.roomKey, 'room3');
        assert.deepEqual(restartData.spawn, ROOM_DEFINITIONS.room3.spawn);
        assert.deepEqual(restartData.playerProgress, playerProgress);
        assert.equal(runTracker.snapshot().status, 'RUNNING');
        assert.equal(runTracker.checkpoint().runId, run.runId, 'segue a mesma partida do placar');
        assert.equal(loadCampaignProgress()?.roomKey, 'room3', 'o checkpoint continua salvo');
    } finally {
        delete globalThis.window;
        runTracker.abandon();
    }
});

test('personagem escolhido fica salvo e alterna entre as opções', () => {
    const { loadCharacterId, saveCharacterId, nextCharacterId, CHARACTERS } = load('../src/game/config/characters.ts');
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };

    assert.equal(loadCharacterId(storage), 'padrao');
    saveCharacterId('gaucho', storage);
    assert.equal(loadCharacterId(storage), 'gaucho');
    values.set([...values.keys()][0], 'inexistente');
    assert.equal(loadCharacterId(storage), 'padrao');
    assert.equal(loadCharacterId(undefined), 'padrao');
    assert.equal(nextCharacterId('padrao'), 'gaucho');
    assert.equal(nextCharacterId('gaucho'), 'padrao');
    assert.deepEqual(Object.keys(CHARACTERS), ['padrao', 'gaucho']);
});

test('menu de jogar mostra a troca de personagem antes de voltar', () => {
    const { createPlayMenuActions } = load('../src/game/ui/MainMenuView.ts');
    let toggled = 0;
    const actions = createPlayMenuActions({
        onNewGame() {},
        onMultiplayer() {},
        character: () => ({ label: 'GAÚCHO', texture: 'player-gaucho', scaleMultiplier: 6 / 7 }),
        onToggleCharacter: () => { toggled += 1; }
    }, () => {});
    assert.deepEqual(actions.map(({ label }) => label), [
        'CONTINUAR', 'JOGAR SOLO', 'MULTIPLAYER', 'PERSONAGEM: GAÚCHO', 'VOLTAR'
    ]);
    actions[3].onSelect();
    assert.equal(toggled, 1);
});

test('folha do gaúcho segue o layout do personagem atual', () => {
    const { CHARACTERS } = load('../src/game/config/characters.ts');
    // Largura e altura ficam no cabeçalho IHDR do PNG.
    const size = (file) => {
        const data = readFileSync(path.resolve(__dirname, '../public', file));
        return [data.readUInt32BE(16), data.readUInt32BE(20)];
    };
    const [originalWidth] = size(CHARACTERS.padrao.path);
    const [width, height] = size(CHARACTERS.gaucho.path);
    assert.equal(Math.floor(width / 38), Math.floor(originalWidth / 38), 'mesma numeração de quadros');
    assert.ok(height >= 12 * 38, 'cabe a linha de caminhada para a direita');
    assert.equal(WORLD_CONFIG.player.scale * CHARACTERS.padrao.scaleMultiplier, 0.7);
    assert.ok(Math.abs(WORLD_CONFIG.player.scale * CHARACTERS.gaucho.scaleMultiplier - 0.6) < 1e-9);
});

test('horda nasce em lotes até a meta, sem passar do limite de vivos', () => {
    const batches = [];
    const alive = [];
    const spawnBatch = (count, startsWave) => {
        batches.push({ count, startsWave });
        for (let index = 0; index < count; index++) alive.push({ health: { isAlive: true } });
    };
    let intermission;
    let completed = false;
    const waves = new DroneWaves(
        spawnBatch,
        () => { completed = true; },
        (resume) => { intermission = resume; },
        [7, 4],
        [{ maxAlive: 4, batchSize: 3, interval: 1_000 }, { maxAlive: 10, batchSize: 10, interval: 0 }]
    );
    waves.update(alive, 0);
    assert.deepEqual(batches, [{ count: 3, startsWave: true }]);
    waves.update(alive, 999);
    assert.equal(batches.length, 1, 'espera o intervalo');
    waves.update(alive, 1);
    assert.deepEqual(batches[1], { count: 1, startsWave: false }, 'só completa até o limite de vivos');
    waves.update(alive, 5_000);
    assert.equal(batches.length, 2, 'no limite, não nasce mais ninguém');
    assert.equal(waves.currentWaveRemaining(), 3);

    alive.forEach((enemy) => { enemy.health.isAlive = false; });
    waves.update(alive, 0);
    assert.deepEqual(batches[2], { count: 3, startsWave: false }, 'sem ninguém vivo, o lote sai na hora');
    alive.forEach((enemy) => { enemy.health.isAlive = false; });
    waves.update(alive, 0);
    assert.equal(typeof intermission, 'function', 'meta cumprida: abre a carta antes da próxima onda');
    assert.equal(batches.length, 3);
    intermission();
    assert.deepEqual(batches[3], { count: 4, startsWave: true });
    alive.forEach((enemy) => { enemy.health.isAlive = false; });
    waves.update(alive, 0);
    assert.equal(completed, true);
});

test('horda conta quem nasceu de fato e não trava sem lugar para nascer', () => {
    const restored = new DroneWaves(() => 5, () => {}, (resume) => resume(), [6], [{ maxAlive: 3, batchSize: 2, interval: 0 }]);
    restored.update([], 0);
    assert.equal(restored.currentWaveRemaining(), 1, 'os sobreviventes salvos nascem juntos no primeiro lote');

    const blocked = new DroneWaves(() => 0, () => {}, (resume) => resume(), [6], [{ maxAlive: 3, batchSize: 2, interval: 0 }]);
    blocked.update([], 0);
    assert.equal(blocked.currentWaveRemaining(), 0);
});

test('lotes da horda nascem perto do jogador quando há pontos suficientes', () => {
    const points = [300, 400, 900].map((x) => ({ x, y: 1_200, patrolLeft: x - 16, patrolRight: x + 16 }));
    const player = { x: 100, y: 1_200 };
    const near = (point) => point.x - player.x <= 320;
    assert.deepEqual(selectDroneSpawns(2, player, points, near).map(({ x }) => x), [300, 400]);
    assert.deepEqual(selectDroneSpawns(3, player, points, near).map(({ x }) => x), [300, 400, 900], 'sem pontos perto, usa todos');
});

test('lotes da mesma onda continuam o padrão de inimigos', () => {
    const whole = getWaveEnemyKinds('room2', 1, 9);
    const inBatches = [
        ...getWaveEnemyKinds('room2', 1, 4, 0),
        ...getWaveEnemyKinds('room2', 1, 5, 4)
    ];
    assert.deepEqual(inBatches, whole);
});

test('cartas de área crescem de raio por nível e respeitam o máximo', () => {
    const upgrades = new PlayerUpgradeState();
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('shock-pulse'));
    assert.equal(upgrades.pulseRadius, 100 + 25 * 2);
    assert.equal(upgrades.pulseInterval, 1_100);
    for (let level = 0; level < 3; level++) upgrades.acquire(getUpgradeCard('blast-shot'));
    assert.equal(upgrades.blastRadius, 50 + 15);
    assert.equal(upgrades.blastDamageRatio, 1.5);
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('spark-orbit'));
    assert.equal(upgrades.orbitCount, 8);
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('chain-lightning'));
    assert.equal(upgrades.chainJumps, 16);
    for (let level = 0; level < 3; level++) upgrades.acquire(getUpgradeCard('death-blast'));
    assert.equal(upgrades.deathBlastRadius, 70);
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('light-beams'));
    assert.equal(upgrades.beamCount, 10);
    upgrades.reset();
    for (const stat of ['pulseRadius', 'blastRadius', 'orbitCount', 'chainJumps', 'deathBlastRadius', 'beamCount']) {
        assert.equal(upgrades[stat], 0, stat);
    }
});

test('antes da horda maior as cartas de área vêm garantidas', () => {
    for (const roll of [0, 0.4, 0.99]) {
        const cards = drawUpgradeCardsFeaturing(AREA_UPGRADE_IDS, () => roll);
        assert.equal(cards.length, 3);
        assert.ok(cards.filter((card) => AREA_UPGRADE_IDS.includes(card.id)).length >= 2, `sorteio ${roll}: duas de área garantidas`);
        assert.equal(new Set(cards.map((card) => card.id)).size, 3);
    }

    const upgrades = new PlayerUpgradeState();
    for (const id of AREA_UPGRADE_IDS.slice(0, -1)) {
        for (let level = 0; level < 3; level++) upgrades.acquire(getUpgradeCard(id));
    }
    const lastArea = drawUpgradeCardsFeaturing(AREA_UPGRADE_IDS, () => 0.4, upgrades.availableCards());
    assert.equal(lastArea.length, 3);
    assert.deepEqual(lastArea.filter((card) => AREA_UPGRADE_IDS.includes(card.id)).map((card) => card.id), [AREA_UPGRADE_IDS.at(-1)],
        'só a carta de área que sobrou, completada com as comuns');
});

test('rajada espiral solta um fragmento por vez, girando, e cada um fere uma vez até o alcance', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('spiral-volley'));
    upgrades.range = 1;
    // O 1º fragmento sai para a direita (0°) e o 4º para baixo (90°).
    const { combat, drones, rings } = setup([[160, 100], [100, 170], [400, 100]], [], upgrades);
    for (const drone of drones) {
        drone.health = new Health(1000);
        drone.takeDamage = (amount) => drone.health.takeDamage(amount);
    }
    const shard = upgrades.damage * 0.6;
    combat.update(0);
    assert.equal(rings.length, 2, 'só o primeiro fragmento saiu (halo e núcleo)');
    for (let step = 0; step < 30; step++) combat.update(20);
    assert.equal(drones[0].health.current, 1000 - shard, 'o fragmento da direita passou pelo inimigo uma vez');
    assert.equal(drones[1].health.current, 1000 - shard, 'o de 90° acertou o de baixo');
    assert.equal(drones[2].health.current, 1000, 'fora do alcance de 150 px');
    assert.equal(rings.length, 24, '12 fragmentos, um após o outro');
});

test('a Sala II dá duas escolhas de carta seguidas entre as hordas', () => {
    const { getIntermissionCardPicks } = load('../src/game/scenes/World.ts');
    assert.equal(getIntermissionCardPicks('room2'), 2);
    assert.equal(getIntermissionCardPicks('room1'), 1);
    assert.equal(getIntermissionCardPicks('room3'), 1);
});

test('pulso de choque atinge todos dentro do raio no ritmo da carta', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('shock-pulse'));
    // Fora do alcance do tiro, para medir só o pulso.
    upgrades.range = 1;
    const { combat, drones, effects } = setup([[140, 100], [100, 150], [300, 100]], [], upgrades);
    const full = COMBAT_CONFIG.drone.maxHealth;
    const pulse = upgrades.damage * 1.25;
    combat.update(0);
    assert.equal(drones[0].health.current, full - pulse);
    assert.equal(drones[1].health.current, full - pulse);
    assert.equal(drones[2].health.current, full, 'fora do raio');
    assert.ok(effects.some((layer) => layer.circles.includes(100)), 'a onda mostra o raio real');
    combat.update(1_099);
    assert.equal(drones[0].health.current, full - pulse, 'espera o intervalo');
    combat.update(1);
    assert.equal(drones[1].health.current, 0);
});

test('pulso de choque atravessa obstáculos, como o tronco da figueira', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('shock-pulse'));
    upgrades.range = 1;
    // Um obstáculo entre o jogador (100, 100) e o inimigo logo acima.
    const { combat, drones } = setup([[100, 40]], [
        { getLeft: () => 90, getTop: () => 60, width: 20, height: 16 }
    ], upgrades);
    combat.update(0);
    assert.equal(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth - upgrades.damage * 1.25);
});

test('golpe giratório sai do jogador em espiral e corta cada inimigo do raio uma vez, a cada 7 s', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('spin-slash'));
    upgrades.range = 1;
    // Jogador em (100, 100): um inimigo perto, um no meio do raio e um fora dele.
    const { combat, drones, effects } = setup([[100, 60], [0, 100], [400, 100]], [], upgrades);
    for (const drone of drones) {
        drone.health = new Health(1000);
        drone.takeDamage = (amount) => drone.health.takeDamage(amount);
    }
    const cut = upgrades.damage * 9;
    combat.update(0);
    assert.equal(drones[0].health.current, 1000, 'a espiral nasce no jogador');
    combat.update(120);
    assert.equal(drones[0].health.current, 1000 - cut, 'a lâmina já passou dos 40 px');
    assert.equal(drones[1].health.current, 1000, 'ainda não chegou aos 100 px');
    combat.update(330);
    assert.equal(drones[1].health.current, 1000 - cut, 'no fim da espiral todo o raio foi cortado');
    assert.equal(drones[0].health.current, 1000 - cut, 'um corte por golpe');
    assert.equal(drones[2].health.current, 1000, 'fora do raio');
    combat.update(6_000);
    assert.equal(drones[0].health.current, 1000 - cut, 'espera a recarga');
    combat.update(1_000);
    combat.update(450);
    assert.equal(drones[0].health.current, 1000 - cut * 2);
    assert.ok(effects.length > 0);
});

test('bombardeio explode sobre os inimigos mais perto, mesmo atrás de obstáculo', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('bombard'));
    upgrades.range = 1;
    const { combat, drones } = setup([[100, 40], [180, 100], [300, 100], [100, 500]], [
        { getLeft: () => 90, getTop: () => 60, width: 20, height: 16 }
    ], upgrades);
    for (const drone of drones) {
        drone.health = new Health(1000);
        drone.takeDamage = (amount) => drone.health.takeDamage(amount);
    }
    combat.update(0);
    const blast = upgrades.damage * 3;
    assert.equal(drones[0].health.current, 1000 - blast, 'a bomba cai de cima, sem linha de visão');
    assert.equal(drones[1].health.current, 1000 - blast);
    assert.equal(drones[2].health.current, 1000 - blast);
    assert.equal(drones[3].health.current, 1000, 'longe demais');
    combat.update(1_599);
    assert.equal(drones[0].health.current, 1000 - blast, 'espera a recarga');
});

test('serras orbitais e faíscas dividem o efeito e o mais forte prevalece', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('spark-orbit'));
    upgrades.acquire(getUpgradeCard('saw-orbit'));
    assert.equal(upgrades.orbitCount, 5);
    assert.equal(upgrades.orbitRadius, 72);
    assert.equal(upgrades.orbitDamageRatio, 2.5);
    assert.equal(upgrades.orbitHitInterval, 350);
});

test('cartas do fim da Sala III só aparecem depois da horda 2', () => {
    const { ROOM3_FINAL_UPGRADE_IDS } = load('../src/game/upgrades/catalog.ts');
    const finals = new Set(ROOM3_FINAL_UPGRADE_IDS);
    const all = new PlayerUpgradeState().availableCards();
    for (const table of ['room1', 'room2', 'room3']) assert.ok(!getTableCards(table, all).some((card) => finals.has(card.id)), table);
    const table = drawTableCards('room3-final', () => 0, all);
    assert.equal(table.filter((card) => finals.has(card.id)).length, 2, 'duas finais garantidas');
    assert.equal(new Set(table.map((card) => card.id)).size, 3, 'e um curinga de fora: a mesa não é sempre a mesma');
});

test('tiro explosivo fere os vizinhos do alvo sem acertar o alvo duas vezes', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('blast-shot'));
    const { combat, drones, overlaps, groups } = setup([[150, 100], [170, 100], [250, 100]], [], upgrades);
    const full = COMBAT_CONFIG.drone.maxHealth;
    combat.update(0);
    overlaps[0].hit(groups[0].shots[0]);
    assert.equal(drones[0].health.current, full - upgrades.damage);
    assert.equal(drones[1].health.current, full - upgrades.damage * 1.5);
    assert.equal(drones[2].health.current, full, 'fora do raio da explosão');
});

test('faíscas orbitais ferem quem encostar, uma vez por intervalo', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('spark-orbit'));
    upgrades.range = 1;
    // A primeira faísca começa à direita do jogador, a 52 px.
    const { combat, drones } = setup([[152, 100], [100, 300]], [], upgrades);
    const full = COMBAT_CONFIG.drone.maxHealth;
    combat.update(0);
    assert.equal(drones[0].health.current, full - upgrades.damage * 1.25);
    assert.equal(drones[1].health.current, full, 'longe das faíscas');
    combat.update(1);
    assert.equal(drones[0].health.current, full - upgrades.damage * 1.25, 'não acerta de novo antes do intervalo');
});

test('tempestade elétrica causa 125% do dano por salto', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('thunder-storm'));
    upgrades.range = 100;
    const { combat, drones } = setup([[150, 100], [200, 100]], [], upgrades);
    combat.playerCooldown = 99_999;
    combat.update(0);
    assert.equal(drones[0].health.current, COMBAT_CONFIG.drone.maxHealth - upgrades.damage * 1.25);
});

test('raio em cadeia salta entre vizinhos sem repetir alvo', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('chain-lightning'));
    upgrades.range = 100;
    const positions = Array.from({ length: 10 }, (_, index) => [150 + index * 50, 100]);
    const { combat, drones, effects } = setup(positions, [], upgrades);
    // Sem tiro comum neste teste: só o raio causa dano.
    combat.playerCooldown = 99_999;
    const full = COMBAT_CONFIG.drone.maxHealth;
    combat.update(0);
    const hit = drones.filter((drone) => drone.health.current < full).length;
    assert.equal(hit, 8, 'nível 1 salta por 8 inimigos');
    assert.equal(drones[0].health.current, full - upgrades.damage * 0.85, 'cada salto causa 85% do dano');
    assert.equal(effects.length, 1, 'um raio desenhado para a cadeia inteira');
    assert.equal(drones[9].health.current, full);
});

test('detonação faz o abatido explodir, mas quem morre na explosão não explode de novo', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('death-blast'));
    upgrades.acquire(getUpgradeCard('shock-pulse'));
    upgrades.damage = COMBAT_CONFIG.drone.maxHealth * 2;
    upgrades.range = 1;
    // O pulso derruba o primeiro; a explosão dele (75% de dano dobrado) derruba o segundo, que não detona.
    const { combat, drones } = setup([[150, 100], [205, 100], [258, 100], [400, 100]], [], upgrades);
    combat.update(0);
    assert.deepEqual(drones.map((drone) => drone.health.isAlive), [false, false, true, true]);
    assert.equal(drones[2].health.current, COMBAT_CONFIG.drone.maxHealth, 'sem cadeia, o terceiro nem é atingido');
    assert.equal(getUpgradeCard('death-blast').effect.damageRatio, 0.75);
});

test('feixes de luz cruzam a tela e ferem quem está na linha', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('light-beams'));
    upgrades.range = 1;
    // Com 6 feixes, o primeiro disparo sai a 30°, 90°, 150°...: o de 90° desce reto.
    const { combat, drones, effects } = setup([[100, 300], [300, 100]], [], upgrades);
    const full = COMBAT_CONFIG.drone.maxHealth;
    combat.update(0);
    // Três camadas (halo, cor e núcleo) por feixe.
    assert.equal(effects.length, 1);
    assert.equal(effects[0].lines, 6 * 3);
    assert.equal(drones[0].health.current, full - upgrades.damage * 1.7, 'na linha de 90°, a 200 px');
    assert.equal(drones[1].health.current, full, 'entre dois feixes');
    combat.update(1_299);
    assert.equal(effects.length, 1, 'espera o intervalo');
    combat.update(1);
    assert.equal(effects.length, 2, 'o leque gira e dispara de novo');
});

test('jogador fica imune por um instante depois de levar um golpe', () => {
    const { Player } = load('../src/game/entities/Player.ts');
    const player = Object.create(Player.prototype);
    const time = { now: 1_000, delayedCall() {} };
    player.scene = { time, sound: { play() {} } };
    player.health = new Health(4);
    player.sprite = { active: true, setTint() {}, clearTint() {} };
    player.invulnerableUntil = 0;

    player.takeDamage(1);
    player.takeDamage(1);
    assert.equal(player.health.current, 3, 'o segundo golpe cai na imunidade');
    time.now += WORLD_CONFIG.player.hurtInvulnerability;
    player.takeDamage(1);
    assert.equal(player.health.current, 2);
});

test('horda traz de volta quem se perdeu longe do jogador', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    world.activeRoomKey = 'room2';
    world.collisionLayers = [];
    world.player = { sprite: { x: 100, y: 1_200, body: { center: { x: 100, y: 1_200 } } } };
    const near = fighter(150, 1_200, 4);
    const lost = fighter(900, 1_200, 4);
    const moved = [];
    for (const enemy of [near, lost]) {
        enemy.sprite.setPosition = (x, y) => { moved.push({ enemy, x, y }); };
        enemy.sprite.body.reset = () => {};
    }
    world.drones = [near, lost];
    // Logo fora da tela: entre 300 e 380 px do jogador.
    world.droneSpawnPoints = [430, 460].map((x) => ({ x, y: 1_200, patrolLeft: x - 16, patrolRight: x + 16 }));

    world.recallHordeStragglers(COMBAT_CONFIG.hordeRecall.interval - 1);
    assert.equal(moved.length, 0, 'espera o intervalo');
    world.recallHordeStragglers(1);
    assert.equal(moved.length, 1);
    assert.equal(moved[0].enemy, lost);
    assert.ok(moved[0].x - 100 >= COMBAT_CONFIG.hordeSpawnMinDistance, 'reaparece fora da tela');
    assert.ok(moved[0].x - 100 <= COMBAT_CONFIG.hordeSpawnMaxDistance);

    world.activeRoomKey = 'room1';
    world.recallHordeStragglers(COMBAT_CONFIG.hordeRecall.interval);
    assert.equal(moved.length, 1, 'fora da horda ninguém é puxado');
});

test('raio em cadeia desenha um zigue-zague passando por cada alvo', () => {
    const { playLightning } = load('../src/game/effects/playAreaEffects.ts');
    const layer = { lines: [], impacts: 0 };
    for (const method of ['setDepth', 'setBlendMode', 'lineStyle', 'fillStyle', 'destroy']) layer[method] = function () { return this; };
    layer.lineBetween = function (x1, y1, x2, y2) { this.lines.push([x1, y1, x2, y2]); return this; };
    layer.fillCircle = function () { this.impacts += 1; return this; };
    const scene = { add: { graphics: () => layer }, tweens: { add() {} } };
    playLightning(scene, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 0xffffff, () => 1);

    // 2 trechos em 5 pedaços cada, desenhados em 3 camadas.
    assert.equal(layer.lines.length, 2 * 5 * 3);
    const firstLayer = layer.lines.slice(0, 10);
    assert.deepEqual(firstLayer[4].slice(2), [100, 0], 'passa exatamente pelo primeiro alvo');
    assert.deepEqual(firstLayer[9].slice(2), [100, 100]);
    assert.ok(firstLayer.slice(0, 4).some(([, , , y]) => y !== 0), 'o caminho entre alvos é quebrado');
    assert.equal(layer.impacts, 2 * 2, 'clarão em cada alvo atingido');
});

test('horda depois da carta tem a quantidade de cada tipo e mistura os tipos ao longo da onda', () => {
    const kinds = getWaveEnemyKinds('room2', 1, COMBAT_CONFIG.wavesByRoom.room2[1]);
    const counts = {};
    for (const kind of kinds) counts[kind] = (counts[kind] ?? 0) + 1;
    assert.deepEqual(counts, { 'heavy-drone': 5, gaucho: 46, guard: 22, scooter: 22, drone: 22, bike: 20 });
    // Cada lote de 6 já traz pelo menos três tipos diferentes.
    for (let start = 0; start < kinds.length; start += 6) {
        assert.ok(new Set(kinds.slice(start, start + 6)).size >= 3, `lote ${start}`);
    }
});

test('campo de fluxo contorna a parede em vez de ir reto contra ela', () => {
    const { FlowField } = load('../src/game/combat/FlowField.ts');
    // Parede na coluna 3, com passagem de dois quadrados só embaixo (linhas 5 e 6).
    const wall = (x, y) => x === 3 && y < 5;
    const field = new FlowField(8, 7, 16, wall);
    field.update({ x: 7 * 16 + 8, y: 8 });

    const start = field.directionFrom({ x: 8, y: 8 });
    assert.ok(start.y > 0.5, 'desce em direção à passagem');
    // Seguindo o campo, chega do outro lado da parede.
    let position = { x: 8, y: 8 };
    for (let step = 0; step < 200; step++) {
        const direction = field.directionFrom(position);
        if (!direction) break;
        position = { x: position.x + direction.x * 2, y: position.y + direction.y * 2 };
        assert.equal(wall(Math.floor(position.x / 16), Math.floor(position.y / 16)), false, 'nunca entra na parede');
    }
    assert.ok(position.x > 4 * 16, 'atravessou pela passagem');
    assert.equal(field.directionFrom({ x: 6 * 16 + 8, y: 8 }), undefined, 'perto do alvo vai em linha reta');
});

test('campo de fluxo só recalcula quando o alvo troca de quadrado', () => {
    const { FlowField } = load('../src/game/combat/FlowField.ts');
    let checks = 0;
    const field = new FlowField(4, 4, 16, () => { checks++; return false; });
    const afterBuild = checks;
    field.update({ x: 8, y: 8 });
    const first = field.directionFrom({ x: 56, y: 56 });
    field.update({ x: 10, y: 12 });
    assert.deepEqual(field.directionFrom({ x: 56, y: 56 }), first);
    assert.equal(checks, afterBuild, 'a parede só é lida ao montar o campo');
});

test('drone da horda segue o caminho do campo de fluxo', () => {
    const { drone, sprite, playerAt } = chasingDrone();
    const { chaseSpeed } = WORLD_CONFIG.drone;
    drone.relentless = true;
    drone.pathfinder = () => ({ x: 0, y: 1 });
    drone.update(playerAt(300));
    assert.equal(sprite.body.velocity.x, 0);
    assert.equal(sprite.body.velocity.y, chaseSpeed, 'contorna em vez de ir reto até o jogador');
    drone.pathfinder = () => undefined;
    drone.update(playerAt(300));
    assert.equal(sprite.body.velocity.x, chaseSpeed, 'sem caminho calculado, segue em linha reta');
});

test('campo de fluxo não usa passagem de um quadrado, onde o corpo entala', () => {
    const { FlowField } = load('../src/game/combat/FlowField.ts');
    // Parede inteira na coluna 3, com um furo de um quadrado na linha 3.
    const field = new FlowField(8, 7, 16, (x, y) => x === 3 && y !== 3);
    field.update({ x: 7 * 16 + 8, y: 3 * 16 + 8 });
    assert.equal(field.isReachable({ x: 8, y: 3 * 16 + 8 }), false, 'do outro lado do furo não há caminho');
    assert.equal(field.isReachable({ x: 6 * 16 + 8, y: 8 }), true);
});

test('com o alvo numa passagem estreita, o campo não declara todo mundo sem saída', () => {
    const { FlowField } = load('../src/game/combat/FlowField.ts');
    const field = new FlowField(8, 7, 16, (x, y) => x === 3 && y !== 3);
    field.update({ x: 3 * 16 + 8, y: 3 * 16 + 8 });
    assert.equal(field.isReachable({ x: 8, y: 8 }), true);
    assert.equal(field.directionFrom({ x: 8, y: 8 }), undefined, 'sem campo, vai em linha reta');
});

test('horda tira do lugar quem ficou entalado longe do jogador', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    world.activeRoomKey = 'room2';
    world.collisionLayers = [];
    world.player = { sprite: { x: 100, y: 1_200, body: { center: { x: 100, y: 1_200 } } } };
    const stuck = fighter(300, 1_200, 4);
    const drone = fighter(100 + 64, 1_200, 4);
    const moved = [];
    for (const enemy of [stuck, drone]) {
        enemy.sprite.setPosition = (x, y) => { moved.push({ enemy, x, y }); };
        enemy.sprite.body.reset = () => {};
    }
    world.drones = [stuck, drone];
    world.droneSpawnPoints = [430, 460].map((x) => ({ x, y: 1_200, patrolLeft: x - 16, patrolRight: x + 16 }));
    const { interval } = COMBAT_CONFIG.hordeRecall;

    world.recallHordeStragglers(interval);
    assert.equal(moved.length, 0, 'na primeira olhada ainda não dá para saber se está parado');
    world.recallHordeStragglers(interval);
    assert.deepEqual(moved.map(({ enemy }) => enemy), [stuck], 'o drone parado a 64 px está atirando, não preso');
});

function chargerAt(kind) {
    const { Patinete } = load('../src/game/entities/Patinete.ts');
    const world = new ArcadeWorld({ sys: { scale: { width: 800, height: 640 } } }, {});
    const frames = [];
    const sprite = {
        x: 300, y: 208, active: true, body: new ArcadeBody(world),
        anims: { stop() {} },
        setScale() { return this; }, setDepth() { return this; }, setCollideWorldBounds() { return this; },
        play(key) { this.animation = key; }, setTint() {}, clearTint() {}, setTintMode() {},
        setFrame(frame) { frames.push(frame); return this; },
        setVelocity() { return this; }
    };
    const graphics = { clear() { return this; }, fillStyle() { return this; }, fillRect() { return this; }, setDepth() { return this; } };
    const scene = {
        cameras: { main: { shake() {} } },
        physics: { add: { sprite: () => sprite } },
        anims: { exists: () => true, create() {} },
        time: { delayedCall() {} },
        tweens: { add() {} },
        add: { graphics: () => graphics }
    };
    const charger = new Patinete(scene, { x: 300, y: 208, patrolLeft: 260, patrolRight: 360 }, [{ getTilesWithinWorldXY: () => [] }], kind);
    sprite.body.position.set(sprite.x - sprite.body.halfWidth, sprite.y - sprite.body.halfHeight);
    sprite.body.updateCenter();
    const player = fighter(sprite.body.center.x + 100, sprite.body.center.y, COMBAT_CONFIG.player.maxHealth);
    player.takeDamage = () => {};
    return { charger, sprite, frames, player };
}

test('bicicleta elétrica emenda uma investida na outra, sem recuperação', () => {
    const { charger, sprite, frames, player } = chargerAt('bike');
    const { chargeWindup, chargeDuration } = COMBAT_CONFIG.bike;
    assert.equal(charger.kind, 'bike');
    assert.equal(charger.health.max, COMBAT_CONFIG.bike.maxHealth);
    assert.equal(sprite.animation, 'bike-move-down');

    charger.update(player, 0);
    assert.equal(charger.state, 'windup', 'avisa antes de investir');
    charger.update(player, chargeWindup);
    assert.equal(charger.state, 'charge');
    charger.update(player, chargeDuration);
    assert.equal(charger.state, 'approach', 'sem pausa depois da investida');
    charger.update(player, 16);
    assert.equal(charger.state, 'windup', 'já prepara a próxima');
    // Coluna 6 da folha é o quadro de atordoado depois da investida.
    assert.ok(frames.every((frame) => frame % 8 !== 6), 'não mostra o quadro de atordoado');
});

test('patinete continua parando para se recuperar depois da investida', () => {
    const { charger, frames, player } = chargerAt('scooter');
    const { chargeWindup, chargeDuration, recoveryDuration } = COMBAT_CONFIG.scooter;
    charger.update(player, 0);
    charger.update(player, chargeWindup);
    charger.update(player, chargeDuration);
    assert.equal(charger.state, 'recover');
    assert.equal(frames.at(-1) % 8, 6, 'mostra o quadro de atordoado');
    charger.update(player, recoveryDuration - 1);
    assert.equal(charger.state, 'recover');
});

test('cartas básicas só na Sala I, Cajado de gelo em todas as mesas e Overclock em nenhuma', () => {
    const { BASIC_UPGRADE_IDS, UPGRADE_CARDS } = load('../src/game/upgrades/catalog.ts');
    const room1 = getTableCards('room1', UPGRADE_CARDS);
    assert.ok(room1.length >= 3 && room1.some((card) => card.kind === 'ability'), 'ainda dá para sortear três com uma habilidade');
    assert.ok(room1.every((card) => BASIC_UPGRADE_IDS.includes(card.id) || card.id === 'ice-staff'));
    for (const table of ['room1', 'room2', 'room3']) {
        const ids = getTableCards(table, UPGRADE_CARDS).map((card) => card.id);
        assert.ok(ids.includes('ice-staff'), `${table} oferece o Cajado de gelo`);
        assert.ok(!ids.includes('overclock'), `${table} não oferece o Overclock`);
        if (table !== 'room1') assert.ok(!ids.some((id) => BASIC_UPGRADE_IDS.includes(id)), `${table} sem cartas básicas`);
    }
    const room3 = getTableCards('room3', UPGRADE_CARDS).map((card) => card.id);
    assert.ok(room3.includes('fire-staff') && !getTableCards('room2', UPGRADE_CARDS).some((card) => card.id === 'fire-staff'), 'o fogo saiu da Sala II para a III');
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
        const cards = drawTableCards('room2', () => roll, UPGRADE_CARDS);
        assert.ok(cards.every((card) => !BASIC_UPGRADE_IDS.includes(card.id)), `sorteio ${roll}`);
    }
});

test('esconderijo usa a mesa da sala por onde se entra e a mesa sem cartas completa com as outras', () => {
    const { getCardTable } = load('../src/game/scenes/World.ts');
    assert.equal(getCardTable('gaucho-dungeon'), 'room1');
    assert.equal(getCardTable('dungeon'), 'room2');
    assert.equal(getCardTable('room3'), 'room3');
    const { UPGRADE_CARDS } = load('../src/game/upgrades/catalog.ts');
    const onlyArea = UPGRADE_CARDS.filter((card) => AREA_UPGRADE_IDS.slice(0, 2).includes(card.id) || card.id === 'overclock' || card.id === 'max-health');
    const fallback = getTableCards('room2', onlyArea).map((card) => card.id);
    assert.ok(fallback.includes('max-health'), 'com a mesa no fim, completa com o que ainda dá para pegar');
    assert.ok(!fallback.includes('overclock'), 'mas nunca com a carta aposentada');
});

test('room3 abre pela rota direta e recebe a saída da room2', () => {
    assert.equal(ROOM_DEFINITIONS.room3.title, 'Sala III:\nA Praça XV');
    assert.equal(getRequestedRoomKey('?room=3'), 'room3');
    assert.equal(getRoomSearch('room3', '?debug=1'), '?debug=1&room=3');
    assert.deepEqual(getInitialSceneRoute('?room=3'), { key: 'RoomTransition', data: { roomKey: 'room3' } });

    const { area, portal } = ROOM2_TO_ROOM3_GATEWAY;
    assert.equal(ROOM2_TO_ROOM3_GATEWAY.from, 'room2');
    assert.equal(ROOM2_TO_ROOM3_GATEWAY.to, 'room3');
    assert.equal(isInsideRoomGateway(portal.x, portal.y, ROOM2_TO_ROOM3_GATEWAY), true);
    assert.equal(isInsideRoomGateway(area.left - 1, portal.y, ROOM2_TO_ROOM3_GATEWAY), false);
    // Cada sala tem no máximo uma saída que abre ao vencer.
    const origins = ROOM_EXIT_GATEWAYS.map((gateway) => gateway.from);
    assert.deepEqual(origins, [...new Set(origins)]);
});

test('room3 abre com a horda final da room2 e termina numa horda maior', () => {
    const [first, second] = COMBAT_CONFIG.wavesByRoom.room3;
    // Mesma horda final da room2, com 5 drones fortes a mais.
    assert.equal(first, COMBAT_CONFIG.wavesByRoom.room2[1] + 5);
    assert.ok(second > first);
    assert.equal(COMBAT_CONFIG.hordeByRoom.room3.length, 2);
});

test('checkpoint da room3 libera o continuar', () => {
    const storage = new Map();
    const memory = {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key)
    };
    const playerProgress = { currentHealth: 4, maxHealth: 4, movementSpeedMultiplier: 1, upgrades: [] };
    saveCampaignProgress({ roomKey: 'room3', playerProgress }, memory);
    assert.equal(loadCampaignProgress(memory)?.roomKey, 'room3');
});

test('cartas exclusivas da room3 não aparecem nas salas anteriores', () => {
    const exclusive = (card) => ROOM3_EXCLUSIVE_UPGRADE_IDS.includes(card.id);
    assert.equal(getTableCards('room1', UPGRADE_CARDS).some(exclusive), false);
    assert.equal(getTableCards('room2', UPGRADE_CARDS).some(exclusive), false);
    for (let seed = 0; seed < 20; seed += 1) {
        const room2Cards = drawTableCards('room2', () => (seed * 0.37) % 1, UPGRADE_CARDS);
        assert.equal(room2Cards.some(exclusive), false);
        const room3Cards = drawTableCards('room3', () => (seed * 0.37) % 1, UPGRADE_CARDS);
        assert.ok(room3Cards.every((card) => ROOM3_UPGRADE_IDS.includes(card.id) || card.id === 'ice-staff'));
    }
});

test('carta comum pega depois da forte não enfraquece o efeito', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('thunder-storm'));
    upgrades.acquire(getUpgradeCard('chain-lightning'));
    assert.equal(upgrades.chainInterval, 750);
    assert.equal(upgrades.chainDamageRatio, 1.25);
    assert.equal(upgrades.chainRange, 130);
    assert.equal(upgrades.chainJumps, 16);

    upgrades.acquire(getUpgradeCard('shock-pulse'));
    upgrades.acquire(getUpgradeCard('nova-pulse'));
    assert.equal(upgrades.pulseInterval, 850);
    assert.equal(upgrades.pulseDamageRatio, 2.5);
    assert.equal(upgrades.pulseRadius, 150);

    upgrades.acquire(getUpgradeCard('heavy-rounds'));
    assert.equal(upgrades.damage, COMBAT_CONFIG.player.damage + 3);
});

test('8080 dá uma carta forte aleatória só na room3', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const hints = [];
    world.isGameplayReady = true;
    world.showFloatingHint = (text) => hints.push(text);
    world.activeRoomKey = 'room2';
    for (const key of '8080') world.handleSecretCodeKey({ key, repeat: false });
    assert.deepEqual(world.upgrades.exportProgress(), []);

    world.activeRoomKey = 'room3';
    for (const key of '8080') world.handleSecretCodeKey({ key, repeat: false });
    const [[id, level]] = world.upgrades.exportProgress();
    assert.ok(ROOM3_UPGRADE_IDS.includes(id));
    assert.equal(level, 1);
    assert.match(hints[0], /^\+ /);

    // Com todas no nível máximo, avisa em vez de falhar.
    for (const cardId of ROOM3_UPGRADE_IDS) {
        while (world.upgrades.acquire(getUpgradeCard(cardId)));
    }
    for (const key of '8080') world.handleSecretCodeKey({ key, repeat: false });
    assert.equal(hints[1], 'CARTAS FORTES NO MÁXIMO');
});

test('8080 na room5 tira 10% da vida máxima do golem a cada vez', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const hits = [];
    world.isGameplayReady = true;
    world.activeRoomKey = 'room5';
    world.golem = { health: { isAlive: true, max: 400 }, takeDamage: (amount) => hits.push(amount) };
    for (const key of '80808080') world.handleSecretCodeKey({ key, repeat: false });
    assert.deepEqual(hits, [40, 40]);
    assert.deepEqual(world.upgrades.exportProgress(), [], 'fora da room3 não dá carta');
});

test('drone forte aparece a partir da horda 2 da room2 e ganha +5 a cada horda', () => {
    const heavyIn = (room, wave) => getWaveEnemyKinds(room, wave, COMBAT_CONFIG.wavesByRoom[room][wave])
        .filter((kind) => kind === 'heavy-drone').length;
    assert.equal(heavyIn('room1', 1), 0);
    assert.equal(heavyIn('room2', 0), 0);
    assert.deepEqual([heavyIn('room2', 1), heavyIn('room3', 0), heavyIn('room3', 1), heavyIn('room4', 0)], [5, 10, 15, 20]);
});

test('drone forte tem o triplo da vida e atira como o comum', () => {
    assert.equal(COMBAT_CONFIG.heavyDrone.maxHealth, COMBAT_CONFIG.drone.maxHealth * 3);
    const { combat, drones, groups } = setup([[150, 100]]);
    drones[0].kind = 'heavy-drone';
    combat.enemyCooldowns.set(drones[0], 0);
    combat.update(0);
    assert.ok(groups[1].shots.length > 0, 'drone forte também dispara');
});

test('esconderijo dos gaúchos pergunta antes de entrar e só pergunta de novo depois de sair do bueiro', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const launches = [];
    const center = { ...ROOM1_TO_GAUCHO_DUNGEON_GATEWAY.portal };
    world.activeRoomKey = 'room1';
    world.player = {
        health: new Health(4),
        sprite: { body: { center } },
        getMovementSpeedMultiplier() { return 1; },
        stopMovement() {}
    };
    world.combat = { clear() {} };
    world.physics = { pause() {}, resume() {} };
    world.scene = {
        launch(key, data) { launches.push({ key, data }); },
        bringToTop() {}
    };
    const keys = () => launches.map(({ key }) => key);

    world.updateRoomGateway();
    assert.deepEqual(keys(), ['ConfirmPrompt']);
    assert.equal(launches[0].data.title, ROOM1_TO_GAUCHO_DUNGEON_GATEWAY.confirm.enter);

    launches[0].data.onChoice(false);
    world.updateRoomGateway();
    assert.deepEqual(keys(), ['ConfirmPrompt'], 'parado no bueiro depois do NÃO não pergunta de novo');

    center.x += 100;
    world.updateRoomGateway();
    center.x -= 100;
    world.updateRoomGateway();
    assert.deepEqual(keys(), ['ConfirmPrompt', 'ConfirmPrompt'], 'saiu e voltou: pergunta de novo');

    launches[1].data.onChoice(true);
    assert.equal(launches[2].key, 'RoomTransition');
    assert.equal(launches[2].data.roomKey, 'gaucho-dungeon');
});

test('fliperama espera o iniciar e sair na tela de como jogar devolve a tentativa', () => {
    const { ArcadeMinigame } = load('../src/game/scenes/ArcadeMinigame.ts');
    const arcade = new ArcadeMinigame();
    const finishes = [];
    let moves = 0;
    let stopped = 0;
    arcade.scene = { stop() { stopped += 1; } };
    arcade.onFinish = (won, played) => finishes.push([won, played]);
    arcade.puzzle = { move() { moves += 1; } };

    arcade.act(() => arcade.puzzle.move(1));
    assert.equal(moves, 0, 'a peça não deve se mexer antes de iniciar');

    arcade.leaveIntro();
    assert.equal(stopped, 1);
    assert.deepEqual(finishes, [[false, false]]);
});

test('sair do esconderijo dos gaúchos sobe a escada antes de trocar de sala e trava o jogador', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const calls = [];
    world.player = {
        sprite: { setDepth() { return this; }, setPosition() { return this; }, body: { enable: true }, displayHeight: 24, scaleX: 1, scaleY: 1 },
        climbInPlace() { calls.push('climb'); }
    };
    world.dungeonReturnArea = { left: 16, right: 32, top: 100, bottom: 180 };
    world.combat = { clear() { calls.push('clear'); } };
    world.tweens = { add(config) { config.onComplete(); } };

    world.climbSewerLadder(() => calls.push('leave'));
    world.climbSewerLadder(() => calls.push('leave'));

    assert.deepEqual(calls, ['clear', 'climb', 'leave'], 'sobe uma vez só e sai depois da subida');
    assert.equal(world.isClimbingLadder, true, 'segue travado até a próxima sala recriar a cena');
});

test('vencer o fliperama vale 5K pontos na pontuação', () => {
    const base = { won: true, elapsedTimeMs: 0, enemiesDefeated: 0, hitsTaken: 5, multiKillBonuses: [] };
    assert.equal(calculateScore({ ...base, arcadeWon: true }).arcadePoints, 5_000);
    assert.equal(calculateScore({ ...base, arcadeWon: true }).total - calculateScore(base).total, 5_000);
});

test('relógio para no fliperama, conta o bônus e respeita o teto do servidor', () => {
    const tracker = new RunTracker();
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    tracker.startNew('SINGLE_PLAYER', new Date(start));
    tracker.pauseClock(start + 10_000);
    tracker.pauseClock(start + 20_000);
    assert.equal(tracker.snapshot(start + 70_000).elapsedTimeMs, 10_000, 'parado enquanto joga');
    tracker.resumeClock(start + 70_000);
    assert.equal(tracker.snapshot(start + 75_000).elapsedTimeMs, 15_000, 'volta a contar ao sair');
    assert.equal(tracker.recordArcadeWin(), true);
    assert.equal(tracker.recordArcadeWin(), false, 'o bônus vale uma vez');
    assert.equal(tracker.snapshot(start + 75_000).score.arcadePoints, 5_000);

    const checkpoint = tracker.checkpoint();
    assert.equal(checkpoint.pausedMs, 60_000);
    assert.equal(checkpoint.arcadeWon, true);
    const restored = new RunTracker();
    restored.restore(checkpoint);
    assert.equal(restored.snapshot(start + 75_000).elapsedTimeMs, 15_000, 'o Continuar guarda a pausa');

    // Uma pausa longa demais desconta só até o teto que o servidor aceita.
    tracker.pauseClock(start + 75_000);
    tracker.resumeClock(start + 75_000 + 3_600_000);
    assert.equal(tracker.checkpoint().pausedMs, SCORE_CONFIG.arcade.maxPausedMs);
    tracker.abandon();
    restored.abandon();
});

test('chapéu de gaúcho bloqueia parte dos golpes e dá o respiro de um acerto', () => {
    const { Player } = load('../src/game/entities/Player.ts');
    const { GAUCHO_HAT } = load('../src/game/config/items.ts');
    const player = Object.create(Player.prototype);
    const time = { now: 1_000, delayedCall() {} };
    const tints = [];
    player.scene = { time, sound: { play() {} } };
    player.health = new Health(4);
    player.sprite = { active: true, setTint(color) { tints.push(color); }, clearTint() {} };
    player.invulnerableUntil = 0;
    player.blockChance = GAUCHO_HAT.blockChance;
    const rolls = [GAUCHO_HAT.blockChance - 0.01, GAUCHO_HAT.blockChance + 0.01];
    player.random = () => rolls.shift();

    player.takeDamage(1);
    assert.equal(player.health.current, 4, 'golpe bloqueado não tira vida');
    assert.equal(tints[0], 0x8fd8ff, 'pisca a cor de escudo');
    player.takeDamage(1);
    assert.equal(player.health.current, 4, 'o contato logo depois cai no respiro, sem sortear de novo');
    time.now += WORLD_CONFIG.player.hurtInvulnerability;
    player.takeDamage(1);
    assert.equal(player.health.current, 3, 'sem sorte no sorteio, o golpe passa');
});

test('itens vestidos vão ao parceiro como um bit por item', () => {
    const { encodeWornItems, decodeWornItems, ITEM_IDS } = load('../src/game/config/items.ts');
    assert.equal(encodeWornItems([]), 0);
    assert.deepEqual(decodeWornItems(encodeWornItems(['rubber-boots', 'gaucho-hat'])), ['gaucho-hat', 'rubber-boots']);
    assert.deepEqual(decodeWornItems(encodeWornItems(ITEM_IDS)), [...ITEM_IDS]);
    assert.ok(encodeWornItems(ITEM_IDS) <= 255, 'cabe no limite que o servidor aceita');
});

test('checkpoint recusa itens que não existem no jogo', () => {
    const values = new Map();
    const storage = {
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { values.set(key, value); },
        removeItem(key) { values.delete(key); }
    };
    const playerProgress = { currentHealth: 3, maxHealth: 4, movementSpeedMultiplier: 1, upgrades: [], items: ['gaucho-hat'] };
    saveCampaignProgress({ roomKey: 'room2', playerProgress }, storage);
    assert.deepEqual(loadCampaignProgress(storage).playerProgress.items, ['gaucho-hat']);
    saveCampaignProgress({ roomKey: 'room2', playerProgress: { ...playerProgress, items: ['coroa-de-ouro'] } }, storage);
    assert.equal(loadCampaignProgress(storage), undefined);
});

test('chapéu cai uma vez só no esconderijo e equipa quem pega', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    let equipped = 0;
    let overlap;
    world.player = { sprite: { x: 100, y: 200 }, equipItem(id) { if (id === 'gaucho-hat') equipped += 1; }, unequipItem() {} };
    world.textures = { exists: () => true };
    const fakeImage = () => {
        const image = { destroy() {} };
        for (const method of ['setScale', 'setDepth', 'setOrigin', 'setPosition']) image[method] = () => image;
        return image;
    };
    world.physics = { add: { image: fakeImage, overlap(_a, _b, callback) { overlap = callback; return { destroy() {} }; } } };
    world.createWorldHint = fakeImage;

    world.createGauchoHatPickup();
    overlap();
    assert.equal(equipped, 1);
    assert.deepEqual(world.ownedItems, ['gaucho-hat']);
    overlap = undefined;
    world.createGauchoHatPickup();
    assert.equal(overlap, undefined, 'quem já tem o chapéu não vê outro no chão');
});

test('inventário retira e reequipa o chapéu, e a escolha segue entre as salas', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const calls = [];
    // Só o chapéu interessa aqui; o capacete e as galochas não estão no inventário.
    world.player = {
        equipItem(id) { if (id === 'gaucho-hat') calls.push('equip'); },
        unequipItem(id) { if (id === 'gaucho-hat') calls.push('unequip'); }
    };
    world.ownedItems = ['gaucho-hat'];
    world.equippedItems = ['gaucho-hat'];

    const hat = () => world.buildInventory().items.find(({ id }) => id === 'gaucho-hat');
    assert.equal(hat().equipped, true);
    const afterRemoving = world.buildInventory().onToggleItem('gaucho-hat');
    assert.equal(afterRemoving.items.find(({ id }) => id === 'gaucho-hat').equipped, false, 'o inventário redesenha com o chapéu guardado');
    assert.deepEqual(calls, ['unequip']);
    assert.deepEqual(world.equippedItems, []);
    assert.deepEqual(world.ownedItems, ['gaucho-hat'], 'retirar não joga o item fora');
    world.toggleItem('gaucho-hat');
    assert.deepEqual(calls, ['unequip', 'equip']);
    assert.equal(hat().equipped, true);

    const progress = capturePlayerProgress(
        { health: new Health(4), getMovementSpeedMultiplier: () => 1 }, new PlayerUpgradeState(), 0, ['gaucho-hat'], []
    );
    assert.deepEqual(progress.equipped, [], 'guardado continua guardado na próxima sala');
});

test('chapéu cai em chão livre, longe de parede e do vazio fora da sala', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    // Chão só na faixa y entre 96 e 160; parede na linha logo acima do jogador.
    const floor = { getTileAtWorldXY: (x, y) => (y >= 96 && y < 160 ? { collides: false } : null) };
    const walls = { getTileAtWorldXY: (x, y) => (y >= 80 && y < 96 ? { collides: true } : null) };
    world.collisionLayers = [walls];
    world.roomMap = { layers: [{ tilemapLayer: floor }, { tilemapLayer: walls }] };

    const spot = world.findOpenSpotNear(100, 104);
    assert.ok(spot.y >= 96 && spot.y < 160, 'no chão, não na parede de cima');
    assert.notDeepEqual(spot, { x: 100, y: 104 + 32 }, 'não em cima da espada, logo abaixo do jogador');
});

test('depois da Sala III os inimigos nascem com o dobro de vida, sem dobrar a vida salva', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const made = [];
    world.player = { sprite: { x: 0, y: 0 } };
    world.combat = { clear() {} };
    world.droneSpawnPoints = [{ x: 2000, y: 2000, patrolLeft: 1990, patrolRight: 2010 }];
    world.collisionLayers = [];
    world.isHordeSpawnPoint = () => true;
    world.physics = { add: { collider() {} } };
    world.addEnemyToCombat = () => {};
    world.createEnemy = (kind, spawn) => {
        const health = new Health(10);
        if (spawn.health !== undefined) health.takeDamage(health.max - spawn.health);
        const enemy = { health, sprite: {}, drawHealthBar() {} };
        made.push(enemy);
        return enemy;
    };
    const spawnIn = (room) => {
        world.activeRoomKey = room;
        world.isRoomCombatComplete = false;
        world.spawnDrones(1);
        return made[made.length - 1].health;
    };

    const room3 = spawnIn('room3');
    assert.deepEqual([room3.current, room3.max], [10, 10], 'até a Sala III, vida normal');
    const room4 = spawnIn('room4');
    assert.deepEqual([room4.current, room4.max], [20, 20], 'na Sala IV, o dobro');
    world.savedEnemies = [{ x: 2000, y: 2000, health: 15, kind: 'drone' }];
    const saved = spawnIn('room4');
    assert.deepEqual([saved.current, saved.max], [15, 20], 'quem volta ferido não ganha vida extra');
});

test('golem que levou o golpe final com ônibus pendente morre sozinho depois do último arremesso', () => {
    const { TopazioGolem } = load('../src/game/entities/TopazioGolem.ts');
    const { TOPAZIO_BOSS } = load('../src/game/config/ticen.ts');
    const golem = Object.create(TopazioGolem.prototype);
    let died = 0;
    Object.assign(golem, {
        health: new Health(TOPAZIO_BOSS.maxHealth),
        buses: [{ route: 4, col: 34, row: 20 }],
        busesThrown: 3,
        roarsDone: 2,
        // Já passou dos 60% antes: o atordoamento aconteceu.
        hasStunned: true,
        action: 'walk',
        actionTime: 0,
        isDeathDeferred: false,
        options: {},
        finishDeath() { died += 1; },
        flashHit() {},
        startFetch() { this.buses.length = 0; },
        scene: { cameras: { main: { shake() {} } } },
        stage: 3
    });
    golem.takeDamage(10_000);
    assert.equal(golem.health.current, 1, 'ainda falta um ônibus: segura com 1 de vida');
    assert.equal(died, 0);
    const body = { setVelocity() {} };
    golem.updateWalk(body, undefined, 16);
    assert.equal(golem.buses.length, 0, 'primeiro vai buscar o último ônibus');
    golem.busesThrown = 4;
    golem.actionTime = TOPAZIO_BOSS.roar.calmBefore - 1;
    golem.updateWalk(body, undefined, 16);
    assert.equal(died, 0, 'espera o ônibus cair');
    golem.actionTime = TOPAZIO_BOSS.roar.calmBefore;
    golem.updateWalk(body, undefined, 16);
    assert.equal(died, 1);
    assert.equal(golem.health.isAlive, false);
});

test('pegar os 14 topázios do golem vale 2K pontos uma vez e passa pelo checkpoint', () => {
    const base = { won: true, elapsedTimeMs: 0, enemiesDefeated: 0, hitsTaken: 5, multiKillBonuses: [] };
    assert.equal(calculateScore({ ...base, topazAllCollected: true }).topazPoints, SCORE_CONFIG.topazBonus);
    assert.equal(calculateScore({ ...base, topazAllCollected: true }).total - calculateScore(base).total, 2_000);

    const tracker = new RunTracker();
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    tracker.startNew('SINGLE_PLAYER', new Date(start));
    assert.equal(tracker.snapshot(start).score.topazPoints, 0);
    assert.equal(tracker.recordTopazCollection(), true);
    assert.equal(tracker.recordTopazCollection(), false, 'o bônus vale uma vez');
    assert.equal(tracker.snapshot(start).score.topazPoints, 2_000);
    const checkpoint = tracker.checkpoint();
    assert.equal(checkpoint.topazAllCollected, true);
    const restored = new RunTracker();
    restored.restore(checkpoint);
    assert.equal(restored.snapshot(start).score.topazPoints, 2_000);
    tracker.abandon();
    restored.abandon();
});

test('snapshot do golem leva a escala do giro e os outros inimigos não', () => {
    const { createEnemySnapshotRow } = load('../src/game/network/coop.ts');
    const enemy = (kind, scaleX) => ({ kind, health: { isAlive: true, current: 50 }, sprite: { x: 10, y: 20, scaleX, flipX: false, frame: { name: 3 } } });
    assert.deepEqual(createEnemySnapshotRow(enemy('golem', 0.183)), [10, 20, 50, 3, 0, 0.18]);
    assert.deepEqual(createEnemySnapshotRow(enemy('drone', 0.9)), [10, 20, 50, 3, 0]);
});

function busDoorWorld({ partner } = {}) {
    const { World } = load('../src/game/scenes/World.ts');
    const { multiplayerClient } = load('../src/game/network/MultiplayerClient.ts');
    const { TICEN_GOAL } = load('../src/game/config/ticen.ts');
    const door = { x: (TICEN_GOAL.left + TICEN_GOAL.right) / 2, y: (TICEN_GOAL.top + TICEN_GOAL.bottom) / 2 };
    const world = new World();
    world.registry = { get: (key) => key === 'multiplayerEnabled' };
    world.activeRoomKey = 'room5';
    world.golem = { health: { isAlive: false } };
    world.isBusDoorOpen = true;
    world.physics = { pause() {} };
    world.player = { health: new Health(4), sprite: { body: { center: { ...door } } } };
    if (partner) world.remotePlayers.set('parceiro', { feet: { ...door }, ...partner });
    const calls = [];
    world.updateEscapeVote = () => calls.push('voto');
    world.playDuelEnding = (localWon) => calls.push(localWon ? 'embarca' : 'fica');
    world.playBusEnding = () => calls.push('solo');
    multiplayerClient.revivesUsed = COMBAT_CONFIG.multiplayer.maxRevives;
    return { world, calls, multiplayerClient };
}

test('porta do 763.2 em dupla pede o voto enquanto os dois ainda podem jogar', () => {
    const { world, calls, multiplayerClient } = busDoorWorld({ partner: { isAlive: false, revivesLeft: 1 } });
    world.updateTicenGoal();
    assert.deepEqual(calls, ['voto']);
    multiplayerClient.disconnect();
});

test('parceiro caido sem renascimentos nao trava o voto: quem sobrou embarca e ele fica para tras', () => {
    const survivor = busDoorWorld({ partner: { isAlive: false, revivesLeft: 0 } });
    survivor.world.updateTicenGoal();
    assert.deepEqual(survivor.calls, ['embarca']);
    assert.equal(survivor.world.isDuelOver, true);

    const fallen = busDoorWorld({ partner: { isAlive: true, revivesLeft: 2 } });
    fallen.world.player.health.takeDamage(4);
    fallen.world.updateTicenGoal();
    assert.deepEqual(fallen.calls, ['fica'], 'o caido ve o parceiro embarcar quando ele chega na porta');

    const waiting = busDoorWorld({ partner: { isAlive: true, revivesLeft: 2, feet: { x: 0, y: 0 } } });
    waiting.world.player.health.takeDamage(4);
    waiting.world.updateTicenGoal();
    assert.deepEqual(waiting.calls, [], 'com o parceiro longe da porta nada acontece ainda');
    survivor.multiplayerClient.disconnect();
});

test('sem parceiro na partida a porta do 763.2 leva ao final solo', () => {
    const { world, calls, multiplayerClient } = busDoorWorld();
    world.updateTicenGoal();
    assert.deepEqual(calls, ['solo']);
    multiplayerClient.disconnect();
});

test('quem abandona a disputa pela vaga entrega o 763.2 para quem ficou', () => {
    const { world, calls, multiplayerClient } = busDoorWorld();
    world.isDuelActive = true;
    world.hasVotedEscape = true;
    world.handlePartnerLeft();
    assert.deepEqual(calls, ['embarca']);
    assert.equal(world.isDuelOver, true);
    assert.equal(world.hasVotedEscape, false);
    world.handlePartnerLeft();
    assert.deepEqual(calls, ['embarca'], 'o final so comeca uma vez');
    multiplayerClient.disconnect();
});

test('catraca do TICEN nao pede o cartao de novo para quem ja entrou', () => {
    const { world, multiplayerClient } = busDoorWorld();
    const { TICEN_GATE } = load('../src/game/config/ticen.ts');
    world.player.sprite.body.center = { ...TICEN_GATE.approach };
    world.hasPassedTicenGate = true;
    world.scene = { launch() { assert.fail('a carteira nao pode abrir'); } };
    world.updateTicenGate();
    assert.equal(world.isWalletOpen, false);
    multiplayerClient.disconnect();
});

test('botas de prata aceleram o passo e as de diamante encurtam a recarga do dash', () => {
    const { Player } = load('../src/game/entities/Player.ts');
    const { SILVER_BOOTS, DIAMOND_BOOTS, ITEM_CHESTS, ITEMS } = load('../src/game/config/items.ts');
    const player = Object.create(Player.prototype);
    player.dash = { cooldownMultiplier: 1 };
    player.wornItems = new Map([['silver-boots', () => {}]]);
    player.refreshEquipment();
    assert.equal(player.equipmentSpeedMultiplier, SILVER_BOOTS.speedMultiplier);
    assert.equal(player.dash.cooldownMultiplier, 1);
    player.wornItems = new Map([['diamond-boots', () => {}]]);
    player.refreshEquipment();
    assert.equal(player.equipmentSpeedMultiplier, 1);
    assert.equal(player.dash.cooldownMultiplier, DIAMOND_BOOTS.dashCooldownMultiplier);
    assert.ok(DIAMOND_BOOTS.dashCooldownMultiplier < 1);
    assert.equal(SILVER_BOOTS.slot, DIAMOND_BOOTS.slot, 'os dois pares disputam os pés');
    for (const chest of Object.values(ITEM_CHESTS)) assert.ok(chest.items.every((id) => ITEMS[id]), 'todo baú guarda itens do catálogo');
});

test('baú da Sala I fica trancado com o aviso e só entrega as botas se a sala acabar no tempo', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { ITEM_CHESTS } = load('../src/game/config/items.ts');
    const { x, y, timeLimitMs } = ITEM_CHESTS.room1;
    const fakeObject = () => {
        const object = { visible: true, tinted: false, frame: 0, destroy() {} };
        for (const method of ['setOrigin', 'setDepth', 'setAlign', 'setPosition', 'setScale']) object[method] = () => object;
        object.setVisible = (visible) => { object.visible = visible; return object; };
        object.setTint = () => { object.tinted = true; return object; };
        object.clearTint = () => { object.tinted = false; return object; };
        object.setFrame = (frame) => { object.frame = frame; return object; };
        return object;
    };
    const createWorld = () => {
        const world = new World();
        const hints = [];
        world.hints = hints;
        world.equipped = [];
        world.add = { sprite: (sx, sy) => Object.assign(fakeObject(), { x: sx, y: sy }) };
        world.tweens = { add() {}, killTweensOf() {} };
        world.createWorldHint = (text) => { const hint = Object.assign(fakeObject(), { text, x: 0, y: 0 }); hints.push(hint); return hint; };
        world.addChestGlow = fakeObject;
        world.player = { sprite: { x: x + 200, y }, equipItem(id) { world.equipped.push(id); }, unequipItem() {} };
        return world;
    };

    const late = createWorld();
    late.createItemChest('room1', true);
    assert.equal(late.itemChest.image.tinted, true, 'o baú nasce apagado');
    assert.match(late.hints[0].text, /COMPLETE A SALA I EM 01:30\nPARA DESBLOQUEAR UM ITEM/);
    late.updateItemChest();
    assert.equal(late.hints[0].visible, false, 'de longe não há aviso');
    late.player.sprite.x = x;
    late.updateItemChest();
    assert.equal(late.hints[0].visible, true, 'perto do baú trancado aparece o desafio');
    late.itemChestRuns.get('room1').startedAt = -timeLimitMs - 1;
    late.finishItemChestRun('room1');
    late.updateItemChest();
    assert.deepEqual(late.ownedItems, [], 'fora do tempo o baú continua trancado');
    assert.equal(late.hints[0].visible, true);

    const fast = createWorld();
    fast.createItemChest('room1', true);
    fast.finishItemChestRun('room1');
    assert.equal(fast.itemChest.image.tinted, false, 'no tempo, o baú acende');
    const chest = fast.itemChest.image;
    // Volta do esconderijo: a sala é recriada e o baú segue destrancado.
    fast.createItemChest('room1', false);
    assert.ok(fast.itemChest.glow, 'o destrancado sobrevive à ida ao esconderijo');
    fast.player.sprite.x = x;
    fast.updateItemChest();
    assert.equal(chest.frame, 0);
    assert.equal(fast.itemChest, undefined);
    assert.deepEqual(fast.ownedItems, ['silver-boots']);
    assert.deepEqual(fast.equippedItems, ['silver-boots']);
    assert.ok(fast.equipped.includes('silver-boots'), 'as botas já entram nos pés');
    fast.createItemChest('room1', false);
    assert.equal(fast.itemChest, undefined, 'quem já tem as botas encontra o baú aberto');
});

test('arrastar no inventário equipa ao soltar no boneco e guarda ao soltar na grade', () => {
    const { shouldToggleOnDrop } = load('../src/game/ui/InventoryMenuView.ts');
    const doll = [330, 170];
    const grid = [260, 330];
    assert.equal(shouldToggleOnDrop(false, ...doll), true, 'guardado solto no boneco equipa');
    assert.equal(shouldToggleOnDrop(false, ...grid), false, 'guardado solto na própria grade volta ao lugar');
    assert.equal(shouldToggleOnDrop(true, ...grid), true, 'equipado solto na grade é retirado');
    assert.equal(shouldToggleOnDrop(true, ...doll), false, 'equipado solto no boneco continua vestido');
    assert.equal(shouldToggleOnDrop(false, 700, 170), false, 'fora das áreas nada muda');
});

test('atributos do inventário somam os itens vestidos em barrinhas e porcentagem', () => {
    const { getEquipmentStats } = load('../src/game/ui/InventoryMenuView.ts');
    assert.deepEqual(getEquipmentStats([]), [
        { label: 'BLOQUEIO', pips: 0, value: '0%' },
        { label: 'VELOCIDADE', pips: 0, value: '0%' },
        { label: 'DASH', pips: 0, value: '0%' }
    ]);
    const [block, speed, dash] = getEquipmentStats(['gaucho-hat', 'silver-boots']);
    assert.deepEqual([block.pips, block.value], [2, '20%']);
    assert.deepEqual([speed.pips, speed.value], [2, '+10%']);
    assert.equal(dash.pips, 0);
    assert.deepEqual(getEquipmentStats(['helmet', 'diamond-boots']).map(({ pips }) => pips), [3, 0, 4]);
});

test('balão do inventário acompanha o encaixe e não sai do painel', () => {
    const { getTooltipPosition } = load('../src/game/ui/InventoryMenuView.ts');
    assert.deepEqual(getTooltipPosition(268, 338, 90), { x: 282, y: 348 }, 'no meio do painel fica à direita e abaixo do encaixe');
    const corner = getTooltipPosition(840, 440, 90);
    assert.ok(corner.x + 232 <= 873 && corner.y + 90 <= 486, 'no canto é empurrado para dentro');
});

test('botas calçam as pernas do personagem: gaúcho tem pernas mais largas e afastadas', () => {
    const { SILVER_BOOTS, bootPixels } = load('../src/game/config/items.ts');
    const { CHARACTERS } = load('../src/game/config/characters.ts');
    const { getItemOffsetY } = load('../src/game/entities/WornItem.ts');
    const width = (pixels) => Math.max(...pixels.map(([x, , w]) => x + w));
    assert.deepEqual(SILVER_BOOTS.pixels, bootPixels(0x9aa4b4, 0xe6ecf4), 'o ícone segue na medida do padrão');
    assert.equal(width(SILVER_BOOTS.fitFeet(CHARACTERS.padrao.feet)), 14);
    assert.equal(width(SILVER_BOOTS.fitFeet(CHARACTERS.gaucho.feet)), 20);
    // Sola na linha de baixo do pé: no frame de 38 px, 36 no padrão e 37 no gaúcho.
    const sole = (character) => 19 + getItemOffsetY(SILVER_BOOTS, 38, CHARACTERS[character].texture) + SILVER_BOOTS.height / 2;
    assert.equal(sole('padrao'), 36);
    assert.equal(sole('gaucho'), 37);
});

test('setas e controle andam pela mochila sem sair dos itens que existem', () => {
    const { moveInventorySelection } = load('../src/game/ui/InventoryMenuView.ts');
    assert.equal(moveInventorySelection(0, 4, -1, 0), 0, 'não passa do primeiro');
    assert.equal(moveInventorySelection(2, 4, 1, 0), 3);
    assert.equal(moveInventorySelection(3, 4, 1, 0), 3, 'não passa do último');
    assert.equal(moveInventorySelection(2, 4, 0, 1), 2, 'sem segunda linha, descer não muda');
    assert.equal(moveInventorySelection(11, 12, 1, 0), 11);
    assert.equal(moveInventorySelection(11, 14, 1, 0), 12, 'do fim da linha passa para a de baixo');
    assert.equal(moveInventorySelection(5, 14, 0, 1), 13, 'linha de baixo mais curta leva ao último item');
    assert.equal(moveInventorySelection(13, 14, 0, -1), 1);
    assert.equal(moveInventorySelection(1, 14, 0, -1), 1, 'não sobe da primeira linha');
    assert.equal(moveInventorySelection(0, 0, 1, 0), 0, 'mochila vazia não quebra');
});

test('baú sorteia ao destrancar só o que falta, guarda o sorteio e abre vazio para quem tem tudo', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { ITEM_CHESTS, getChestCandidates } = load('../src/game/config/items.ts');
    assert.deepEqual(getChestCandidates(['flame-sword', 'ice-staff'], ['flame-sword']), ['ice-staff']);
    const world = new World();
    world.ownedItems = ['flame-sword'];
    world.itemChestRuns.set('room3', { startedAt: 0, unlocked: false, claimed: false });
    world.finishItemChestRun('room3', () => 0);
    const run = world.itemChestRuns.get('room3');
    assert.equal(run.unlocked, true);
    assert.ok(ITEM_CHESTS.room3.items.includes(run.item));
    assert.notEqual(run.item, 'flame-sword', 'nunca sorteia o que o jogador já tem');
    const fakeSprite = () => {
        const sprite = { frame: 0 };
        for (const method of ['setOrigin', 'setDepth', 'setTint']) sprite[method] = () => sprite;
        sprite.setFrame = (frame) => { sprite.frame = frame; return sprite; };
        return sprite;
    };
    world.add = { sprite: fakeSprite };
    world.ownedItems = ['flame-sword', 'ice-staff', 'diamond-boots'];
    world.itemChestRuns.set('room3', { startedAt: 0, unlocked: false, claimed: false });
    world.createItemChest('room3', false);
    assert.equal(world.itemChest, undefined, 'quem já tem tudo da lista encontra o baú aberto');
});

test('espada flamejante golpeia nas salas com tiro sem atrasar o tiro automático', () => {
    const { combat, drones, groups, player, rings } = setup([[125, 100]]);
    player.getAimDirection = () => ({ x: 1, y: 0 });
    combat.update(0);
    assert.equal(groups[0].getLength(), 1, 'o tiro saiu');
    const afterShot = drones[0].health.current;
    assert.equal(combat.swing(0), false, 'sem a espada flamejante não há golpe');
    combat.setFlameSword(true);
    assert.equal(combat.hasSword(), true, 'o botão USAR do toque vira a espada');
    assert.equal(combat.swing(0), true);
    const { damage } = COMBAT_CONFIG.player;
    assert.equal(drones[0].health.current, afterShot - damage * COMBAT_CONFIG.flameSword.damageMultiplier);
    assert.equal(combat.swing(0), false, 'a recarga do golpe vale');
    // A recarga do tiro (600 ms) é a mais longa das duas: ao fim dela, saem o tiro e o golpe.
    combat.update(Math.max(COMBAT_CONFIG.player.fireInterval, COMBAT_CONFIG.flameSword.interval));
    assert.equal(groups[0].getLength(), 2, 'golpear não segurou o tiro seguinte');
    assert.equal(combat.swing(0), true);
    assert.ok(rings.length >= COMBAT_CONFIG.flameSword.trailFlames, 'cada golpe solta o rastro de labaredas pelo arco');
    combat.setFlameSword(false);
    assert.equal(combat.hasSword(), false, 'guardar a espada tira o golpe');
});

test('cajado de gelo congela só quem está no raio, por 1 s, sem dano, e espera alguém chegar perto', () => {
    const { radius, interval, freezeDuration } = COMBAT_CONFIG.iceStaff;
    const { combat, drones } = setup([[100 + radius - 10, 100], [100 + radius + 60, 100]]);
    const [near, far] = drones;
    for (const drone of drones) {
        drone.tint = undefined;
        drone.sprite.setVelocity = (x, y) => { drone.velocity = { x, y }; return drone.sprite; };
        drone.sprite.setTint = (color) => { drone.tint = color; return drone.sprite; };
        drone.sprite.clearTint = () => { drone.tint = undefined; return drone.sprite; };
    }
    combat.playerCooldown = 99_999;
    combat.setIceStaff(true);
    combat.update(0);
    assert.equal(combat.isFrozen(near), true);
    assert.equal(combat.isFrozen(far), false, 'fora do raio não congela');
    assert.equal(near.health.current, COMBAT_CONFIG.drone.maxHealth, 'o gelo não fere');
    combat.update(16);
    assert.deepEqual(near.velocity, { x: 0, y: 0 });
    assert.equal(near.tint, COMBAT_CONFIG.iceStaff.color);
    combat.update(freezeDuration);
    assert.equal(combat.isFrozen(near), false, 'derrete depois de 1 s');
    assert.equal(near.tint, undefined, 'e volta à cor normal');
    combat.update(interval - freezeDuration - 32);
    assert.equal(combat.isFrozen(near), false, 'ainda na recarga de 4 s');
    combat.update(32);
    assert.equal(combat.isFrozen(near), true, 'fim da recarga congela de novo');
    combat.setIceStaff(false);
});

test('cajado de fogo queima quem está em volta por 5 s com pouco dano e recarrega em 10 s', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('fire-staff'));
    const { combat, drones } = setup([[200, 100], [100 + upgrades.burnRadius + 40, 100]], [], upgrades);
    const [near, far] = drones;
    const { tickInterval } = COMBAT_CONFIG.burn;
    const tick = upgrades.damage * upgrades.burnDamageRatio;
    combat.playerCooldown = 99_999;
    combat.update(0);
    assert.equal(near.health.current, COMBAT_CONFIG.drone.maxHealth, 'pegar fogo não dá dano de uma vez');
    combat.playerCooldown = 99_999;
    combat.update(tickInterval);
    assert.ok(Math.abs(near.health.current - (COMBAT_CONFIG.drone.maxHealth - tick)) < 1e-9, 'um tick de queimadura');
    assert.equal(far.health.current, COMBAT_CONFIG.drone.maxHealth, 'fora do raio não queima');
    for (let elapsed = tickInterval; elapsed < upgrades.burnDuration + tickInterval * 2; elapsed += tickInterval) {
        combat.playerCooldown = 99_999;
        combat.update(tickInterval);
    }
    const ticks = upgrades.burnDuration / tickInterval;
    assert.ok(Math.abs(near.health.current - (COMBAT_CONFIG.drone.maxHealth - tick * ticks)) < 1e-9, 'a queimadura para depois de 5 s');
    assert.ok(tick * ticks <= upgrades.damage, 'no total, no máximo um tiro de dano');
});

test('golem joga o primeiro ônibus no jogador mais perto e depois alterna entre os dois', () => {
    const { pickBusTarget } = load('../src/game/entities/TopazioGolem.ts');
    const origin = { x: 0, y: 0 };
    const host = { id: 'host', center: { x: 50, y: 0 } };
    const guest = { id: 'guest', center: { x: 200, y: 0 } };
    assert.equal(pickBusTarget(origin, [host, guest])?.id, 'host', 'o primeiro vai no mais perto');
    assert.equal(pickBusTarget(origin, [host, guest], 'host')?.id, 'guest', 'o segundo vai no outro, mesmo mais longe');
    assert.equal(pickBusTarget(origin, [host, guest], 'guest')?.id, 'host');
    assert.equal(pickBusTarget(origin, [guest], 'guest')?.id, 'guest', 'com o parceiro caído, o vivo leva de novo');
    assert.equal(pickBusTarget(origin, []), undefined);
});

test('no convidado, o alvo do ônibus aparece em quem o anfitrião escolheu', () => {
    const { TopazioGolem } = load('../src/game/entities/TopazioGolem.ts');
    const golem = Object.create(TopazioGolem.prototype);
    const marks = [];
    Object.assign(golem, {
        health: new Health(10),
        buses: [{ route: 4, col: 34, row: 20 }],
        options: {
            mirror: true,
            getBusTargets: () => [{ id: 'host', center: { x: 300, y: 120 } }, { id: 'guest', center: { x: 40, y: 60 } }]
        },
        liftBus() {},
        actionTime: 0,
        busMarker: {
            clear() { return this; },
            fillStyle() { return this; },
            fillEllipse(x, y) { marks.push({ x, y }); return this; },
            lineStyle() { return this; },
            strokeEllipse() { return this; },
            setData() { return this; }
        }
    });
    Object.defineProperty(golem, 'isMirror', { get: () => true });
    golem.applyRemoteAction({ type: 'lift', route: 4, target: 'host' });
    golem.updateHold(golem.getBusAim());
    assert.equal(marks[0].x, 300, 'o alvo segue o anfitrião, não quem está jogando no convidado');
});

test('gelo do parceiro chega pela rede: congela sem dano e nunca por mais que o cajado', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const frozen = [];
    let damaged = 0;
    const enemy = { health: { isAlive: true }, sprite: { x: 0, y: 0 }, takeDamage() { damaged += 1; return 0; } };
    world.drones = [enemy];
    world.combat = { freezeEnemy: (target, duration) => frozen.push([target, duration]) };
    world.isMultiplayerHost = () => true;
    world.applyPartnerHit({ kind: 'enemy.hit', index: 0, damage: 0, dx: 0, dy: 0, freeze: 60_000 });
    assert.deepEqual(frozen, [[enemy, COMBAT_CONFIG.iceStaff.freezeDuration]], 'valor vindo de fora não congela além do cajado');
    assert.equal(damaged, 0, 'o gelo não fere');
    world.applyPartnerHit({ kind: 'enemy.hit', index: 7, damage: 0, dx: 0, dy: 0, freeze: 1_000 });
    assert.equal(frozen.length, 1, 'índice que não existe é ignorado');
});

test('atalho ?start= leva a dupla do multiplayer direto para a sala pedida', () => {
    const { getMultiplayerStartRoom } = load('../src/game/config/rooms.ts');
    assert.equal(getMultiplayerStartRoom('?room=teste'), 'room1', 'sem start, começa na Sala I');
    assert.equal(getMultiplayerStartRoom('?room=teste&start=5'), 'room5');
    assert.equal(getMultiplayerStartRoom('?start=3'), 'room3');
});

test('disputa do TICEN leva o anfitrião para a plataforma A e o convidado para a D', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const { TICEN_DUEL } = load('../src/game/config/ticen.ts');
    const place = (isHost) => {
        const world = new World();
        const body = {};
        body.center = { x: 100, y: 110 };
        body.reset = (x, y) => { body.at = { x, y }; };
        world.player = { sprite: { x: 100, y: 100, body, setPosition() {} } };
        world.roomMap = { hasTileAt: () => false };
        world.collisionLayers = [];
        world.cameras = { main: { flash() {} } };
        world.isMultiplayerHost = () => isHost;
        world.teleportToDuelCorner();
        // O pé cai no tile do canto; o sprite fica 10 px acima, como estava em relação ao corpo.
        return { x: body.at.x, y: body.at.y + 10 };
    };
    const [hostCorner, guestCorner] = TICEN_DUEL.corners;
    const host = place(true);
    const guest = place(false);
    assert.ok(Math.abs(host.x - hostCorner.x) < 16 && Math.abs(host.y - hostCorner.y) < 16, 'anfitrião no canto A');
    assert.ok(Math.abs(guest.x - guestCorner.x) < 16 && Math.abs(guest.y - guestCorner.y) < 16, 'convidado no canto D');
});

test('disputa do TICEN: teletransporte, close de duelo e só depois a luta', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const steps = [];
    let finishStandoff;
    world.player = {};
    world.teleportToDuelCorner = () => steps.push('teleporte');
    world.playDuelStandoff = (onDone) => { steps.push('close'); finishStandoff = onDone; };
    world.beginDuelFight = () => steps.push('luta');
    world.startDuel();
    assert.deepEqual(steps, ['teleporte', 'close'], 'a luta espera o close terminar');
    finishStandoff();
    assert.deepEqual(steps, ['teleporte', 'close', 'luta']);
});

test('curva de Bézier das cenas segue a do CSS: começa em 0, termina em 1 e a de saída corre no começo', () => {
    const { cubicBezier, EASE_OUT, EASE_IN_OUT, prefersReducedMotion } = load('../src/game/ui/easing.ts');
    const linear = cubicBezier(0, 0, 1, 1);
    for (const x of [0.1, 0.5, 0.9]) assert.ok(Math.abs(linear(x) - x) < 1e-4, 'a reta continua reta');
    assert.equal(EASE_OUT(0), 0);
    assert.equal(EASE_OUT(1), 1);
    assert.ok(EASE_OUT(0.25) > 0.75, 'a de saída já percorreu quase tudo no primeiro quarto');
    const samples = Array.from({ length: 21 }, (_, index) => EASE_IN_OUT(index / 20));
    assert.ok(samples.every((value, index) => index === 0 || value >= samples[index - 1]), 'a de ida e volta só avança');
    assert.ok(EASE_IN_OUT(0.2) < 0.1 && EASE_IN_OUT(0.8) > 0.9, 'devagar nas pontas, rápida no meio');
    assert.equal(prefersReducedMotion(() => ({ matches: true })), true);
    assert.equal(prefersReducedMotion(undefined), false);
});

test('raio do VS atravessa a tela de canto a canto e se desenha aos poucos', () => {
    const { getBoltPoints, getPartialPath } = load('../src/game/ui/DuelStandoffView.ts');
    const points = getBoltPoints(889, 500);
    assert.ok(points[0].x < 0 && points[0].y > 500, 'nasce fora da tela, embaixo à esquerda');
    assert.ok(points.at(-1).x > 889 && points.at(-1).y < 0, 'termina fora da tela, em cima à direita');
    assert.deepEqual(getPartialPath(points, 0), [points[0]], 'no começo só existe a ponta');
    assert.deepEqual(getPartialPath(points, 1), points, 'no fim, o raio inteiro');
    const half = getPartialPath(points, 0.5);
    assert.ok(half.length > 1 && half.length < points.length, 'na metade, parte das dobras');
    assert.ok(half.at(-1).x > 0 && half.at(-1).x < 889);
});

test('golem solta uma cadeia de topázio e só abre as três abaixo de 70% da vida', () => {
    const { TopazioGolem } = load('../src/game/entities/TopazioGolem.ts');
    const { TOPAZIO_BOSS } = load('../src/game/config/ticen.ts');
    const slamWith = (healthRatio) => {
        const golem = Object.create(TopazioGolem.prototype);
        let spikes = 0;
        const emitted = [];
        Object.assign(golem, {
            health: { current: TOPAZIO_BOSS.maxHealth * healthRatio, max: TOPAZIO_BOSS.maxHealth },
            hasSlammed: false,
            actionTime: TOPAZIO_BOSS.slam.windup,
            sprite: { x: 100, y: 100 },
            options: { onAction: (action) => emitted.push(action) },
            playSlamImpact() {},
            scene: { time: { delayedCall() { spikes += 1; } } }
        });
        golem.updateSlam({ x: 300, y: 100 });
        return { chains: spikes / TOPAZIO_BOSS.slam.spikeCount, rows: emitted[0].rows };
    };
    assert.deepEqual(slamWith(1), { chains: 1, rows: 1 }, 'cheio: uma cadeia só');
    assert.deepEqual(slamWith(0.71), { chains: 1, rows: 1 });
    assert.deepEqual(slamWith(0.7), { chains: 3, rows: 3 }, 'em 70%: o leque de três, e o convidado recebe o mesmo número');
});

test('golem busca um ônibus a cada 20 s mesmo sem passar dos limiares de vida', () => {
    const { TopazioGolem } = load('../src/game/entities/TopazioGolem.ts');
    const { TOPAZIO_BOSS } = load('../src/game/config/ticen.ts');
    const golem = Object.create(TopazioGolem.prototype);
    let fetches = 0;
    Object.assign(golem, {
        health: { current: TOPAZIO_BOSS.maxHealth, max: TOPAZIO_BOSS.maxHealth },
        buses: [...TOPAZIO_BOSS.buses],
        busesThrown: 0,
        sinceLastBus: 0,
        restTimer: Infinity,
        roarsDone: 0,
        isDeathDeferred: false,
        startFetch() { fetches += 1; }
    });
    const body = { setVelocity() {} };
    golem.updateWalk(body, undefined, TOPAZIO_BOSS.busInterval - 1);
    assert.equal(fetches, 0, 'com vida cheia, ainda não');
    golem.updateWalk(body, undefined, 1);
    assert.equal(fetches, 1, 'passados 20 s, vai atrás de um ônibus');
    golem.updateWalk(body, undefined, 1);
    assert.equal(fetches, 1, 'e o tempo recomeça');
});

test('fim da Sala III não oferece sempre a mesma mesa', () => {
    const { drawUpgradeCardsFeaturing } = load('../src/game/upgrades/drawUpgradeCards.ts');
    const { ROOM3_FINAL_UPGRADE_IDS } = load('../src/game/upgrades/catalog.ts');
    const all = new PlayerUpgradeState().availableCards();
    const tables = new Set();
    for (let seed = 1; seed <= 30; seed += 1) {
        let state = seed;
        const random = () => (state = (state * 9301 + 49297) % 233280) / 233280;
        tables.add(drawUpgradeCardsFeaturing(ROOM3_FINAL_UPGRADE_IDS, random, all).map((card) => card.id).sort().join());
    }
    assert.ok(tables.size >= 5, `mesas diferentes em 30 partidas: ${tables.size}`);
});

test('carta Cajado de gelo congela como o item, com raio que cresce por nível', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('ice-staff'));
    assert.equal(upgrades.freezeRadius, 150);
    const { combat, drones } = setup([[100 + 150 - 10, 100]], [], upgrades);
    drones[0].sprite.setVelocity = () => drones[0].sprite;
    drones[0].sprite.setTint = () => drones[0].sprite;
    combat.playerCooldown = 99_999;
    combat.update(0);
    assert.equal(combat.isFrozen(drones[0]), true, 'congela sem o item, só com a carta');
    upgrades.acquire(getUpgradeCard('ice-staff'));
    assert.equal(upgrades.freezeRadius, 180, '+30 px no nível 2');
});

test('rodada do golem oferece cinco cartas novas das Salas II e III, sem básicas nem as já escolhidas', () => {
    const { drawGolemCards } = load('../src/game/upgrades/drawUpgradeCards.ts');
    const { BASIC_UPGRADE_IDS, UPGRADE_CARDS } = load('../src/game/upgrades/catalog.ts');
    const acquired = ['shock-pulse', 'chain-lightning', 'spin-slash'];
    for (const roll of [0, 0.3, 0.6, 0.99]) {
        const cards = drawGolemCards(acquired, () => roll, UPGRADE_CARDS);
        const ids = cards.map((card) => card.id);
        assert.equal(cards.length, 5);
        assert.equal(new Set(ids).size, 5, 'sem repetir');
        assert.ok(!ids.some((id) => acquired.includes(id)), 'nenhuma já escolhida');
        assert.ok(!ids.some((id) => BASIC_UPGRADE_IDS.includes(id) || id === 'overclock'), 'sem básicas nem a aposentada');
    }
    const everyOption = UPGRADE_CARDS.map((card) => card.id);
    assert.deepEqual(drawGolemCards(everyOption, () => 0, UPGRADE_CARDS), [], 'quem já pegou tudo não recebe nada');
});

test('golem desaba atordoado em 60%, abre a rodada e levanta depois de 4 s sem machucar caído', () => {
    const { TopazioGolem } = load('../src/game/entities/TopazioGolem.ts');
    const { TOPAZIO_BOSS } = load('../src/game/config/ticen.ts');
    const golem = Object.create(TopazioGolem.prototype);
    let stuns = 0;
    const emitted = [];
    Object.assign(golem, {
        health: { current: TOPAZIO_BOSS.maxHealth * TOPAZIO_BOSS.stun.at, max: TOPAZIO_BOSS.maxHealth, isAlive: true },
        hasStunned: false,
        roarsDone: 2,
        buses: [],
        busesThrown: 4,
        sinceLastBus: 0,
        isDeathDeferred: false,
        stage: 2,
        options: { onStun: () => { stuns += 1; }, onAction: (action) => emitted.push(action.type) },
        sprite: { setTint() { return this; }, clearTint() { return this; } },
        scene: { tweens: { add() {} }, cameras: { main: { shake() {} } } }
    });
    golem.updateWalk({ setVelocity() {} }, undefined, 16);
    assert.equal(golem.action, 'stun');
    assert.equal(stuns, 1, 'a rodada de cartas abre');
    assert.deepEqual(emitted, ['stun'], 'o convidado recebe o atordoamento');
    golem.startStun();
    assert.equal(stuns, 1, 'só uma vez por luta');
    golem.actionTime = TOPAZIO_BOSS.stun.duration;
    golem.endStun();
    assert.equal(golem.action, 'walk', 'levanta e volta a andar');
});
