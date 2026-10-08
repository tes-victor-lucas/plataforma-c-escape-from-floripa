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
            'block',
            'block-escadas-',
            'block-vertical',
            'bloqueador-passagem',
            'bloqueador2',
            'centro-marinha',
            'lampadas',
            'objects-block',
            'old-terminal',
            'old-terminal-teto',
            'pipoqueira',
            'placa-onibus',
            'right'
        ].sort()
    );
    assert.ok(colliderLayers.every((layer) => layer.data.some((gid) => gid !== 0)));

    const spawnTile = { x: Math.floor(400 / 16), y: Math.floor(536 / 16) };
    const spawnIndex = spawnTile.y * map.width + spawnTile.x;
    assert.ok(colliderLayers.every((layer) => layer.data[spawnIndex] === 0));
});

test('collider dedicado da escada é a única fonte dos bloqueios da escada', () => {
    const stairCollider = map.layers.find((layer) => layer.name === 'block-escadas-');
    assert.ok(stairCollider);
    assert.equal(stairCollider.properties.some((property) =>
        property.name === 'collider' && property.value === true), true);

    const occupiedTiles = stairCollider.data.flatMap((gid, index) => gid === 0 ? [] : [{
        x: index % map.width,
        y: Math.floor(index / map.width)
    }]);
    assert.deepEqual(occupiedTiles, [
        { x: 8, y: 16 }, { x: 9, y: 16 }, { x: 17, y: 16 }, { x: 18, y: 16 },
        { x: 9, y: 18 }, { x: 10, y: 18 }, { x: 11, y: 18 }, { x: 12, y: 18 },
        { x: 13, y: 18 }, { x: 14, y: 18 }, { x: 15, y: 18 }, { x: 16, y: 18 },
        { x: 17, y: 18 }, { x: 8, y: 19 }, { x: 9, y: 19 }, { x: 17, y: 19 },
        { x: 18, y: 19 }
    ]);
});
