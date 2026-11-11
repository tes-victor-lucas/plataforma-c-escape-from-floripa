const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const mapsDir = path.resolve(__dirname, '../public/assets/maps');
const readMap = (name) => JSON.parse(readFileSync(path.join(mapsDir, name), 'utf8'));
const room3 = readMap('room3.json');
const room2 = readMap('room2.json');
const roomsSource = readFileSync(path.resolve(__dirname, '../src/game/config/rooms.ts'), 'utf8');

function tileLayers(layers, found = []) {
    for (const layer of layers) {
        if (layer.type === 'group') tileLayers(layer.layers, found);
        if (layer.type === 'tilelayer') found.push(layer);
    }
    return found;
}

const isCollider = (layer) => (layer.properties ?? []).some((property) =>
    property.name === 'collider' && property.value === true);

// Mesma consulta do World: o centro do tile no mundo, descontando o offset em pixels da camada.
function hasTileAtWorldCenter(map, layer, x, y) {
    const tileX = Math.floor(((x + 0.5) * map.tilewidth - (layer.offsetx ?? 0)) / map.tilewidth);
    const tileY = Math.floor(((y + 0.5) * map.tileheight - (layer.offsety ?? 0)) / map.tileheight);
    if (tileX < 0 || tileY < 0 || tileX >= map.width || tileY >= map.height) return false;
    return layer.data[tileY * map.width + tileX] !== 0;
}

function blockedGrid(map) {
    const blocked = new Set();
    const colliders = tileLayers(map.layers).filter(isCollider);
    for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
            if (colliders.some((layer) => hasTileAtWorldCenter(map, layer, x, y))) blocked.add(y * map.width + x);
        }
    }
    return blocked;
}

function reachableFrom(map, start) {
    const blocked = blockedGrid(map);
    const seen = new Set([start.y * map.width + start.x]);
    const queue = [start];
    while (queue.length > 0) {
        const { x, y } = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx;
            const ny = y + dy;
            const index = ny * map.width + nx;
            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
            if (blocked.has(index) || seen.has(index)) continue;
            seen.add(index);
            queue.push({ x: nx, y: ny });
        }
    }
    return { seen, blocked };
}

test('room3 usa a grade esperada e referencia apenas assets do repositório', () => {
    assert.equal(room3.width, 50);
    assert.equal(room3.height, 40);
    assert.equal(room3.tilewidth, 16);
    assert.equal(room3.tilesets.length, 37);
    for (const tileset of room3.tilesets) {
        assert.match(tileset.image, /^\.\.\/(props|tilesets)\//);
        assert.equal(existsSync(path.resolve(mapsDir, tileset.image)), true, `Asset ausente: ${tileset.image}`);
    }
});

test('room3 começa com os mesmos tilesets da room2, na mesma ordem', () => {
    // createRoom resolve os tilesets por posição; a configuração reaproveita a lista da room2.
    assert.deepEqual(
        room3.tilesets.slice(0, room2.tilesets.length).map((tileset) => tileset.name),
        room2.tilesets.map((tileset) => tileset.name)
    );
    for (const tileset of room3.tilesets.slice(room2.tilesets.length)) {
        assert.match(roomsSource, new RegExp(`mapName: '${tileset.name}'`));
    }
});

test('room3 cerca o mapa e deixa a praça inteira acessível a partir da entrada à esquerda', () => {
    const colliders = tileLayers(room3.layers).filter(isCollider);
    assert.ok(colliders.every((layer) => layer.data.some((gid) => gid !== 0)));
    assert.deepEqual(
        [...new Set(colliders.map((layer) => layer.name))].sort(),
        [
            'BORDA-CANTEIRO',
            'banco-figueira-traseira',
            'bancos-figueira',
            'block-mapa',
            'block-wall',
            'bloqueador2',
            'canteiros',
            'catedral',
            'cerca-monumenti',
            'collider-tronco',
            'floria-outdoor-base',
            'monumento',
            'pendulo',
            'pendulo-back',
            'pipoqueira',
            'postes-base'
        ].sort()
    );

    const spawn = { x: 6, y: 20 };
    const { seen, blocked } = reachableFrom(room3, spawn);
    assert.equal(blocked.has(spawn.y * room3.width + spawn.x), false);
    // Nada fora da moldura do block-mapa é alcançável.
    for (const index of seen) {
        const x = index % room3.width;
        const y = Math.floor(index / room3.width);
        assert.ok(x > 4 && x < 45 && y > 10 && y < 35, `Tile fora da moldura alcançável: ${x},${y}`);
    }
    // Rua, calçada da catedral e os quatro cantos da praça.
    for (const [x, y] of [[44, 20], [22, 16], [5, 34], [44, 34], [29, 34], [40, 12]]) {
        assert.ok(seen.has(y * room3.width + x), `Tile inalcançável: ${x},${y}`);
    }
    // A base do tronco da figueira (deslocada no Tiled para o meio da praça) bloqueia.
    assert.equal(blocked.has(33 * room3.width + 22), true);
});

test('saída da room2 para a room3 fica na rua livre junto à parede direita', () => {
    const { seen } = reachableFrom(room2, { x: 11, y: 33 });
    for (let y = 18; y < 22; y += 1) {
        assert.ok(seen.has(y * room2.width + 44), `Saída bloqueada em 44,${y}`);
    }
});

test('room3 não tem tiles invisíveis com collider entre a pérgola e os bancos', () => {
    // Sobras de quando a figueira foi deslocada: travavam o jogador na faixa sob os bancos.
    const layer = (name, index) => tileLayers(room3.layers).filter((candidate) => candidate.name === name)[index];
    const at = (target, x, y) => target.data[y * room3.width + x];
    const colliderPendulo = layer('pendulo', 1);
    assert.equal(isCollider(colliderPendulo), true);
    for (const [x, y] of [[17, 31], [18, 31], [17, 32], [18, 32]]) assert.equal(at(colliderPendulo, x, y), 0);
    assert.equal(at(layer('banco-figueira-traseira', 0), 21, 31), 0);
    assert.equal(at(layer('banco-figueira-traseira', 0), 21, 32), 0);
    assert.equal(at(layer('bancos-figueira', 0), 24, 16), 0);
    // Raízes penduradas duplicadas da figueira-tronco: com collider, bloqueavam a passagem à direita do tronco.
    assert.equal(at(layer('collider-tronco', 0), 27, 30), 0);
    assert.equal(at(layer('collider-tronco', 0), 27, 31), 0);
});

test('room3 mantém a camada de flores que o efeito radioativo usa', () => {
    const flowers = tileLayers(room3.layers).find(({ name }) => name === 'flores');
    assert.ok(flowers, 'camada flores existe');
    assert.ok(flowers.data.some((gid) => gid !== 0), 'há flores para contaminar');
});
