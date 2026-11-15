import { Scene } from 'phaser';
import { PauseMenuView } from '../ui/PauseMenuView';
import { InventoryMenuView, type InventoryData } from '../ui/InventoryMenuView';
import type { UpgradeProgress } from '../upgrades';
import { bindGamepadActions } from '../input/GamepadInput';

export type PauseMenuData = {
    upgrades?: UpgradeProgress;
    inventory?: InventoryData;
    /** A pausa abre direto no inventário pela tecla I. */
    view?: 'pause' | 'inventory';
    /** Item selecionado no inventário, mantido ao equipar ou retirar. */
    selectedItem?: number;
};

/** Overlay scene that pauses Room 1 without destroying its state. */
export class PauseMenu extends Scene {
    private isLeaving = false;

    constructor() {
        super('PauseMenu');
    }

    create(data: PauseMenuData = {}) {
        this.isLeaving = false;
        const upgrades = data.upgrades ?? [];
        const showInventory = data.view === 'inventory' && !!data.inventory;
        if (showInventory && data.inventory) {
            const inventory = data.inventory;
            new InventoryMenuView(this, {
                ...inventory,
                upgrades,
                selectedItem: data.selectedItem,
                onBack: () => this.scene.restart({ ...data, view: 'pause', selectedItem: undefined }),
                // O mundo aplica a troca e devolve o inventário atualizado para redesenhar.
                onToggle: (id, index) => this.scene.restart({
                    ...data,
                    inventory: inventory.onToggleItem?.(id) ?? inventory,
                    selectedItem: index
                })
            }).create();
        } else {
            new PauseMenuView(this, {
                onContinue: () => this.continueGame(),
                onQuit: () => this.quitToMainMenu(),
                onInventory: data.inventory ? () => this.scene.restart({ ...data, view: 'inventory' }) : undefined,
                upgrades
            }).create();
        }

        // I alterna entre o jogo e o inventário; P sempre volta ao jogo.
        const toggleInventory = () => {
            if (showInventory || !data.inventory) this.continueGame();
            else this.scene.restart({ ...data, view: 'inventory' });
        };
        const keyboard = this.input.keyboard;
        keyboard?.once('keydown-P', this.continueGame, this);
        keyboard?.once('keydown-I', toggleInventory);
        this.events.once('shutdown', () => {
            keyboard?.off('keydown-P', this.continueGame, this);
            keyboard?.off('keydown-I', toggleInventory);
        });
        bindGamepadActions(this, { pause: () => this.continueGame() });
    }

    private continueGame() {
        if (this.isLeaving) return;

        this.scene.resume('World');
        this.scene.stop();
    }

    private quitToMainMenu() {
        if (this.isLeaving) return;

        this.isLeaving = true;
        this.scene.launch('ReturnToMenuTransition');
        this.scene.bringToTop('ReturnToMenuTransition');
    }
}
