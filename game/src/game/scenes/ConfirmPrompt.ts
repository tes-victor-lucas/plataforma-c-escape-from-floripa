import { Scene } from 'phaser';
import { CleanOverlayMenu } from '../ui/CleanOverlayMenu';

export type ConfirmPromptData = {
    title: string;
    hint?: string;
    onChoice: (confirmed: boolean) => void;
};

/** Pergunta SIM/NÃO por cima do mundo; fechar a cena leva junto os listeners do menu. */
export class ConfirmPrompt extends Scene {
    constructor() {
        super('ConfirmPrompt');
    }

    create({ title, hint, onChoice }: ConfirmPromptData) {
        const menu = new CleanOverlayMenu(this, { bounds: { x: 234, y: 150, width: 421, height: 220 }, dimAlpha: 0.55 });
        const titleText = menu.addTitle(title, 214, 'pause');
        // Títulos longos não cabem no tamanho padrão do painel.
        if (title.length > 16) titleText.setFontSize('22px');
        if (hint) menu.addHint(hint, 246);
        const choose = (confirmed: boolean) => () => {
            this.scene.stop();
            onChoice(confirmed);
        };
        menu.addButton('SIM', 286, choose(true), { width: 240, height: 40, tone: 'success' });
        menu.addButton('NÃO', 336, choose(false), { width: 240, height: 40 });
        menu.enableKeyboardNavigation({ onCancel: choose(false) });
        menu.fadeIn();
    }
}
