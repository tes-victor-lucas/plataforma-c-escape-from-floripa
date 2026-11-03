import { Scene } from 'phaser';
import { CleanOverlayMenu } from './CleanOverlayMenu';

type PauseMenuViewOptions = {
    onContinue: () => void;
    onQuit: () => void;
};

const PANEL = { x: 244, y: 118, width: 401, height: 270 };

/** Overlay enxuto exibido enquanto a sala está pausada. */
export class PauseMenuView {
    constructor(
        private readonly scene: Scene,
        private readonly options: PauseMenuViewOptions
    ) {}

    create() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: PANEL,
            dimAlpha: 0.68
        });
        menu.addTitle('JOGO PAUSADO', 166, 'pause');
        menu.addButton('CONTINUAR', 237, this.options.onContinue, {
            width: 320,
            height: 42,
            fontSize: '22px'
        });
        menu.addButton('VOLTAR AO MENU', 292, this.options.onQuit, {
            width: 320,
            height: 42,
            fontSize: '20px'
        });
        menu.addControlHints([
            { key: 'P', label: 'CONTINUAR' },
            { key: 'ENTER', label: 'SELECIONAR' }
        ], 360);
        menu.enableKeyboardNavigation({ onCancel: this.options.onContinue });
        menu.fadeIn();
    }
}
