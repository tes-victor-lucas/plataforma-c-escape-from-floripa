import { Scene } from 'phaser';
import { PauseMenuView } from '../ui/PauseMenuView';
import { ResourcesMenuView, type ResourcesData } from '../ui/ResourcesMenuView';
import type { UpgradeProgress } from '../upgrades';
import { bindGamepadActions } from '../input/GamepadInput';

export type PauseMenuData = {
    upgrades?: UpgradeProgress;
    resources?: ResourcesData;
    /** A pausa abre direto nos recursos pela tecla I. */
    view?: 'pause' | 'resources';
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
        const showResources = data.view === 'resources' && !!data.resources;
        if (showResources && data.resources) {
            new ResourcesMenuView(this, {
                ...data.resources,
                upgrades,
                onBack: () => this.scene.restart({ ...data, view: 'pause' })
            }).create();
        } else {
            new PauseMenuView(this, {
                onContinue: () => this.continueGame(),
                onQuit: () => this.quitToMainMenu(),
                onResources: data.resources ? () => this.scene.restart({ ...data, view: 'resources' }) : undefined,
                upgrades
            }).create();
        }

        // I alterna entre o jogo e os recursos; P sempre volta ao jogo.
        const toggleResources = () => {
            if (showResources || !data.resources) this.continueGame();
            else this.scene.restart({ ...data, view: 'resources' });
        };
        const keyboard = this.input.keyboard;
        keyboard?.once('keydown-P', this.continueGame, this);
        keyboard?.once('keydown-I', toggleResources);
        this.events.once('shutdown', () => {
            keyboard?.off('keydown-P', this.continueGame, this);
            keyboard?.off('keydown-I', toggleResources);
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
