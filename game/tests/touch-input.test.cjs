const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.resolve(__dirname, '../src/game/input/TouchInput.ts'), 'utf8');
const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText)(compiled, compiled.exports);
const { touchInput, joystickDirection } = compiled.exports;

test('joystick ignora arrasto curto e normaliza a direção', () => {
    assert.deepEqual(joystickDirection(5, 5, 52), { x: 0, y: 0 });
    assert.deepEqual(joystickDirection(30, 0, 52), { x: 1, y: 0 });
    const diagonal = joystickDirection(40, 40, 52);
    assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
});

test('botão de toque dispara a ação uma vez e reset limpa tudo', () => {
    touchInput.press('dash');
    assert.equal(touchInput.consume('dash'), true);
    assert.equal(touchInput.consume('dash'), false);
    touchInput.press('interact');
    touchInput.x = 1;
    touchInput.reset();
    assert.equal(touchInput.consume('interact'), false);
    assert.equal(touchInput.x, 0);
});

test('controles de toque só valem para ponteiro grosso, como no CSS', () => {
    const { isTouchScreen } = compiled.exports;
    assert.equal(isTouchScreen((query) => ({ matches: query === '(pointer: coarse)' })), true);
    assert.equal(isTouchScreen(() => ({ matches: false })), false);
    assert.equal(isTouchScreen(undefined), false);
});
