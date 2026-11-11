import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { MERCADO_INTERIOR } from '../config/mercado';
import { bindGamepadActions, getGamepadInput, type GamepadAction } from '../input/GamepadInput';
import { BlockPuzzle } from '../minigame/BlockPuzzle';

/** `attemptsLeft` conta as tentativas que sobram depois desta; `played` é falso quando o jogador sai antes de iniciar. */
export type ArcadeMinigameData = { attemptsLeft: number; onFinish: (won: boolean, played: boolean) => void };

const FONT = 'PixelGamer, monospace';
const CELL = 22;
// Uma cor de caixote por formato de peça.
const CRATE_COLORS = [0x5ce5f1, 0xffd25a, 0xf056c5, 0x6fd36f, 0xe84a4a, 0x5a8cff, 0xff9a3c];
const PREVIEW_CELL = 16;
const RESULT_DURATION = 1_800;
// Segurar no direcional do controle repete o movimento, como a tecla segurada no teclado.
const HOLD_DELAY = 170;
const HOLD_REPEAT = 60;
const HELD_ACTIONS = ['left', 'right', 'down'] as const satisfies readonly GamepadAction[];
// Controle no padrão Tetris: botão A gira e o direcional para cima solta a peça.
const CONTROLS = [
    ['GIRAR', 'W / ↑', 'A'],
    ['MOVER', 'A D / ← →', '← →'],
    ['DESCER', 'S / ↓', '↓'],
    ['SOLTAR', 'ESPAÇO', '↑'],
    ['SAIR', 'ESC', 'B']
] as const;

/** Fliperama do Mercado Público: caixotes caindo; cada linha completa vale pontos. */
export class ArcadeMinigame extends Scene {
    private puzzle!: BlockPuzzle;
    private board!: Phaser.GameObjects.Graphics;
    private scoreText!: Phaser.GameObjects.Text;
    private onFinish!: (won: boolean, played: boolean) => void;
    private attemptsLeft = 0;
    private readonly heldFor = new Map<GamepadAction, number>();
    private elapsed = 0;
    private finished = false;
    private started = false;
    private intro?: Phaser.GameObjects.Container;
    private introButtons: Phaser.GameObjects.Rectangle[] = [];
    private introChoice = 0;
    private boardX = 0;
    private boardY = 0;

    constructor() {
        super('ArcadeMinigame');
    }

    create(data: ArcadeMinigameData) {
        const { width, height, pointsPerLine, goalScore, rewardHearts } = MERCADO_INTERIOR.arcade;
        this.onFinish = data.onFinish;
        this.attemptsLeft = data.attemptsLeft;
        this.heldFor.clear();
        this.puzzle = new BlockPuzzle(width, height, pointsPerLine);
        this.elapsed = 0;
        this.finished = false;
        this.started = false;
        this.introChoice = 0;
        this.boardX = Math.round(GAME_WIDTH / 2 - width * CELL / 2);
        this.boardY = 64;

        this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05040a, 0.88).setOrigin(0);
        this.add.rectangle(GAME_WIDTH / 2, this.boardY + height * CELL / 2, width * CELL + 16, height * CELL + 16, 0x2a1640)
            .setStrokeStyle(3, 0xf056c5);
        this.text(GAME_WIDTH / 2, 30, 'CAIXOTES', 30, '#f056c5');
        this.text(160, 110, `META: ${goalScore} PONTOS`, 16, '#5ce5f1');
        this.text(160, 136, `PRÊMIO: ${rewardHearts} CORAÇÕES`, 16, '#ffd25a');
        this.text(160, 162, `LINHA: ${pointsPerLine} PONTOS`, 16, '#ffffff');
        this.text(GAME_WIDTH - 160, 80, 'PRÓXIMA', 16, '#5ce5f1');
        this.add.rectangle(GAME_WIDTH - 160, 136, PREVIEW_CELL * 4 + 16, PREVIEW_CELL * 4 + 16, 0x0b0814).setStrokeStyle(2, 0x5ce5f1);
        this.scoreText = this.text(GAME_WIDTH - 160, 216, '', 22, '#ffffff');
        this.board = this.add.graphics();

        // Botões de toque (e de mouse): o celular não tem teclado.
        const buttons: [string, number, number, () => void][] = [
            ['<', 110, 380, () => this.act(() => this.puzzle.move(-1))],
            ['>', 210, 380, () => this.act(() => this.puzzle.move(1))],
            ['GIRAR', 160, 300, () => this.act(() => this.puzzle.rotate())],
            ['DESCER', GAME_WIDTH - 210, 380, () => this.act(() => this.puzzle.step())],
            ['SOLTAR', GAME_WIDTH - 110, 380, () => this.act(() => this.puzzle.drop())],
            ['SAIR', GAME_WIDTH - 160, 460, () => this.finish(false)]
        ];
        for (const [label, x, y, action] of buttons) {
            const button = this.add.rectangle(x, y, label.length > 1 ? 88 : 64, 52, 0x17151f)
                .setStrokeStyle(2, 0x5ce5f1)
                .setInteractive({ useHandCursor: true });
            button.on('pointerdown', action);
            this.text(x, y, label, label.length > 1 ? 16 : 30, '#ffffff');
        }

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (!this.started) {
                const introActions: Record<string, () => void> = {
                    ArrowUp: () => this.selectIntro(0),
                    KeyW: () => this.selectIntro(0),
                    ArrowDown: () => this.selectIntro(1),
                    KeyS: () => this.selectIntro(1),
                    Enter: () => this.chooseIntro(),
                    Space: () => this.chooseIntro(),
                    Escape: () => this.leaveIntro()
                };
                introActions[event.code]?.();
                return;
            }
            const actions: Record<string, () => void> = {
                ArrowLeft: () => this.act(() => this.puzzle.move(-1)),
                KeyA: () => this.act(() => this.puzzle.move(-1)),
                ArrowRight: () => this.act(() => this.puzzle.move(1)),
                KeyD: () => this.act(() => this.puzzle.move(1)),
                ArrowUp: () => this.act(() => this.puzzle.rotate()),
                KeyW: () => this.act(() => this.puzzle.rotate()),
                ArrowDown: () => this.act(() => this.puzzle.step()),
                KeyS: () => this.act(() => this.puzzle.step()),
                Space: () => this.act(() => this.puzzle.drop()),
                Escape: () => this.finish(false)
            };
            actions[event.code]?.();
        });
        bindGamepadActions(this, {
            left: () => this.act(() => this.puzzle.move(-1)),
            right: () => this.act(() => this.puzzle.move(1)),
            up: () => this.started ? this.act(() => this.puzzle.drop()) : this.selectIntro(0),
            down: () => this.started ? this.act(() => this.puzzle.step()) : this.selectIntro(1),
            confirm: () => this.started ? this.act(() => this.puzzle.rotate()) : this.chooseIntro(),
            cancel: () => this.started ? this.finish(false) : this.leaveIntro()
        });
        this.draw();
        this.showIntro();
    }

    /** Tela de como jogar: controles à esquerda, INICIAR e SAIR à direita. */
    private showIntro() {
        // Fundo interativo para os botões do jogo por baixo não receberem o toque.
        const background = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x05040a).setOrigin(0).setInteractive();
        const panel = this.add.rectangle(270, 270, 460, 330, 0x0b0814).setStrokeStyle(3, 0xf056c5);
        const objects: Phaser.GameObjects.GameObject[] = [
            background,
            panel,
            this.text(GAME_WIDTH / 2, 50, 'CAIXOTES', 30, '#f056c5'),
            this.text(270, 132, 'COMO JOGAR', 22, '#5ce5f1'),
            this.text(330, 172, 'TECLADO', 14, '#aaa5b8'),
            this.text(450, 172, 'CONTROLE', 14, '#aaa5b8')
        ];
        CONTROLS.forEach(([action, keyboard, gamepad], index) => {
            const y = 208 + index * 36;
            objects.push(
                this.text(140, y, action, 18, '#ffd25a'),
                this.text(330, y, keyboard, 18, '#ffffff'),
                this.text(450, y, gamepad, 18, '#ffffff')
            );
        });
        const { goalScore, rewardHearts } = MERCADO_INTERIOR.arcade;
        objects.push(this.text(270, 400, `FAÇA ${goalScore} PONTOS E GANHE ${rewardHearts} CORAÇÕES`, 14, '#6fd36f'));

        this.introButtons = (['INICIAR', 'SAIR'] as const).map((label, index) => {
            const button = this.add.rectangle(GAME_WIDTH - 180, 230 + index * 80, 220, 56, 0x17151f)
                .setInteractive({ useHandCursor: true });
            button.on('pointerover', () => this.selectIntro(index));
            button.on('pointerdown', () => {
                this.selectIntro(index);
                this.chooseIntro();
            });
            objects.push(button, this.text(GAME_WIDTH - 180, 230 + index * 80, label, 22, '#ffffff'));
            return button;
        });
        this.intro = this.add.container(0, 0, objects);
        this.selectIntro(0);
    }

    private selectIntro(index: number) {
        if (this.started || this.finished) return;
        this.introChoice = index;
        this.introButtons.forEach((button, buttonIndex) => {
            const selected = buttonIndex === index;
            button.setFillStyle(selected ? 0x2a1640 : 0x17151f).setStrokeStyle(selected ? 3 : 2, selected ? 0xf056c5 : 0x5ce5f1);
        });
    }

    private chooseIntro() {
        if (this.introChoice === 0) this.startGame();
        else this.leaveIntro();
    }

    private startGame() {
        if (this.started || this.finished) return;
        this.started = true;
        this.elapsed = 0;
        this.intro?.destroy();
        this.intro = undefined;
    }

    /** Sair antes de jogar não gasta a tentativa. */
    private leaveIntro() {
        if (this.started || this.finished) return;
        this.finished = true;
        this.scene.stop();
        this.onFinish(false, false);
    }

    update(_time: number, delta: number) {
        if (this.finished || !this.started) return;
        this.repeatHeldDirections(delta);
        this.elapsed += delta;
        if (this.elapsed < MERCADO_INTERIOR.arcade.dropInterval) return;
        this.elapsed = 0;
        this.act(() => this.puzzle.step());
    }

    /** O primeiro toque já age pelo `bindGamepadActions`; segurando, repete depois de um instante. */
    private repeatHeldDirections(delta: number) {
        const gamepad = getGamepadInput(this);
        for (const action of HELD_ACTIONS) {
            if (!gamepad.isDown(action)) {
                this.heldFor.delete(action);
                continue;
            }
            const held = (this.heldFor.get(action) ?? 0) + delta;
            this.heldFor.set(action, held);
            if (held < HOLD_DELAY) continue;
            this.heldFor.set(action, HOLD_DELAY - HOLD_REPEAT);
            if (action === 'down') this.act(() => this.puzzle.step());
            else this.act(() => this.puzzle.move(action === 'left' ? -1 : 1));
        }
    }

    private act(action: () => unknown) {
        if (this.finished || !this.started) return;
        action();
        this.draw();
        if (this.puzzle.score >= MERCADO_INTERIOR.arcade.goalScore) this.finish(true);
        else if (this.puzzle.isOver) this.finish(false);
    }

    private finish(won: boolean) {
        if (this.finished) return;
        this.finished = true;
        // A fonte não tem o sinal de mais.
        const message = won ? `GANHOU ${MERCADO_INTERIOR.arcade.rewardHearts} CORAÇÕES!`
            : this.attemptsLeft > 0 ? 'FIM DE JOGO\nAFASTE-SE E VOLTE AO FLIPER\nPARA A ÚLTIMA TENTATIVA'
                : 'FIM DE JOGO\nSEM TENTATIVAS';
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 420, 130, 0x05040a, 0.92).setStrokeStyle(3, won ? 0x6fd36f : 0xe84a4a);
        this.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, message, won ? 30 : 20, won ? '#6fd36f' : '#e84a4a');
        this.time.delayedCall(RESULT_DURATION, () => {
            this.scene.stop();
            this.onFinish(won, true);
        });
    }

    private draw() {
        const { width, height, goalScore } = MERCADO_INTERIOR.arcade;
        const g = this.board.clear();
        g.fillStyle(0x0b0814).fillRect(this.boardX, this.boardY, width * CELL, height * CELL);
        g.lineStyle(1, 0x1d1730);
        for (let x = 1; x < width; x += 1) g.lineBetween(this.boardX + x * CELL, this.boardY, this.boardX + x * CELL, this.boardY + height * CELL);
        this.puzzle.board.forEach((row, y) => row.forEach((color, x) => {
            if (color) this.drawCrate(this.boardX + x * CELL, this.boardY + y * CELL, CELL, color);
        }));
        for (const { x, y, color } of this.puzzle.falling) {
            if (y >= 0) this.drawCrate(this.boardX + x * CELL, this.boardY + y * CELL, CELL, color);
        }
        // Prévia centrada na caixa da próxima peça.
        const next = this.puzzle.next;
        const xs = next.cells.map(({ x }) => x);
        const ys = next.cells.map(({ y }) => y);
        const originX = GAME_WIDTH - 160 - (Math.min(...xs) + Math.max(...xs) + 1) * PREVIEW_CELL / 2;
        const originY = 136 - (Math.min(...ys) + Math.max(...ys) + 1) * PREVIEW_CELL / 2;
        for (const { x, y } of next.cells) {
            this.drawCrate(originX + x * PREVIEW_CELL, originY + y * PREVIEW_CELL, PREVIEW_CELL, next.color);
        }
        this.scoreText.setText(`PONTOS\n${this.puzzle.score} / ${goalScore}`);
    }

    /** Caixote de feira: tábua clara em cima, frestas escuras e contorno. */
    private drawCrate(px: number, py: number, size: number, color: number) {
        const g = this.board;
        g.fillStyle(0x1a1a1a).fillRect(px, py, size, size);
        g.fillStyle(CRATE_COLORS[(color - 1) % CRATE_COLORS.length]).fillRect(px + 2, py + 2, size - 4, size - 4);
        g.fillStyle(0xffffff, 0.35).fillRect(px + 2, py + 2, size - 4, 3);
        g.fillStyle(0x000000, 0.3).fillRect(px + 2, py + size / 2 - 1, size - 4, 2);
    }

    private text(x: number, y: number, value: string, size: number, color: string) {
        return this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center' })
            .setOrigin(0.5)
            .setResolution(2);
    }
}
