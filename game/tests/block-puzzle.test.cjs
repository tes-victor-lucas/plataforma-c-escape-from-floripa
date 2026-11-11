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

const { BlockPuzzle, PUZZLE_SHAPE_COUNT } = load('../src/game/minigame/BlockPuzzle.ts');
// Sorteia sempre a mesma peça: 0 é a reta de quatro, 1 é o quadrado.
const always = (shape) => () => shape / PUZZLE_SHAPE_COUNT;

test('linha completa some e vale os pontos configurados', () => {
    const puzzle = new BlockPuzzle(4, 6, 50, always(0));
    puzzle.drop();
    assert.equal(puzzle.score, 50);
    assert.ok(puzzle.board.every((row) => row.every((cell) => cell === 0)), 'a linha cheia foi removida');
});

test('duas linhas de uma vez valem o dobro', () => {
    const puzzle = new BlockPuzzle(2, 6, 50, always(1));
    puzzle.drop();
    assert.equal(puzzle.score, 100);
});

test('peça para no fundo e nas paredes', () => {
    const puzzle = new BlockPuzzle(10, 8, 50, always(1));
    while (puzzle.move(-1));
    assert.equal(Math.min(...puzzle.falling.map(({ x }) => x)), 0);
    for (let i = 0; i < 20 && puzzle.board[7][0] === 0; i += 1) puzzle.step();
    // Travou no fundo e outra peça nasceu no topo.
    assert.equal(puzzle.board[7][0], 2);
    assert.equal(Math.min(...puzzle.falling.map(({ y }) => y)), 0);
});

test('girar perto da parede empurra a peça para dentro', () => {
    const puzzle = new BlockPuzzle(10, 10, 50, always(0));
    puzzle.rotate();
    while (puzzle.move(1));
    assert.equal(puzzle.rotate(), true);
    assert.ok(puzzle.falling.every(({ x }) => x >= 0 && x < 10));
});

test('pilha no topo encerra o jogo', () => {
    const puzzle = new BlockPuzzle(4, 3, 50, always(1));
    for (let i = 0; i < 5 && !puzzle.isOver; i += 1) puzzle.drop();
    assert.equal(puzzle.isOver, true);
    const before = puzzle.score;
    puzzle.drop();
    assert.equal(puzzle.score, before, 'depois do fim nada mais conta');
});

test('prévia mostra a peça que entra depois da atual', () => {
    const sequence = [0, 1, 2, 3].map((shape) => (shape + 0.5) / PUZZLE_SHAPE_COUNT);
    const puzzle = new BlockPuzzle(10, 12, 50, () => sequence.shift() ?? 0);
    // A primeira sorteada já é a atual; a segunda fica na prévia.
    assert.equal(puzzle.falling[0].color, 1);
    assert.equal(puzzle.next.color, 2);
    puzzle.drop();
    assert.equal(puzzle.falling[0].color, 2, 'a peça da prévia é a que caiu em seguida');
    assert.equal(puzzle.next.color, 3);
});

test('as sete peças têm quatro blocos e giram nas orientações do gênero (I, O, T, S, Z, J, L)', () => {
    const normalize = (cells) => {
        const minX = Math.min(...cells.map(({ x }) => x));
        const minY = Math.min(...cells.map(({ y }) => y));
        return cells.map(({ x, y }) => `${x - minX},${y - minY}`).sort().join(' ');
    };
    const all = new Set();
    const orientations = [];
    for (let shape = 0; shape < PUZZLE_SHAPE_COUNT; shape += 1) {
        const puzzle = new BlockPuzzle(10, 10, 50, always(shape));
        // Desce um pouco para girar sem encostar no topo.
        puzzle.step();
        puzzle.step();
        const seen = new Set();
        for (let turn = 0; turn < 4; turn += 1) {
            assert.equal(puzzle.falling.length, 4);
            seen.add(normalize(puzzle.falling));
            assert.equal(puzzle.rotate(), true);
        }
        assert.equal(normalize(puzzle.falling), [...seen][0], 'quatro giros voltam à posição inicial');
        orientations.push(seen.size);
        for (const form of seen) all.add(form);
    }
    assert.deepEqual(orientations, [2, 1, 4, 2, 2, 4, 4]);
    assert.equal(all.size, 19, 'nenhum formato repetido entre peças diferentes');
});
