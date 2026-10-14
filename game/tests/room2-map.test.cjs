const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const mapPath = path.resolve(__dirname, '../public/assets/maps/room2.json');
const map = JSON.parse(readFileSync(mapPath, 'utf8'));

test('room2 usa a grade esperada e referencia apenas assets do repositório', () => {
    assert.equal(map.width, 50);
    assert.equal(map.height, 40);
    assert.equal(map.tilewidth, 16);
    assert.equal(map.tileheight, 16);
    assert.equal(map.tilesets.length, 16);

    for (const tileset of map.tilesets) {
        assert.match(tileset.image, /^\.\.\/(props|tilesets)\//);
        assert.equal(
            existsSync(path.resolve(path.dirname(mapPath), tileset.image)),
            true,
            `Asset ausente: ${tileset.image}`
        );
    }
});

test('room2 preserva os colliders do Tiled e mantém o ponto inicial livre', () => {
    const tileLayers = [];
    const collectTileLayers = (layers) => {
        for (const layer of layers) {
            if (layer.type === 'group') collectTileLayers(layer.layers);
            if (layer.type === 'tilelayer') tileLayers.push(layer);
        }
    };
    collectTileLayers(map.layers);

    const colliderLayers = tileLayers.filter((layer) =>
        (layer.properties ?? []).some((property) =>
            property.name === 'collider' && property.value === true
        )
    );
    assert.deepEqual(
        colliderLayers.map((layer) => layer.name).sort(),
        [
            'base-postes',
            'block',
            'block-mapa',
            'block-vertical',
            'block-wall',
            'bloqueador-passagem',
            'bloqueador2',
            'centro-marinha',
            'old-terminal',
            'pipoqueira'
        ].sort()
    );
    assert.ok(colliderLayers.every((layer) => layer.data.some((gid) => gid !== 0)));

    const spawnTile = { x: Math.floor(184 / 16), y: Math.floor(536 / 16) };
    const spawnIndex = spawnTile.y * map.width + spawnTile.x;
    assert.ok(colliderLayers.every((layer) => layer.data[spawnIndex] === 0));
});

test('block-mapa delimita o mapa sem bloquear o ponto inicial', () => {
    const mapBoundary = map.layers.find((layer) => layer.name === 'block-mapa');
    assert.ok(mapBoundary);
    assert.equal(mapBoundary.properties.some((property) =>
        property.name === 'collider' && property.value === true), true);

    const occupiedTiles = mapBoundary.data.flatMap((gid, index) => gid === 0 ? [] : [{
        x: index % map.width,
        y: Math.floor(index / map.width)
    }]);
    assert.equal(occupiedTiles.length, 154);
    assert.ok(occupiedTiles.some(({ x, y }) => x === 4 && y === 0));
    assert.ok(occupiedTiles.some(({ x, y }) => x === 45 && y === 34));
    assert.ok(occupiedTiles.some(({ x, y }) => x === 11 && y === 35));
    assert.equal(occupiedTiles.some(({ x, y }) => x === 11 && y === 33), false);
});
