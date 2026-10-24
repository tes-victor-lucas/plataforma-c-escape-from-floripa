import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { getMenuLayout, MENU_CONFIG } from '../config/menu';

const MENU_LAYOUT = getMenuLayout();

export type MainMenuViewOptions = {
    onNewGame: () => void;
    onContinue?: () => void;
    onMultiplayer?: () => void;
    onLeaderboard?: () => void;
};

const ACTION_FONT = 'PixelGamer, monospace';
const ACTION_FONT_SIZE = '18px';
const { color: ACTION_COLOR, disabledColor: DISABLED_ACTION_COLOR, spacing: ACTION_SPACING } = MENU_LAYOUT.actions;
const SELECTED_ACTION_COLOR = '#ffffff';
const SELECTED_MARKER_COLOR = 0xe90931;
const MARKER_GAP = 8;
const ACTION_HIT_AREA_WIDTH = 190;

type MenuAction = {
    label: string;
    y: number;
    onSelect?: () => void;
    enabled?: boolean;
};

function positionActions(actions: Omit<MenuAction, 'y'>[]): MenuAction[] {
    const centerY = 264;
    const firstY = centerY - (actions.length - 1) * ACTION_SPACING / 2;
    return actions.map((action, index) => ({ ...action, y: firstY + index * ACTION_SPACING }));
}

export function createMainMenuActions(
    onPlay: () => void,
    onLeaderboard?: () => void
): MenuAction[] {
    const actions: Omit<MenuAction, 'y'>[] = [{ label: 'JOGAR', onSelect: onPlay }];
    if (onLeaderboard) actions.push({ label: 'PLACAR', onSelect: onLeaderboard });
    actions.push({ label: 'OPÇÕES' }, { label: 'SAIR' });
    return positionActions(actions);
}

export function createPlayMenuActions(
    options: MainMenuViewOptions,
    onBack: () => void
): MenuAction[] {
    const actions: Omit<MenuAction, 'y'>[] = [{
        label: 'CONTINUAR',
        onSelect: options.onContinue,
        enabled: Boolean(options.onContinue)
    }, {
        label: 'JOGAR SOLO',
        onSelect: options.onNewGame
    }];
    if (options.onMultiplayer) actions.push({ label: 'MULTIPLAYER', onSelect: options.onMultiplayer });
    actions.push({ label: 'VOLTAR', onSelect: onBack });
    return positionActions(actions);
}

type RenderedAction = {
    marker: Phaser.GameObjects.Graphics;
    markerX: number;
    label: Phaser.GameObjects.Text;
    hitArea: Phaser.GameObjects.Rectangle;
};

/** Renders the menu artwork and actions independently from navigation. */
export class MainMenuView {
    private selectedAction = 0;
    private currentActions: MenuAction[] = [];
    private readonly renderedActions: RenderedAction[] = [];
    private statusText?: Phaser.GameObjects.Text;
    private isPlayMenuOpen = false;

    constructor(
        private readonly scene: Scene,
        private readonly options: MainMenuViewOptions
    ) {}

    create() {
        this.createBackgrounds();
        this.scene.add
            .image(MENU_LAYOUT.titleX, MENU_LAYOUT.titleY, MENU_LAYOUT.title.texture)
            .setOrigin(MENU_LAYOUT.titleOriginX, 0.5)
            .setScale(MENU_LAYOUT.title.scale)
            .setScrollFactor(0);

        this.showMainMenu();
        this.addKeyboardNavigation();
        this.statusText = this.scene.add.text(MENU_LAYOUT.menuX, 340, '', {
            color: '#ffffff',
            fontFamily: ACTION_FONT,
            fontSize: '12px',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setResolution(2);
    }

    /** Alterna em crossfade os fundos do layout ativo. */
    private createBackgrounds() {
        const backgrounds = MENU_LAYOUT.backgrounds.map(({ texture }, index) => this.scene.add
            .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, texture)
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setScrollFactor(0)
            .setAlpha(index === 0 ? 1 : 0));
        if (backgrounds.length < 2) return;
        let current = 0;
        this.scene.time.addEvent({
            delay: MENU_CONFIG.backgroundHoldMs,
            loop: true,
            callback: () => {
                const previous = backgrounds[current];
                current = (current + 1) % backgrounds.length;
                const next = backgrounds[current];
                // O próximo fundo sobe para o topo da pilha e aparece sobre o anterior.
                this.scene.children.moveAbove(next, previous);
                next.setAlpha(0);
                this.scene.tweens.add({
                    targets: next,
                    alpha: 1,
                    duration: MENU_CONFIG.backgroundFadeMs,
                    ease: 'Sine.InOut',
                    onComplete: () => previous.setAlpha(0)
                });
            }
        });
    }

    setStatus(status: string) {
        this.statusText?.setText(status);
    }

    private showMainMenu() {
        this.isPlayMenuOpen = false;
        this.renderActions(createMainMenuActions(
            () => this.showPlayMenu(),
            this.options.onLeaderboard
        ));
    }

    private showPlayMenu() {
        this.isPlayMenuOpen = true;
        this.renderActions(createPlayMenuActions(this.options, () => this.showMainMenu()));
    }

    private renderActions(actions: MenuAction[]) {
        this.renderedActions.forEach(({ marker, label, hitArea }) => {
            this.scene.tweens.killTweensOf(marker);
            marker.destroy();
            label.destroy();
            hitArea.destroy();
        });
        this.renderedActions.length = 0;
        this.currentActions = actions;
        this.selectedAction = Math.max(0, actions.findIndex((action) => action.enabled !== false));
        actions.forEach((action, index) => this.createAction(action, index));
        this.updateSelection();
    }

    private createAction(action: MenuAction, index: number) {
        const label = this.scene.add
            .text(MENU_LAYOUT.menuX, action.y, action.label, {
                color: action.enabled === false ? DISABLED_ACTION_COLOR : ACTION_COLOR,
                fontFamily: ACTION_FONT,
                fontSize: ACTION_FONT_SIZE,
                shadow: MENU_LAYOUT.actions.shadow
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setResolution(2);

        const markerX = Math.round(label.x - label.width / 2 - MARKER_GAP);
        const marker = this.scene.add.graphics({ x: markerX, y: Math.round(action.y) }).setScrollFactor(0);
        // Seta em degraus de 2px, com a ponta na origem, no mesmo traço pixel art do logo.
        marker.fillStyle(0x000000, 1);
        [10, 8, 6, 4, 2].forEach((height, step) => marker.fillRect(step * 2 - 10, 2 - height / 2, 2, height));
        marker.fillStyle(SELECTED_MARKER_COLOR, 1);
        [10, 8, 6, 4, 2].forEach((height, step) => marker.fillRect(step * 2 - 10, -height / 2, 2, height));

        const hitArea = this.scene.add
            .rectangle(
                MENU_LAYOUT.menuX,
                action.y,
                ACTION_HIT_AREA_WIDTH,
                // Altura igual ao espaçamento, para que itens vizinhos não disputem o mesmo ponteiro.
                ACTION_SPACING,
                0x000000,
                0
            )
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: action.enabled !== false && Boolean(action.onSelect) });

        hitArea.on('pointerover', () => {
            if (action.enabled === false) return;
            this.selectedAction = index;
            this.updateSelection();
        });

        if (action.enabled !== false && action.onSelect) {
            hitArea.on('pointerup', action.onSelect);
        }

        this.renderedActions.push({ marker, markerX, label, hitArea });
    }

    private addKeyboardNavigation() {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        const selectPrevious = () => this.moveSelection(-1);
        const selectNext = () => this.moveSelection(1);
        const confirmSelection = () => this.currentActions[this.selectedAction]?.onSelect?.();
        const goBack = () => {
            if (this.isPlayMenuOpen) this.showMainMenu();
        };

        keyboard.on('keydown-UP', selectPrevious);
        keyboard.on('keydown-W', selectPrevious);
        keyboard.on('keydown-DOWN', selectNext);
        keyboard.on('keydown-S', selectNext);
        keyboard.on('keydown-ENTER', confirmSelection);
        keyboard.on('keydown-SPACE', confirmSelection);
        keyboard.on('keydown-ESC', goBack);

        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard.off('keydown-UP', selectPrevious);
            keyboard.off('keydown-W', selectPrevious);
            keyboard.off('keydown-DOWN', selectNext);
            keyboard.off('keydown-S', selectNext);
            keyboard.off('keydown-ENTER', confirmSelection);
            keyboard.off('keydown-SPACE', confirmSelection);
            keyboard.off('keydown-ESC', goBack);
        });
    }

    private moveSelection(direction: number) {
        const actionCount = this.currentActions.length;
        if (actionCount === 0) return;
        do {
            this.selectedAction = (this.selectedAction + direction + actionCount) % actionCount;
        } while (this.currentActions[this.selectedAction].enabled === false);
        this.updateSelection();
    }

    private updateSelection() {
        this.renderedActions.forEach(({ marker, markerX, label }, index) => {
            const action = this.currentActions[index];
            const isEnabled = action.enabled !== false;
            const isSelected = isEnabled && index === this.selectedAction;
            this.scene.tweens.killTweensOf(marker);
            marker.setVisible(isSelected).setX(markerX);
            if (isSelected && MENU_LAYOUT.actions.markerSlide > 0) {
                this.scene.tweens.add({
                    targets: marker,
                    x: { from: markerX - MENU_LAYOUT.actions.markerSlide, to: markerX },
                    duration: 140,
                    ease: 'Cubic.Out'
                });
            }
            label.setColor(
                isSelected
                    ? SELECTED_ACTION_COLOR
                    : isEnabled ? ACTION_COLOR : DISABLED_ACTION_COLOR
            );
        });
    }
}
