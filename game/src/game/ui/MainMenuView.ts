import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { MENU_CONFIG } from '../config/menu';

export type MainMenuViewOptions = {
    onNewGame: () => void;
    onContinue?: () => void;
    onMultiplayer?: () => void;
    onLeaderboard?: () => void;
};

const ACTION_FONT = 'PixelGamer, monospace';
const ACTION_FONT_SIZE = '18px';
const ACTION_COLOR = '#0074df';
const DISABLED_ACTION_COLOR = '#6c7580';
const SELECTED_ACTION_COLOR = '#ffffff';
const SELECTED_MARKER_COLOR = 0xe90931;
const MARKER_GAP = 8;
const ACTION_HIT_AREA_WIDTH = 190;
const ACTION_HIT_AREA_HEIGHT = 30;

type MenuAction = {
    label: string;
    y: number;
    onSelect?: () => void;
    enabled?: boolean;
};

function positionActions(actions: Omit<MenuAction, 'y'>[]): MenuAction[] {
    const spacing = 25;
    const centerY = 264;
    const firstY = centerY - (actions.length - 1) * spacing / 2;
    return actions.map((action, index) => ({ ...action, y: firstY + index * spacing }));
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
        this.scene.add
            .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, MENU_CONFIG.background.texture)
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setScrollFactor(0);
        this.scene.add
            .image(MENU_CONFIG.title.x, MENU_CONFIG.title.y, MENU_CONFIG.title.texture)
            .setScale(MENU_CONFIG.title.scale)
            .setScrollFactor(0);

        this.showMainMenu();
        this.addKeyboardNavigation();
        this.statusText = this.scene.add.text(GAME_WIDTH / 2, 340, '', {
            color: '#ffffff',
            fontFamily: ACTION_FONT,
            fontSize: '12px',
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setResolution(2);
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
            .text(GAME_WIDTH / 2, action.y, action.label, {
                color: action.enabled === false ? DISABLED_ACTION_COLOR : ACTION_COLOR,
                fontFamily: ACTION_FONT,
                fontSize: ACTION_FONT_SIZE
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
                GAME_WIDTH / 2,
                action.y,
                ACTION_HIT_AREA_WIDTH,
                ACTION_HIT_AREA_HEIGHT,
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

        this.renderedActions.push({ marker, label, hitArea });
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
        this.renderedActions.forEach(({ marker, label }, index) => {
            const action = this.currentActions[index];
            const isEnabled = action.enabled !== false;
            const isSelected = isEnabled && index === this.selectedAction;
            marker.setVisible(isSelected);
            label.setColor(
                isSelected
                    ? SELECTED_ACTION_COLOR
                    : isEnabled ? ACTION_COLOR : DISABLED_ACTION_COLOR
            );
        });
    }
}
