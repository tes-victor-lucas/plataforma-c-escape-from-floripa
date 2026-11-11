/** Peças de quatro blocos: tamanho da caixa onde giram e células na posição inicial. */
const SHAPES: readonly Readonly<{ size: number; cells: readonly (readonly [number, number])[] }>[] = [
    { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    { size: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
];

export const PUZZLE_SHAPE_COUNT = SHAPES.length;

type Piece = { shape: number; size: number; cells: [number, number][]; x: number; y: number };

/** Jogo de blocos caindo do fliperama: cada linha completa some e vale pontos. */
export class BlockPuzzle {
    /** 0 é vazio; 1 em diante é a cor (peça + 1) do bloco travado. */
    readonly board: number[][];
    score = 0;
    isOver = false;
    private piece!: Piece;
    private nextShape: number;

    constructor(
        readonly width: number,
        readonly height: number,
        private readonly pointsPerLine: number,
        private readonly random: () => number = Math.random
    ) {
        this.board = Array.from({ length: height }, () => new Array<number>(width).fill(0));
        this.nextShape = this.drawShape();
        this.spawn();
    }

    /** Células da peça que está caindo, já na posição do tabuleiro. */
    get falling() {
        return this.piece.cells.map(([x, y]) => ({ x: this.piece.x + x, y: this.piece.y + y, color: this.piece.shape + 1 }));
    }

    /** Prévia da próxima peça: células na caixa dela e a cor. */
    get next() {
        const { size, cells } = SHAPES[this.nextShape];
        return { size, color: this.nextShape + 1, cells: cells.map(([x, y]) => ({ x, y })) };
    }

    move(dx: number) {
        return this.tryPlace(this.piece.cells, this.piece.x + dx, this.piece.y);
    }

    rotate() {
        const { size } = this.piece;
        const rotated = this.piece.cells.map(([x, y]) => [size - 1 - y, x] as [number, number]);
        // Encostada na parede, tenta empurrar um passo para dentro antes de desistir.
        return [0, -1, 1, -2, 2].some((kick) => this.tryPlace(rotated, this.piece.x + kick, this.piece.y));
    }

    /** Desce um passo; sem espaço, a peça trava. Também é o passo da gravidade. */
    step() {
        if (this.isOver) return;
        if (!this.tryPlace(this.piece.cells, this.piece.x, this.piece.y + 1)) this.lock();
    }

    drop() {
        if (this.isOver) return;
        while (this.tryPlace(this.piece.cells, this.piece.x, this.piece.y + 1));
        this.lock();
    }

    private tryPlace(cells: [number, number][], x: number, y: number) {
        if (this.isOver || !this.fits(cells, x, y)) return false;
        Object.assign(this.piece, { cells, x, y });
        return true;
    }

    private fits(cells: readonly (readonly [number, number])[], x: number, y: number) {
        return cells.every(([cx, cy]) => {
            const bx = x + cx;
            const by = y + cy;
            return bx >= 0 && bx < this.width && by < this.height && (by < 0 || this.board[by][bx] === 0);
        });
    }

    private lock() {
        for (const { x, y, color } of this.falling) {
            if (y >= 0) this.board[y][x] = color;
        }
        for (let row = this.height - 1; row >= 0;) {
            if (this.board[row].every((cell) => cell !== 0)) {
                this.board.splice(row, 1);
                this.board.unshift(new Array<number>(this.width).fill(0));
                this.score += this.pointsPerLine;
            } else {
                row -= 1;
            }
        }
        this.spawn();
    }

    private drawShape() {
        return Math.min(SHAPES.length - 1, Math.floor(this.random() * SHAPES.length));
    }

    private spawn() {
        const shape = this.nextShape;
        this.nextShape = this.drawShape();
        const { size, cells } = SHAPES[shape];
        this.piece = { shape, size, cells: cells.map(([x, y]) => [x, y]), x: Math.floor((this.width - size) / 2), y: 0 };
        // Sem espaço para a peça nova, a pilha chegou ao topo.
        if (!this.fits(this.piece.cells, this.piece.x, this.piece.y)) this.isOver = true;
    }
}
