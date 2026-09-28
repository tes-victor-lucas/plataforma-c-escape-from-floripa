import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import type { Player } from '../entities/Player';

type HudData = { player: Player; onRestart: () => void; onQuit: () => void };

/** Interface em uma câmera própria, independente do zoom e da posição do mapa. */
export class CombatHud extends Scene {
    private dataSource: HudData;
    private bar: Phaser.GameObjects.Graphics;
    private label: Phaser.GameObjects.Text;
    private defeated = false;

    constructor() {
        super('CombatHud');
    }

    create(data: HudData) {
        this.dataSource = data;
        this.defeated = false;
        this.add.rectangle(16, 16, 240, 58, 0x00171b, 0.92).setOrigin(0).setStrokeStyle(2, 0x008fa5);
        this.bar = this.add.graphics();
        this.label = this.add.text(28, 26, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f7f7f7' });
        this.update();
    }

    update() {
        const { player } = this.dataSource;
        const { current, max } = player.health;
        this.bar.clear().fillStyle(0x173940).fillRect(28, 50, 216, 12);
        this.bar.fillStyle(current > max * 0.3 ? 0x5ce5a0 : 0xff5050).fillRect(28, 50, 216 * current / max, 12);
        this.label.setText(`VIDA  ${current} / ${max}`);
        if (!player.health.isAlive && !this.defeated) {
            this.defeated = true;
            this.showDefeat();
        }
    }

    private showDefeat() {
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 250, 0x00171b).setStrokeStyle(3, 0x008fa5);
        this.add.text(GAME_WIDTH / 2, 178, 'Você foi derrotado', {
            fontFamily: 'PixelGamer, monospace', fontSize: '36px', color: '#ff6060'
        }).setOrigin(0.5);
        this.createButton('Tentar novamente', 260, this.dataSource.onRestart);
        this.createButton('Voltar ao menu', 324, this.dataSource.onQuit);
    }

    private createButton(label: string, y: number, action: () => void) {
        const button = this.add.text(GAME_WIDTH / 2, y, label, {
            fontFamily: 'PixelGamer, monospace', fontSize: '24px', color: '#f7f7f7',
            backgroundColor: '#002b33', padding: { x: 22, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        button.on('pointerover', () => button.setColor('#5ce5f1'));
        button.on('pointerout', () => button.setColor('#f7f7f7'));
        button.once('pointerup', action);
    }
}
