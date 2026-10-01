import { Scene } from 'phaser';
import { GAME_WIDTH } from '../config/display';
import { HUD_CONFIG } from '../config/hud';

const BUTTON_SIZE = HUD_CONFIG.controls.size;
const BUTTON_MARGIN = 8;
const BUTTON_Y = BUTTON_MARGIN + BUTTON_SIZE / 2;

/** Small HUD control that opens the pause menu without leaving fullscreen. */
export class PauseButtonView {
    constructor(
        private readonly scene: Scene,
        private readonly onPause: () => void
    ) {}

    create() {
        const x = GAME_WIDTH - BUTTON_MARGIN - BUTTON_SIZE / 2;
        const icon = this.scene.add
            .image(x, BUTTON_Y, HUD_CONFIG.controls.pauseTexture)
            .setDepth(101);
        const iconScale = BUTTON_SIZE / Math.max(icon.width, icon.height);
        icon.setScale(iconScale);
        const hitArea = this.scene.add
            .rectangle(x, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE, 0x000000, 0)
            .setDepth(102)
            .setInteractive({ useHandCursor: true });

        hitArea.on('pointerover', () =>
            icon.setScale(iconScale * 1.07));
        hitArea.on('pointerout', () =>
            icon.setScale(iconScale));
        hitArea.on('pointerup', this.onPause);

        return this.scene.add.container(0, 0, [icon, hitArea]);
    }
}
