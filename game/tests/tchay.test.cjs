const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
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

const { TCHAY } = load('../src/game/config/tchay.ts');
const { TchayQueue } = load('../src/game/entities/TchayQueue.ts');

function fakeScene() {
    const created = new Set();
    const sprites = [];
    return {
        sprites,
        anims: { exists: (key) => created.has(key), create: ({ key }) => created.add(key), generateFrameNumbers: () => [] },
        add: {
            sprite(x, y) {
                const sprite = {
                    x, y, destroyed: false, animation: undefined, flipX: false,
                    setOrigin: () => sprite, setDepth: () => sprite,
                    setFlipX(value) { sprite.flipX = value; return sprite; },
                    play(config) { sprite.animation = typeof config === 'string' ? config : config.key; return sprite; },
                    destroy() { sprite.destroyed = true; }
                };
                sprites.push(sprite);
                return sprite;
            }
        },
        // A saída termina na hora: o atendido some logo depois de pegar o copão.
        tweens: {
            log: [],
            add(config) {
                this.log.push(config);
                config.targets.lastAnimation = config.targets.animation;
                config.onComplete?.();
            },
            killTweensOf: () => {}
        }
    };
}

test('fila do TCHAY tem 15 pessoas e a cada 5 s uma sai com o copão e outra entra no fim', () => {
    const scene = fakeScene();
    const queue = new TchayQueue(scene);
    assert.equal(queue.queue.length, TCHAY.queueLength);
    const [first, second] = queue.queue.map(({ sprite }) => sprite);
    assert.equal(first.x, TCHAY.counter.x, 'o primeiro está no balcão');

    queue.update(TCHAY.serveInterval - 1);
    assert.equal(queue.served, 0, 'ninguém sai antes dos 5 s');

    queue.update(1);
    assert.equal(queue.served, 1);
    assert.equal(first.destroyed, true);
    assert.ok(first.lastAnimation.endsWith('-copo'), 'sai segurando o copão');
    // Primeiro anda 5 s com o copão (sem sumir); só o tween seguinte apaga a pessoa.
    const [walk, fade] = scene.tweens.log;
    assert.equal(walk.duration, TCHAY.exitDuration);
    assert.equal(walk.alpha, undefined, 'não some enquanto anda');
    assert.equal(fade.alpha, 0);
    assert.equal(queue.queue.length, TCHAY.queueLength, 'alguém entrou no fim da fila');

    // O segundo anda até o balcão.
    for (let elapsed = 0; elapsed < 1_000; elapsed += 16) queue.update(16);
    assert.equal(second.x, TCHAY.counter.x);
    assert.ok(second.animation.endsWith('-parado'));
});

test('varal se prende no topo dos postes da calçada e em ganchos na parede, nunca no vazio', () => {
    const { STRING_LIGHTS } = load('../src/game/config/tchay.ts');
    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room01.json'), 'utf8'));
    const objects = map.layers.find(({ name }) => name === 'objects');
    const { firstgid, columns } = map.tilesets.find(({ name }) => name === 'objects_and_items-01');
    // Tile 87 do objects_and_items-01: o chapéu vermelho no alto do poste.
    const lampTop = firstgid + 87;
    for (const point of STRING_LIGHTS.points) {
        const col = Math.floor(point.x / 16);
        const row = Math.floor(point.y / 16);
        if (point.anchor === 'poste') {
            assert.equal(objects.data[row * map.width + col], lampTop, `poste em (${point.x}, ${point.y})`);
        } else {
            // Gancho na parede das fachadas, fora do beco das colunas 9-12 (passagem para a Sala II).
            assert.ok(row <= 3 && (col < 9 || col > 12), `gancho em (${point.x}, ${point.y})`);
        }
    }
    assert.equal(columns, 10);
});

test('Gatus com fila e Bar do Noel com roda de pagode, tudo sobre calçada livre', () => {
    const { POPULAR_BARS, PAGODE } = load('../src/game/config/tchay.ts');
    const map = JSON.parse(readFileSync(path.resolve(__dirname, '../public/assets/maps/room01.json'), 'utf8'));
    const blocking = map.layers.filter(({ name }) => name !== 'floor' && name !== 'street');
    const occupied = (x, y) => blocking.some((layer) => layer.data[Math.floor(y / 16) * map.width + Math.floor(x / 16)] !== 0);
    const free = (x0, x1, y0, y1, what) => {
        for (let x = x0; x <= x1; x += 4) {
            for (let y = y0; y < y1; y += 4) assert.equal(occupied(x, y), false, `${what} em (${x}, ${y})`);
        }
    };

    assert.equal(POPULAR_BARS.bars.length, 2);
    for (const bar of POPULAR_BARS.bars) {
        free(bar.x - 30, bar.x + 30, bar.y - 46, bar.y, 'bar');
        if (!('queue' in bar)) continue;
        const queue = new TchayQueue(fakeScene(), bar.queue);
        const people = queue.queue.map(({ sprite }) => sprite);
        assert.equal(people.length, 6);
        for (const person of people) free(person.x, person.x, person.y - 4, person.y, 'fila');
        assert.equal(Math.sign(people[1].x - people[0].x), bar.queue.direction, 'a fila cresce para o lado configurado');
        assert.ok(people.every(({ flipX }) => flipX === (bar.queue.direction > 0)), 'todos olham para o balcão');
    }
    free(PAGODE.table.x - 30, PAGODE.table.x + 30, PAGODE.table.y - 14, PAGODE.table.y, 'mesa do pagode');
    assert.ok(PAGODE.people.some(({ play }) => play === 'pandeiro'), 'tem pandeiro na roda');
    // A mesa fica na frente das pessoas (y maior), cobrindo a cintura delas.
    assert.ok(PAGODE.people.every(({ y }) => y < PAGODE.table.y));
});
