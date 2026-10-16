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
const { COMBAT_CONFIG, ROOM2_STAIR_GUARD_SPAWNS } = load('../src/game/config/combat.ts');
const { WORLD_CONFIG } = load('../src/game/config/world.ts');
const { Drone } = load('../src/game/entities/Drone.ts');
const {
    createReachableDroneSpawns,
    DroneWaves,
    selectDroneSpawns,
    selectDroneSpawnsWithPriority
} = load('../src/game/combat/DroneWaves.ts');
const { drawUpgradeCards } = load('../src/game/upgrades/drawUpgradeCards.ts');
const { getUpgradeCard } = load('../src/game/upgrades/catalog.ts');
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
const { getHeartFillLevels } = load('../src/game/ui/HeartHealthView.ts');
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
    ROOM1_TO_ROOM2_GATEWAY
} = load('../src/game/config/roomGateway.ts');
const { ROOM_EXIT_LIGHT_STYLE } = load('../src/game/map/RoomExitPortal.ts');
const { LAMP_LIGHT_TEXTURE } = load('../src/game/map/createLampLights.ts');
const { ROOM1_CLEAR_CODE, SecretCodeMatcher } = load('../src/game/config/secretCodes.ts');
const { getInitialSceneRoute } = load('../src/game/scenes/Preloader.ts');
const {
    calculateDamagePoints,
    calculateMultiKillBonus,
    calculateScore,
    calculateTimePoints
} = load('../src/game/scoring/ScoreCalculator.ts');
const { RunTracker } = load('../src/game/scoring/RunTracker.ts');

test('pontuação v1 aplica tempo, dano, mortes, multi-kill e vitória', () => {
    const score = calculateScore({
        won: true,
        elapsedTimeMs: 12_999,
        enemiesDefeated: 3,
        hitsTaken: 0,
        multiKillBonuses: [calculateMultiKillBonus(3)]
    });
    assert.deepEqual(score, {
        victoryPoints: 1_000,
        timePoints: 5_880,
        enemyPoints: 300,
        multiKillPoints: 350,
        damagePoints: 2_000,
        total: 9_530
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
    const matcher = new SecretCodeMatcher(ROOM1_CLEAR_CODE);
    assert.equal(matcher.push('1'), false);
    assert.equal(matcher.push('9'), false);
    assert.equal(matcher.push('0'), false);
    assert.equal(matcher.push('9'), false);
    assert.equal(matcher.push('0'), true);
    assert.equal(matcher.push('0'), false, 'o código deve ser consumido após ativar');
});

test('room2 possui entrada oficial no centro da via vertical', () => {
    assert.deepEqual(ROOM_DEFINITIONS.room2.spawn, { x: 184, y: 536 });
    assert.equal(ROOM_DEFINITIONS.room2.title, 'Sala II');
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

test('saida da room1 reutiliza a luz dos postes no canto da passagem', () => {
    assert.equal(ROOM_EXIT_LIGHT_STYLE.texture, LAMP_LIGHT_TEXTURE);
    assert.ok(ROOM_EXIT_LIGHT_STYLE.spillScale > ROOM_EXIT_LIGHT_STYLE.mainScale);
    assert.ok(ROOM_EXIT_LIGHT_STYLE.mainAlpha > ROOM_EXIT_LIGHT_STYLE.spillAlpha);
    assert.ok(ROOM1_TO_ROOM2_GATEWAY.portal.x < 10 * 16);
    assert.ok(ROOM1_TO_ROOM2_GATEWAY.portal.y < 2 * 16);
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
function setup(positions = [[150, 100]], wallTiles = [], upgrades = new PlayerUpgradeState(), tracker) {
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
    const scene = {
        sound: { play() {} },
        tweens: { add() {} },
        add: {
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
    const combat = new CombatSystem(scene, player, drones, walls, upgrades, tracker);
    return { combat, player, drones, groups, colliders, overlaps, attachBody, damageLabels, companions };
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

test('botoes da derrota disparam uma unica acao ao pressionar', () => {
    const { DefeatView } = load('../src/game/ui/DefeatView.ts');
    const interactiveObjects = [];
    const graphic = () => {
        const object = { listeners: {} };
        for (const method of [
            'setDepth', 'setStrokeStyle', 'setOrigin', 'setInteractive', 'disableInteractive',
            'clear', 'fillStyle', 'fillRect', 'lineStyle', 'strokeRect', 'setColor'
        ]) object[method] = () => object;
        object.on = (event, callback) => { object.listeners[event] = callback; return object; };
        object.once = (event, callback) => {
            object.listeners[event] = callback;
            if (event === 'pointerdown') interactiveObjects.push(object);
            return object;
        };
        return object;
    };
    let restarts = 0;
    let quits = 0;
    const view = new DefeatView({
        add: { rectangle: graphic, graphics: graphic, text: graphic }
    }, {
        onRestart: () => { restarts++; },
        onQuit: () => { quits++; }
    });

    view.create();
    interactiveObjects[0].listeners.pointerdown();
    interactiveObjects[0].listeners.pointerdown();
    interactiveObjects[1].listeners.pointerdown();

    assert.equal(restarts, 1);
    assert.equal(quits, 1);
});

test('nenhum personagem dispara fora de alcance', () => {
    const { combat, groups } = setup([[301, 100]]);
    combat.update(2000);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 0);
});

test('cada personagem usa seu próprio raio; tiro inimigo é vermelho e aponta para o jogador', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.range = 180;
    const { combat, groups } = setup([[300, 100]], [], upgrades);
    combat.update(1100);
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

test('drones mantêm intervalos de disparo independentes', () => {
    const { combat, groups } = setup([[150, 100], [100, 150]]);
    combat.update(1100);
    assert.equal(groups[1].shots.length, 2);
    combat.update(1099);
    assert.equal(groups[1].shots.length, 2);
    combat.update(1);
    assert.equal(groups[1].shots.length, 4);
});

test('parede entre os personagens impede disparos dos dois lados', () => {
    const { combat, groups } = setup([[150, 100]], [
        { getLeft: () => 120, getTop: () => 90, width: 16, height: 32 }
    ]);
    combat.update(1100);
    assert.equal(groups[0].shots.length, 0);
    assert.equal(groups[1].shots.length, 0);
});

test('projétil causa dano apenas uma vez e três acertos derrotam o drone', () => {
    const { combat, groups, overlaps, drones } = setup();
    for (let i = 0; i < 3; i++) {
        combat.update(COMBAT_CONFIG.player.fireInterval);
        const shot = groups[0].shots[i];
        overlaps[0].hit(shot);
        overlaps[0].hit(shot);
        assert.equal(shot.active, false);
        assert.equal(drones[0].sprite.active, true, 'O callback deve remover o projétil, não destruir o alvo');
        assert.ok(drones[0].sprite.body);
        assert.equal(drones[0].health.current, 60 - (i + 1) * 20);
    }
    combat.update(1100);
    assert.equal(groups[0].shots.length, 3);
    assert.equal(drones[0].health.isAlive, false);
});

test('tiro inimigo reduz a vida do jogador e jogador morto interrompe o combate', () => {
    const { combat, groups, overlaps, player } = setup();
    combat.update(1100);
    overlaps[1].hit(groups[1].shots[0]);
    assert.equal(player.health.current, COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.drone.damage);
    assert.equal(player.sprite.active, true);
    assert.ok(player.sprite.body);
    player.takeDamage(COMBAT_CONFIG.player.maxHealth);
    combat.update(1100);
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
    combat.update(1100);
    combat.clear();
    combat.clear();
    assert.ok(groups.every((group) => group.shots.every((shot) => !shot.active)));
});

test('cartas alteram atributos, habilidades, limites e reparo do jogador', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('attack-range'));
    upgrades.acquire(getUpgradeCard('projectile-speed'));
    upgrades.acquire(getUpgradeCard('projectile-damage'));
    upgrades.acquire(getUpgradeCard('fire-rate'));
    upgrades.acquire(getUpgradeCard('double-shot'));
    for (let level = 0; level < 4; level++) upgrades.acquire(getUpgradeCard('piercing-shot'));
    upgrades.acquire(getUpgradeCard('companion-drone'));
    upgrades.acquire(getUpgradeCard('emergency-repair'));
    upgrades.acquire(getUpgradeCard('max-health'));

    assert.equal(upgrades.range, COMBAT_CONFIG.player.range * 1.1);
    assert.equal(upgrades.projectileSpeed, COMBAT_CONFIG.player.projectileSpeed * 1.1);
    assert.equal(upgrades.damage, COMBAT_CONFIG.player.damage * 1.2);
    assert.equal(upgrades.fireInterval, COMBAT_CONFIG.player.fireInterval * 0.85);
    assert.equal(upgrades.projectileCount, 2);
    assert.equal(upgrades.piercingTargets, 3);
    assert.equal(upgrades.companionCount, 1);
    assert.equal(upgrades.maxHealth, COMBAT_CONFIG.player.maxHealth + 2);

    const health = new Health(100);
    health.takeDamage(50);
    upgrades.repairAfterRoom(health);
    assert.equal(health.current, 70);
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
    }, upgrades);

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
    assert.equal(restoredUpgrades.damage, COMBAT_CONFIG.player.damage * 1.2);
    assert.deepEqual(Object.keys(progress).sort(), [
        'currentHealth',
        'maxHealth',
        'movementSpeedMultiplier',
        'upgrades'
    ], 'náusea e controles invertidos não pertencem ao progresso permanente');
});

test('continuar só é liberado por checkpoint conquistado depois da room1', () => {
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
    assert.equal(loadCampaignProgress(storage), undefined, 'entrar na room1 não desbloqueia continuar');

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

    for (let index = 0; index < 3; index++) {
        combat.update(COMBAT_CONFIG.player.fireInterval);
        overlaps[0].hit(groups[0].shots[index]);
    }

    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).enemiesDefeated, 1);
    assert.equal(tracker.snapshot(Date.parse('2026-01-01T00:00:05.000Z')).score.total, 100);
});

test('ondas criam 10 drones e depois 20 apenas quando todos os anteriores morrerem', () => {
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
    assert.deepEqual(counts, [10, 20]);
    assert.equal(drones.length, 30);
    waves.update(drones);
    for (const drone of drones) drone.takeDamage(60);
    waves.update(drones);
    waves.update(drones);
    assert.deepEqual(counts, [10, 20], 'Não deve existir uma terceira onda');
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
    assert.deepEqual(counts, [10, 20]);
});

test('novos drones entram no combate com tiros, dano e atraso inicial', () => {
    const { combat, player, drones, groups, overlaps, attachBody } = setup([]);
    const drone = fighter(150, 100, 60);
    attachBody(drone.sprite, 150, 100);
    drones.push(drone);
    combat.registerDrone(drone);
    combat.registerDrone(drone);
    assert.equal(overlaps.length, 2, 'Não duplica colisões ao registrar duas vezes');
    combat.update(0);
    assert.equal(groups[0].shots.length, 1);
    assert.equal(groups[1].shots.length, 0);
    overlaps[1].hit(groups[0].shots[0]);
    assert.equal(drone.health.current, 40);
    combat.update(COMBAT_CONFIG.drone.fireInterval);
    assert.equal(groups[1].shots.length, 1);
    overlaps[0].hit(groups[1].shots[0]);
    assert.equal(player.health.current, COMBAT_CONFIG.player.maxHealth - COMBAT_CONFIG.drone.damage);
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
    assert.equal(drones[0].health.current, 36);
    overlaps[1].hit(shot);
    assert.equal(shot.active, false);
    assert.equal(drones[1].health.current, 36);
    assert.deepEqual(damageLabels.map((label) => label.text), ['-24', '-24']);
});

test('drone companheiro nasce e dispara com atributos reduzidos', () => {
    const upgrades = new PlayerUpgradeState();
    upgrades.acquire(getUpgradeCard('companion-drone'));
    const { combat, groups, companions } = setup([[110, 100]], [], upgrades);
    combat.update(0);
    assert.equal(companions.length, 1);
    const companionShot = groups[0].shots.find((shot) => shot.color === 0x39ff14);
    assert.ok(companionShot);
    assert.ok(Math.abs(Math.hypot(companionShot.velocity.x, companionShot.velocity.y)
        - upgrades.projectileSpeed * 0.4) < 0.001);
});

test('duas ondas têm posições suficientes, distintas e fora da área inicial e do jogador', () => {
    const { spawn, spawnSafeRadius } = WORLD_CONFIG.player;
    for (let y = 80; y <= 544; y += 16) {
        for (let x = 88; x <= 712; x += 16) {
            const points = selectDroneSpawns(20, { x, y });
            assert.equal(new Set(points).size, 20);
            for (const point of points) {
                assert.ok(Math.hypot(point.x - x, point.y - y) >= COMBAT_CONFIG.spawnDistanceFromPlayer);
                const closestX = Math.max(point.patrolLeft, Math.min(spawn.x, point.patrolRight));
                assert.ok(Math.hypot(closestX - spawn.x, point.y - spawn.y) >= spawnSafeRadius + 16);
            }
        }
    }
    assert.equal(selectDroneSpawns(10, spawn).length, 10);
});

test('primeira onda da room2 reserva dois drones na base da escadaria', () => {
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
            const selected = selectDroneSpawns(20, { x, y }, candidates);
            assert.equal(new Set(selected).size, 20);
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
    drone.takeDamage(20);
    assert.equal(explosions.length, 0);
    drone.takeDamage(40);
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
                upgrades: []
            }
        }
    });
    assert.equal(pauses, 1);
    assert.equal(stops, 1);
    assert.equal(clears, 1);
});

test('9090 elimina os drones e conclui o combate somente na room1', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    let clears = 0;
    let completions = 0;
    const createDrone = (health) => ({
        health: { current: health, isAlive: true },
        takeDamage(amount) {
            this.health.current = Math.max(0, this.health.current - amount);
            this.health.isAlive = this.health.current > 0;
        }
    });
    const drones = [createDrone(60), createDrone(40)];
    world.activeRoomKey = 'room1';
    world.isGameplayReady = true;
    world.drones = drones;
    world.waves = {};
    world.combat = { clear() { clears++; } };
    world.completeRoomCombat = () => {
        completions++;
        world.isRoomCombatComplete = true;
        world.waves = undefined;
    };

    for (const key of '909') world.handleSecretCodeKey({ key, repeat: false });
    assert.equal(drones.every((drone) => drone.health.isAlive), true);
    world.handleSecretCodeKey({ key: '0', repeat: false });

    assert.equal(drones.every((drone) => !drone.health.isAlive), true);
    assert.equal(clears, 1);
    assert.equal(completions, 1);
    assert.equal(world.waves, undefined);

    world.activeRoomKey = 'room2';
    world.isRoomCombatComplete = false;
    for (const key of '9090') world.handleSecretCodeKey({ key, repeat: false });
    assert.equal(completions, 1, 'o segredo não deve concluir a room2');
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
    world.combat = { update() { combatUpdates++; }, clear() {} };
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
    world.update(2000, 16);
    assert.equal(combatUpdates, 1);
    assert.equal(movementUpdates, 1);
    world.player.health.takeDamage(100);
    world.update(2016, 16);
    assert.equal(restartData, undefined, 'a derrota sozinha não pode reiniciar a partida');
    launches[0].data.onRestart();
    assert.deepEqual(stoppedScenes, [
        'PauseMenu',
        'RoomTransition',
        'ReturnToMenuTransition',
        'CombatHud'
    ]);
    assert.equal(restartData.waitForReveal, false);
    assert.equal(restartData.roomKey, 'room1');
    assert.deepEqual(restartData.spawn, ROOM_DEFINITIONS.room1.spawn);
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
        'RoomTransition',
        'ReturnToMenuTransition',
        'CombatHud'
    ]);
    assert.deepEqual(launched, ['ReturnToMenuTransition']);
    assert.deepEqual(launchData, { saveContinuation: false });
    assert.deepEqual(topScenes, ['ReturnToMenuTransition']);
});

test('encerramento do mundo não falha quando a câmera já foi removida', () => {
    const { World } = load('../src/game/scenes/World.ts');
    const world = new World();
    const stopped = [];
    world.scene = { stop(key) { stopped.push(key); } };
    world.cameras = { main: undefined };
    world.input = {};
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

    assert.equal(writtenTitles.at(-1), 'Sala II');
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
