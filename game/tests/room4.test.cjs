const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const modules = new Map();
function load(relative) {
    const filename = path.resolve(__dirname, relative);
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(
        (name) => load(path.resolve(path.dirname(filename), `${name}.ts`)),
        module, module.exports
    );
    modules.set(filename, module.exports);
    return module.exports;
}

const { ROOM_DEFINITIONS } = load('../src/game/config/rooms.ts');
const { MERCADO_NPCS } = load('../src/game/config/mercado.ts');
const { MercadoNpcs, createMerchantRoute } = load('../src/game/entities/MercadoNpcs.ts');

const mapPath = path.resolve(__dirname, '../public/assets/maps/room4.json');
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const colliders = map.layers.filter((layer) =>
    (layer.properties ?? []).some((property) => property.name === 'collider' && property.value === true));
const isBlocked = (x, y) => colliders.some((layer) =>
    layer.data[Math.floor(y / 16) * map.width + Math.floor(x / 16)] !== 0);

test('room4 lista os tilesets na mesma ordem da configuração e todos existem', () => {
    assert.deepEqual(map.tilesets.map(({ name }) => name), ROOM_DEFINITIONS.room4.tilesets.map(({ mapName }) => mapName));
    for (const tileset of map.tilesets) {
        assert.ok(existsSync(path.resolve(path.dirname(mapPath), tileset.image)), tileset.image);
    }
    for (const sheet of Object.values(MERCADO_NPCS)) {
        assert.ok(existsSync(path.resolve(__dirname, '../public', sheet.path)), sheet.path);
    }
});

test('room4 deixa livres o ponto inicial e os corredores dos skatistas', () => {
    const { spawn } = ROOM_DEFINITIONS.room4;
    assert.equal(isBlocked(spawn.x, spawn.y), false);
    for (const { x, fromY, toY } of MERCADO_NPCS.skaters.paths) {
        // A rua e o largo, de onde o skatista entra até onde some.
        for (let y = Math.max(15 * 16, Math.min(fromY, toY)); y < Math.min(map.height * 16, Math.max(fromY, toY)); y += 8) {
            for (const dx of [-8, 0, 8]) assert.equal(isBlocked(x + dx, y), false, `corredor x=${x} bloqueado em y=${y}`);
        }
    }
});

function fakeScene() {
    const created = new Set();
    const sprites = [];
    return {
        sprites,
        anims: {
            exists: (key) => created.has(key),
            create: ({ key }) => created.add(key),
            generateFrameNumbers: () => []
        },
        add: {
            sprite(x, y, texture) {
                const sprite = {
                    x, y, texture, alpha: 1, flipX: false, destroyed: false, animation: undefined,
                    anims: { isPlaying: false },
                    crop: undefined,
                    setOrigin: () => sprite, setScale: () => sprite, setDepth: () => sprite,
                    setPosition(x, y) { sprite.x = x; sprite.y = y; return sprite; },
                    setCrop(...area) { sprite.crop = area.length ? area : undefined; return sprite; },
                    setFlipX(value) { sprite.flipX = value; return sprite; },
                    play(config) {
                        sprite.animation = typeof config === 'string' ? config : config.key;
                        sprite.anims.isPlaying = true;
                        return sprite;
                    },
                    destroy() { sprite.destroyed = true; }
                };
                sprites.push(sprite);
                return sprite;
            }
        },
        // O sumiço acontece no fim do tween; aqui ele termina na hora.
        tweens: { add: ({ onComplete }) => onComplete?.(), killTweensOf: () => {} }
    };
}

const playerAt = (x, y) => {
    const hits = [];
    return { hits, sprite: { body: { x: x - 4, y: y - 3, width: 8, height: 5 } }, takeDamage: (amount) => hits.push(amount) };
};
const run = (npcs, ms, player, enemies = []) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) npcs.update(16, player, enemies);
};

test('skatistas cruzam a rua e somem, liberando a horda', () => {
    const npcs = new MercadoNpcs(fakeScene());
    assert.equal(npcs.isCrossing, true);
    run(npcs, 2_000, undefined);
    assert.equal(npcs.isCrossing, true);
    run(npcs, 8_000, undefined);
    assert.equal(npcs.isCrossing, false);
});

test('skatista atropelando mata o jogador na hora', () => {
    const npcs = new MercadoNpcs(fakeScene());
    const [descending] = MERCADO_NPCS.skaters.paths;
    const player = playerAt(descending.x, 20 * 16);
    run(npcs, 6_000, player);
    assert.ok(player.hits.length > 0);
    assert.equal(npcs.hasRunOverPlayer, true);
    assert.ok(player.hits.every((amount) => amount === Number.POSITIVE_INFINITY));

    const bystander = playerAt(24, 20 * 16);
    const calm = new MercadoNpcs(fakeScene());
    run(calm, 10_000, bystander);
    assert.deepEqual(bystander.hits, []);
    assert.equal(calm.hasRunOverPlayer, false);
});

test('cada casal só foge com o jogador colado na mesa dele e um inimigo junto', () => {
    const scene = fakeScene();
    const npcs = new MercadoNpcs(scene);
    const { tables, centerOffset, texture } = MERCADO_NPCS.couple;
    const people = scene.sprites.filter((sprite) => sprite.texture === texture);
    assert.equal(people.length, tables.length * 2);
    const center = { x: tables[1].col * 16 + centerOffset.x, y: tables[1].row * 16 + centerOffset.y };
    const enemy = { sprite: { x: center.x + 100, y: center.y }, health: { isAlive: true } };

    npcs.update(16, playerAt(center.x + 80, center.y), [enemy]);
    npcs.update(16, playerAt(center.x + 20, center.y), [{ ...enemy, health: { isAlive: false } }]);
    assert.ok(people.every(({ destroyed }) => !destroyed));

    npcs.update(16, playerAt(center.x + 20, center.y), [enemy]);
    const fled = people.filter(({ destroyed }) => destroyed);
    assert.equal(fled.length, 2, 'só o casal daquela mesa');
    assert.ok(fled.every(({ flipX, animation }) => flipX && animation.startsWith('casal-')));
});

test('comerciante contorna a banca para arrumar a frente e volta para trás do balcão', () => {
    const scene = fakeScene();
    const npcs = new MercadoNpcs(scene);
    const merchants = scene.sprites.filter(({ texture }) => texture === MERCADO_NPCS.merchants.texture);
    const { behindY, frontY, counterTopY, frameHeight, stalls } = MERCADO_NPCS.merchants;
    assert.equal(merchants.length, stalls.length);
    // Atrás do balcão, o corpo some abaixo da linha do balcão.
    assert.equal(merchants[0].crop[3], frameHeight - (behindY - counterTopY));

    const seen = merchants.map(() => new Set());
    for (let elapsed = 0; elapsed < 60_000; elapsed += 16) {
        npcs.update(16, undefined, []);
        merchants.forEach((sprite, index) => seen[index].add(Math.round(sprite.y)));
    }
    stalls.forEach(({ side }, index) => {
        assert.equal(seen[index].has(frontY), side !== 0, `banca ${index}`);
        assert.ok(seen[index].has(behindY));
    });
});

test('rota do comerciante sai pela lateral livre da banca', () => {
    const left = createMerchantRoute(2, -1);
    const right = createMerchantRoute(5, 1);
    assert.ok(left.some(({ x }) => x === 2 * 16 - 8));
    assert.ok(right.some(({ x }) => x === 5 * 16 + 56));
    assert.equal(createMerchantRoute(40, 0).every(({ y }) => y === MERCADO_NPCS.merchants.behindY), true);
});

test('portal do mercado leva ao interior, a ~3 s de caminhada do fliperama', () => {
    const { SECRET_DUNGEON_GATEWAYS } = load('../src/game/config/roomGateway.ts');
    const { MERCADO_INTERIOR } = load('../src/game/config/mercado.ts');
    const { WORLD_CONFIG } = load('../src/game/config/world.ts');
    const gateway = SECRET_DUNGEON_GATEWAYS.find(({ from, to }) => from === 'room4' && to === 'mercado-interior');
    assert.ok(gateway);
    assert.equal(isBlocked(gateway.returnSpawn.x, gateway.returnSpawn.y), false, 'volta na calçada, fora da fachada');

    const interior = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/mercado-interior.json'), 'utf8'));
    assert.deepEqual(interior.tilesets.map(({ name }) => name),
        ROOM_DEFINITIONS['mercado-interior'].tilesets.map(({ mapName }) => mapName));
    const blockers = interior.layers.filter((layer) => (layer.properties ?? []).some(({ name, value }) => name === 'collider' && value));
    const blocked = (x, y) => blockers.some((layer) => layer.data[Math.floor(y / 16) * interior.width + Math.floor(x / 16)] !== 0);

    const { spawn } = ROOM_DEFINITIONS['mercado-interior'];
    const { returnArea, cabinet } = MERCADO_INTERIOR;
    assert.ok(spawn.x > returnArea.right, 'chegar não devolve o jogador na hora');
    const seconds = Math.hypot(cabinet.x - spawn.x, cabinet.y - spawn.y) / WORLD_CONFIG.player.speed;
    assert.ok(seconds > 2.5 && seconds < 3.5, `${seconds.toFixed(2)} s até o fliperama`);
    // Corredor livre na altura do fliperama, da porta até ele.
    for (let x = spawn.x; x <= cabinet.x; x += 8) assert.equal(blocked(x, cabinet.y), false, `x=${x}`);
});

test('fliperama dá duas tentativas, nenhuma depois de vencer, e só reabre depois de se afastar', () => {
    const { arcadeAttemptsLeft, canStartArcade } = load('../src/game/minigame/arcadeAttempts.ts');
    const fresh = { arcadeAttempts: 0, arcadeWon: false };
    assert.equal(canStartArcade(fresh, true), true);
    assert.equal(arcadeAttemptsLeft(fresh), 2);

    const lostOnce = { arcadeAttempts: 1, arcadeWon: false };
    assert.equal(canStartArcade(lostOnce, false), false, 'parado no fliperama depois de perder não reabre');
    assert.equal(canStartArcade(lostOnce, true), true, 'afastou e voltou: segunda chance');

    assert.equal(canStartArcade({ arcadeAttempts: 2, arcadeWon: false }, true), false, 'só duas tentativas');
    assert.equal(canStartArcade({ arcadeAttempts: 1, arcadeWon: true }, true), false, 'quem venceu não joga de novo');
    assert.equal(arcadeAttemptsLeft({ arcadeAttempts: 1, arcadeWon: true }), 0);
});
