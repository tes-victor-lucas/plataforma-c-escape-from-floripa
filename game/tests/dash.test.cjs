const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/game/entities/DashState.ts');
const compiledModule = { exports: {} };
const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(
    require,
    compiledModule,
    compiledModule.exports
);

const { DashState } = compiledModule.exports;

test('dash normaliza a direção e termina após sua duração', () => {
    const dash = new DashState(130, 700);
    assert.equal(dash.tryStart({ x: 1, y: 1 }), true);
    assert.ok(Math.abs(dash.direction.x - Math.SQRT1_2) < 0.0001);
    assert.ok(Math.abs(dash.direction.y - Math.SQRT1_2) < 0.0001);
    assert.equal(dash.tick(129), false);
    assert.equal(dash.isActive, true);
    assert.equal(dash.tick(1), true);
    assert.equal(dash.isActive, false);
});

test('dash respeita a recarga e pode ser cancelado sem removê-la', () => {
    const dash = new DashState(130, 700);
    assert.equal(dash.tryStart({ x: 0, y: -1 }), true);
    dash.cancel();
    assert.equal(dash.isActive, false);
    assert.equal(dash.tryStart({ x: 1, y: 0 }), false);
    dash.tick(699);
    assert.equal(dash.tryStart({ x: 1, y: 0 }), false);
    dash.tick(1);
    assert.equal(dash.tryStart({ x: 1, y: 0 }), true);
});

test('dash expõe uma carga progressiva para o HUD', () => {
    const dash = new DashState(130, 700);
    assert.equal(dash.charge, 1);
    dash.tryStart({ x: 1, y: 0 });
    assert.equal(dash.charge, 0);
    dash.tick(350);
    assert.equal(dash.charge, 0.5);
    dash.tick(350);
    assert.equal(dash.charge, 1);
});
