const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(relative) {
    const filename = path.resolve(__dirname, relative);
    const module = { exports: {} };
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(
        (name) => load(path.resolve(path.dirname(filename), `${name}.ts`)), module, module.exports
    );
    return module.exports;
}

const { ROOM_DEFINITIONS } = load('../src/game/config/rooms.ts');
const mapPath = path.resolve(__dirname, '../public/assets/maps/room5.json');
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const colliders = map.layers.filter((layer) =>
    (layer.properties ?? []).some(({ name, value }) => name === 'collider' && value === true));
const isBlocked = (x, y) => colliders.some((layer) =>
    layer.data[Math.floor(y / 16) * map.width + Math.floor(x / 16)] !== 0);
const layer = (name) => map.layers.find((candidate) => candidate.name === name);

test('room5 lista os tilesets na ordem da configuração e todos existem', () => {
    assert.deepEqual(map.tilesets.map(({ name }) => name), ROOM_DEFINITIONS.room5.tilesets.map(({ mapName }) => mapName));
    for (const { image } of map.tilesets) assert.ok(existsSync(path.resolve(path.dirname(mapPath), image)), image);
});

test('room5 começa diante da catraca fechada, que só a camada do cartão bloqueia', () => {
    const { TICEN_GATE } = load('../src/game/config/ticen.ts');
    const { spawn } = ROOM_DEFINITIONS.room5;
    assert.equal(isBlocked(spawn.x, spawn.y), false);
    const row = 36;
    const blocker = layer(TICEN_GATE.blockerLayer);
    for (let col = 0; col < map.width; col += 1) {
        assert.equal(isBlocked(col * 16 + 8, row * 16 + 8), true, `catraca aberta na coluna ${col}`);
    }
    const gateCols = Array.from({ length: map.width }, (_, col) => col).filter((col) => blocker.data[row * map.width + col]);
    assert.deepEqual(gateCols, [23, 24]);
    // A grade ao lado, que abre junto com a catraca, existe mesmo na camada certa.
    for (const col of TICEN_GATE.widenCols) {
        assert.notEqual(layer(TICEN_GATE.railLayer).data[TICEN_GATE.row * map.width + col], 0, `grade na coluna ${col}`);
    }
    assert.ok(Math.abs(spawn.x - TICEN_GATE.x) <= 16, 'nasce na frente da catraca');
    assert.ok(Math.hypot(spawn.x - TICEN_GATE.approach.x, spawn.y - TICEN_GATE.approach.y) > TICEN_GATE.triggerDistance,
        'a carteira não abre logo ao nascer');
});

test('saldo do cartão é a pontuação escrita como dinheiro', () => {
    const { formatBalance } = load('../src/game/config/ticen.ts');
    assert.equal(formatBalance(0), 'R$ 0,00');
    assert.equal(formatBalance(6230), 'R$ 6.230,00');
    assert.equal(formatBalance(-5), 'R$ 0,00');
});

test('room5 tem o 763.2 via Kobrasol parado na faixa da Plataforma C', () => {
    const { firstgid, columns } = map.tilesets.find(({ name }) => name === 'ticen_onibus');
    // Cada ônibus ocupa 3 linhas da folha: o 763.2 (Estrela) é o quarto e a Jotur da linha IFSC, o quinto.
    const rowsOf = (bus) => layer('onibus').data.flatMap((gid, index) => {
        const sheetRow = Math.floor((gid - firstgid) / columns);
        return gid && Math.floor(sheetRow / 3) === bus ? [Math.floor(index / map.width)] : [];
    });
    const goalTiles = rowsOf(3);
    assert.ok(goalTiles.length > 0, 'o 763.2 está no mapa');
    assert.ok(goalTiles.every((row) => row >= 28 && row <= 32), 'na faixa entre as plataformas C e D');
    assert.ok(rowsOf(4).length > 0, 'a Jotur da linha IFSC está no mapa');
});

test('patinetes e bicicletas estacionados ficam na calçada sem fechar o caminho até a catraca', () => {
    const { TICEN_PARKED, TICEN_GATE } = load('../src/game/config/ticen.ts');
    const { spawn } = ROOM_DEFINITIONS.room5;
    for (const row of TICEN_PARKED) {
        const left = row.fromX - 8;
        const right = row.fromX + (row.count - 1) * row.spacing + 8;
        for (let x = left; x <= right; x += 4) assert.equal(isBlocked(x, row.y - 4), false, `x=${x}`);
        assert.ok(spawn.x < left || spawn.x > right || Math.abs(spawn.y - row.y) > 16, 'não nasce em cima da fileira');
        assert.ok(TICEN_GATE.approach.x < left || TICEN_GATE.approach.x > right, 'a fileira não fica na frente da catraca');
    }
});

test('Sala V usa as cores originais e ?room=51 guarda a versão cyberpunk, com o mesmo mapa', () => {
    const { getRequestedRoomKey } = load('../src/game/config/rooms.ts');
    const backup = ROOM_DEFINITIONS.room51;
    assert.equal(getRequestedRoomKey('?room=51'), 'room51');
    assert.equal(backup.mapPath, ROOM_DEFINITIONS.room5.mapPath);
    assert.equal(backup.tilesets.length, ROOM_DEFINITIONS.room5.tilesets.length);
    for (const tileset of backup.tilesets) {
        assert.ok(existsSync(path.resolve(__dirname, '../public', tileset.path)), tileset.path);
        if (tileset.mapName.startsWith('ticen_')) assert.doesNotMatch(tileset.path, /_original\.png$/);
    }
    for (const tileset of ROOM_DEFINITIONS.room5.tilesets) {
        if (tileset.mapName.startsWith('ticen_')) assert.match(tileset.path, /_original\.png$/);
    }
});

test('salas III e IV abrem saída para a seguinte e a partida termina na porta do 763.2', () => {
    const { ROOM_EXIT_GATEWAYS } = load('../src/game/config/roomGateway.ts');
    const { TICEN_GOAL } = load('../src/game/config/ticen.ts');
    const next = Object.fromEntries(ROOM_EXIT_GATEWAYS.map(({ from, to }) => [from, to]));
    assert.equal(next.room3, 'room4');
    assert.equal(next.room4, 'room5');

    const blockedIn = (name) => {
        const roomMap = JSON.parse(readFileSync(path.resolve(__dirname, `../public/assets/maps/${name}.json`), 'utf8'));
        const layers = [];
        const collect = (list) => list.forEach((item) => item.type === 'group' ? collect(item.layers) : layers.push(item));
        collect(roomMap.layers);
        const solid = layers.filter((l) => (l.properties ?? []).some(({ name: n, value }) => n === 'collider' && value));
        return (x, y) => solid.some((l) => (l.data[Math.floor(y / 16) * roomMap.width + Math.floor(x / 16)] ?? 0) !== 0);
    };
    for (const gateway of ROOM_EXIT_GATEWAYS.filter(({ from }) => from === 'room3' || from === 'room4')) {
        const blocked = blockedIn(gateway.from === 'room3' ? 'room3' : 'room4');
        const { left, right, top, bottom } = gateway.area;
        let reachable = false;
        for (let x = left; x <= Math.min(right, 767); x += 4) {
            for (let y = top; y <= bottom; y += 4) if (!blocked(x, y)) reachable = true;
        }
        assert.ok(reachable, `saída da ${gateway.from} tem chão livre`);
    }

    // A área de vitória fica livre e encostada no ônibus da fuga (linha 31 é a base dele).
    const { left, right, top, bottom } = TICEN_GOAL;
    assert.equal(isBlocked((left + right) / 2, bottom - 4), false);
    assert.equal(isBlocked((left + right) / 2, top - 8), true, 'logo acima fica o 763.2');
});
