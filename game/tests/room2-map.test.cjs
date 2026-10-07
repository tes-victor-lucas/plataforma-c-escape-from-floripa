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
