import type { Scene } from 'phaser';

const BAR_WIDTH = 76;
const BAR_HEIGHT = 7;

/** Indicador compacto que enche até o dash ficar disponível novamente. */
export class DashCooldownView {
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly label: Phaser.GameObjects.Text;
    private previousCharge = -1;

    constructor(
        scene: Scene,
        private readonly x: number,
        private readonly y: number
    ) {
        this.graphics = scene.add.graphics().setDepth(110).setScrollFactor(0);
        this.label = scene.add.text(x, y, 'DASH  [SPACE / BTN 2 / R]', {
            fontFamily: 'Pixeboy, monospace',
            fontSize: '17px',
            color: '#91a5ad'
        }).setOrigin(0, 0).setDepth(110).setScrollFactor(0).setResolution(2);
    }

    update(charge: number) {
        const normalizedCharge = Math.max(0, Math.min(1, charge));
        if (Math.abs(normalizedCharge - this.previousCharge) < 0.002) return;
        this.previousCharge = normalizedCharge;

        const isReady = normalizedCharge >= 0.999;
        const barY = this.y + 20;
        this.label.setColor(isReady ? '#5ce5f1' : '#91a5ad');
        this.graphics.clear();
        this.graphics.fillStyle(0x061821, 0.9).fillRoundedRect(
            this.x,
            barY,
            BAR_WIDTH,
            BAR_HEIGHT,
            2
        );
        this.graphics.fillStyle(isReady ? 0x5ce5f1 : 0x5d8390, 1).fillRoundedRect(
            this.x + 1,
            barY + 1,
            (BAR_WIDTH - 2) * normalizedCharge,
            BAR_HEIGHT - 2,
            1
        );
        this.graphics.lineStyle(1, isReady ? 0x9ff6fb : 0x31515d, 0.9).strokeRoundedRect(
            this.x,
            barY,
            BAR_WIDTH,
            BAR_HEIGHT,
            2
        );
    }
}
