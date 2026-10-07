import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';

type MainMenuViewOptions = {
    onNewGame: () => void;
    onMultiplayer: () => void;
};

const ACTION_FONT = 'PixelGamer, monospace';
const ACTION_FONT_SIZE = '18px';
const ACTION_COLOR = '#0074df';
const SELECTED_ACTION_COLOR = '#00162e';
const SELECTED_BACKGROUND_COLOR = 0xe90931;
const ACTION_WIDTH = 165;
const ACTION_HEIGHT = 27;
const ACTION_HIT_AREA_WIDTH = 190;
const ACTION_HIT_AREA_HEIGHT = 30;

type MenuAction = {
    label: string;
    y: number;
    onSelect?: () => void;
};

type RenderedAction = {
    background: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
};

/** Renders the menu artwork and actions independently from navigation. */
export class MainMenuView {
    private selectedAction = 0;
    private readonly renderedActions: RenderedAction[] = [];
    private statusText?: Phaser.GameObjects.Text;

    constructor(
        private readonly scene: Scene,
        private readonly options: MainMenuViewOptions
    ) {}

    create() {
        this.scene.add
            .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'menu-background')
            .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
            .setScrollFactor(0);

        this.addActions();
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

    private addActions() {
        const actions: MenuAction[] = [
            { label: 'JOGAR SOLO', y: 225, onSelect: this.options.onNewGame },
            { label: 'MULTIPLAYER', y: 255, onSelect: this.options.onMultiplayer },
            { label: 'OPÇÕES', y: 285 },
            { label: 'SAIR', y: 315 }
        ];

        actions.forEach((action, index) => this.createAction(action, index));
        this.updateSelection();
        this.addKeyboardNavigation(actions);
    }

    private createAction(action: MenuAction, index: number) {
        const background = this.scene.add
            .rectangle(
                GAME_WIDTH / 2,
                action.y,
                ACTION_WIDTH,
                ACTION_HEIGHT,
                SELECTED_BACKGROUND_COLOR
            )
            .setScrollFactor(0);

        const label = this.scene.add
            .text(GAME_WIDTH / 2, action.y, action.label, {
                color: ACTION_COLOR,
                fontFamily: ACTION_FONT,
                fontSize: ACTION_FONT_SIZE
            })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setResolution(2);

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
            .setInteractive({ useHandCursor: Boolean(action.onSelect) });

        hitArea.on('pointerover', () => {
            this.selectedAction = index;
            this.updateSelection();
        });

        if (action.onSelect) {
            hitArea.on('pointerup', action.onSelect);
        }

        this.renderedActions.push({ background, label });
    }

    private addKeyboardNavigation(actions: MenuAction[]) {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        const selectPrevious = () => this.moveSelection(-1);
        const selectNext = () => this.moveSelection(1);
        const confirmSelection = () => actions[this.selectedAction].onSelect?.();

        keyboard.on('keydown-UP', selectPrevious);
        keyboard.on('keydown-W', selectPrevious);
        keyboard.on('keydown-DOWN', selectNext);
        keyboard.on('keydown-S', selectNext);
        keyboard.on('keydown-ENTER', confirmSelection);
        keyboard.on('keydown-SPACE', confirmSelection);

        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            keyboard.off('keydown-UP', selectPrevious);
            keyboard.off('keydown-W', selectPrevious);
            keyboard.off('keydown-DOWN', selectNext);
            keyboard.off('keydown-S', selectNext);
            keyboard.off('keydown-ENTER', confirmSelection);
            keyboard.off('keydown-SPACE', confirmSelection);
        });
    }

    private moveSelection(direction: number) {
        const actionCount = this.renderedActions.length;
        this.selectedAction = (this.selectedAction + direction + actionCount) % actionCount;
        this.updateSelection();
    }

    private updateSelection() {
        this.renderedActions.forEach(({ background, label }, index) => {
            const isSelected = index === this.selectedAction;
            background.setVisible(isSelected);
            label.setColor(isSelected ? SELECTED_ACTION_COLOR : ACTION_COLOR);
        });
    }
}
