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
    vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(require, module, module.exports);
    return module.exports;
}

const { climbSewerLadder, getSewerLadderSpan } = load('../src/game/map/SewerLadder.ts');
const area = { left: 16, right: 32, top: 100, bottom: 180 };

test('escada do bueiro fica dentro da saída do esconderijo', () => {
    const { x, top, bottom } = getSewerLadderSpan(area);
    assert.ok(x > area.left && x < area.right);
    assert.ok(top < bottom);
    assert.ok(bottom > area.top && bottom < area.bottom, 'o pé da escada fica onde o jogador pisa para sair');
});

test('subir a escada desliga a física, leva o jogador para cima e só então sai', () => {
    const sprite = {
        x: 80, y: 150, alpha: 1, scaleX: 1, scaleY: 1, displayHeight: 24, body: { enable: true },
        setDepth() { return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; }
    };
    const scene = {
        tweens: {
            add(config) {
                Object.assign(sprite, { y: config.y ?? sprite.y, alpha: config.alpha ?? sprite.alpha });
                config.onComplete();
            }
        }
    };
    let left = 0;
    climbSewerLadder(scene, sprite, area, () => { left += 1; });
    assert.equal(sprite.body.enable, false, 'a escada não esbarra em paredes');
    assert.equal(sprite.x, getSewerLadderSpan(area).x, 'alinhado com a escada');
    assert.ok(sprite.y < getSewerLadderSpan(area).bottom - 12, 'subiu');
    assert.equal(sprite.alpha, 0, 'sumiu pela tampa');
    assert.equal(left, 1);
});
