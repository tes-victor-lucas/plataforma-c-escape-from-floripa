import type { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';

export type BossHealth = Readonly<{ title: string; current: number; max: number }>;

const WIDTH = 340;
const Y = 66;

/** Barra de vida do chefe no topo da tela, logo abaixo do cronômetro; some sem chefe. */
export class BossHealthView {
    private readonly title: Phaser.GameObjects.Text;
    private readonly bar: Phaser.GameObjects.Graphics;

    constructor(scene: Scene) {
        this.title = scene.add.text(GAME_WIDTH / 2, Y - 4, '', {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '18px',
            color: '#ffb347',
            stroke: '#06263d',
            strokeThickness: 4
        }).setOrigin(0.5, 1).setDepth(110).setResolution(2);
        this.bar = scene.add.graphics().setDepth(110);
    }

    update(boss: BossHealth | undefined) {
        this.title.setVisible(!!boss);
        this.bar.clear();
        if (!boss) return;
        this.title.setText(boss.title);
        const x = (GAME_WIDTH - WIDTH) / 2;
        const fill = Math.max(0, boss.current / boss.max) * (WIDTH - 4);
        this.bar.fillStyle(0x06263d).fillRect(x - 2, Y - 2, WIDTH + 4, 14);
        this.bar.fillStyle(0x2a1208).fillRect(x, Y, WIDTH, 10);
        this.bar.fillStyle(0xf29b38).fillRect(x + 2, Y + 2, fill, 6);
        // Brilho ciano do núcleo na ponta da vida que resta.
        this.bar.fillStyle(0x6ee2ff).fillRect(x + 2 + fill - 2, Y + 2, Math.min(2, fill), 6);
    }
}
