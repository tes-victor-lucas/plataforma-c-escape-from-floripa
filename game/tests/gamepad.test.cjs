const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/game/input/GamepadInput.ts');
const compiledModule = { exports: {} };
const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
vm.runInThisContext(`(function(require, module, exports) { ${code}\n})`, { filename })(
    require,
    compiledModule,
    compiledModule.exports
);

const { GamepadInput, getGamepadInput, isTopGamepadScene } = compiledModule.exports;

function fakeGamepad(pressed = [], axes = [0, 0], mapping = '') {
    return {
        connected: true,
        mapping,
        axes,
        buttons: Array.from({ length: 16 }, (_, index) => ({
            pressed: pressed.includes(index),
            value: pressed.includes(index) ? 1 : 0
        }))
    };
}

test('controle USB combina direcional, botoes principais e Start', () => {
    const input = new GamepadInput();
    let gamepad = fakeGamepad();
    input.getGamepad = () => gamepad;

    input.update(1);
    assert.deepEqual(input.getMovement(), { x: 0, y: 0 });

    gamepad = fakeGamepad([0, 13], [0, 0]);
    input.update(2);
    assert.equal(input.justPressed('confirm'), true);
    assert.equal(input.justPressed('attack'), true);
    assert.deepEqual(input.getMovement(), { x: 0, y: 1 });

    input.update(3);
    assert.equal(input.justPressed('confirm'), false, 'segurar não repete a ação');

    gamepad = fakeGamepad([1, 9], [-1, -1]);
    input.update(4);
    assert.equal(input.justPressed('dash'), true);
    assert.equal(input.justPressed('cancel'), true);
    assert.equal(input.justPressed('pause'), true);
    assert.ok(Math.abs(input.getMovement().x + Math.SQRT1_2) < 0.0001);
    assert.ok(Math.abs(input.getMovement().y + Math.SQRT1_2) < 0.0001);

    gamepad = fakeGamepad();
    input.update(5);
    gamepad = fakeGamepad([5]);
    input.update(6);
    assert.equal(input.justPressed('dash'), true, 'o botão R também executa o dash');
});

test('controle com mapeamento padrao confirma com o botao principal inferior', () => {
    const input = new GamepadInput();
    let gamepad = fakeGamepad([], [0, 0], 'standard');
    input.getGamepad = () => gamepad;
    input.update(1);

    gamepad = fakeGamepad([0], [0, 0], 'standard');
    input.update(2);
    assert.equal(input.justPressed('confirm'), true);
    assert.equal(input.justPressed('cancel'), false);
});

test('cena de audio não bloqueia o controle ao retornar para o menu', () => {
    const mainMenu = { scene: { key: 'MainMenu' } };
    const audio = { scene: { key: 'Audio' } };
    const transition = { scene: { key: 'ReturnToMenuTransition' } };

    assert.equal(isTopGamepadScene(mainMenu, [mainMenu, audio]), true);
    assert.equal(isTopGamepadScene(mainMenu, [mainMenu, audio, transition]), false);
    assert.equal(isTopGamepadScene(transition, [mainMenu, audio, transition]), true);
});

test('reabrir uma cena cria um estado novo para o controle', () => {
    const scene = { events: new EventEmitter() };
    const first = getGamepadInput(scene);
    assert.equal(getGamepadInput(scene), first);

    scene.events.emit('shutdown');
    assert.notEqual(getGamepadInput(scene), first);
});
