import { Scene } from 'phaser';
import { CleanOverlayMenu } from './CleanOverlayMenu';

type DefeatViewOptions = {
    onRestart: () => void;
    onQuit: () => void;
};

const PANEL = { x: 234, y: 118, width: 421, height: 270 };

/** Compatibilidade para fluxos que exibem uma derrota sem estatísticas da run. */
export class DefeatView {
    constructor(
        private readonly scene: Scene,
        private readonly options: DefeatViewOptions
    ) {}

    create() {
        const menu = new CleanOverlayMenu(this.scene, {
            bounds: PANEL,
            dimAlpha: 0.72
        });
        menu.addTitle('VOCE FOI DERROTADO', 166, 'defeat', 'danger');
        menu.addButton('TENTAR NOVAMENTE', 237, this.options.onRestart, {
            width: 330,
            height: 42,
            fontSize: '20px',
            tone: 'danger'
        });
        menu.addButton('VOLTAR AO MENU', 292, this.options.onQuit, {
            width: 330,
            height: 42,
            fontSize: '20px'
        });
        menu.addControlHints([
            { key: 'ENTER', label: 'SELECIONAR' },
            { key: 'ESC', label: 'VOLTAR' }
        ], 360);
        menu.enableKeyboardNavigation({ onCancel: this.options.onQuit });
        menu.fadeIn();
    }
}
