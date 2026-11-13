import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/display';
import { getMenuLayout, MENU_CONFIG } from '../config/menu';
import { bindGamepadActions } from '../input/GamepadInput';
import { isTouchScreen } from '../input/TouchInput';
import { createWalkAnimations, walkAnimationKey } from '../entities/PlayerAnimations';

const MENU_LAYOUT = getMenuLayout();

export type MainMenuViewOptions = {
    onNewGame: () => void;
    onContinue?: () => void;
    onMultiplayer?: () => void;
    onLeaderboard?: () => void;
    /** Rótulo do personagem atual e textura da prévia; sem isso o menu não oferece a troca. */
    character?: () => { label: string; texture: string; scaleMultiplier: number };
    onToggleCharacter?: () => void;
};

const ACTION_FONT = 'PixelGamer, monospace';
const ACTION_FONT_SIZE = '18px';
const { color: ACTION_COLOR, disabledColor: DISABLED_ACTION_COLOR, spacing: ACTION_SPACING } = MENU_LAYOUT.actions;
const SELECTED_ACTION_COLOR = '#ffffff';
const SELECTED_MARKER_COLOR = 0xe90931;
const MARKER_GAP = 8;
const ACTION_HIT_AREA_WIDTH = 190;
// shortcut: mostra só as primeiras salas abertas, trocar por rolagem se o público crescer.
const MAX_LISTED_ROOMS = 4;
const ROOM_NAME_MAX_LENGTH = 20;

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
    actions.push({ label: 'SAIR' });
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
    if (options.character && options.onToggleCharacter) {
        actions.push({ label: `PERSONAGEM: ${options.character().label}`, onSelect: options.onToggleCharacter });
    }
    actions.push({ label: 'VOLTAR', onSelect: onBack });
    return positionActions(actions);
}

export type MultiplayerMenuHandlers = {
    onCreate: () => void;
    onJoin: (roomId: string) => void;
    onBack: () => void;
};

export function createMultiplayerMenuActions(
    rooms: readonly string[],
    { onCreate, onJoin, onBack }: MultiplayerMenuHandlers
): MenuAction[] {
    const listed: Omit<MenuAction, 'y'>[] = rooms.slice(0, MAX_LISTED_ROOMS).map((roomId) => ({
        label: `${roomId.toUpperCase()}   [ ENTRAR ]`,
        onSelect: () => onJoin(roomId)
    }));
    return positionActions([
        { label: 'CRIAR SALA', onSelect: onCreate },
        ...(listed.length > 0 ? listed : [{ label: 'NENHUMA SALA ABERTA', enabled: false }]),
        { label: 'VOLTAR', onSelect: onBack }
    ]);
}

/** Aceita só o que o servidor mantém no nome da sala. */
export function editRoomName(name: string, key: string) {
    if (key === 'Backspace') return name.slice(0, -1);
    return /^[a-z0-9_-]$/i.test(key) && name.length < ROOM_NAME_MAX_LENGTH ? name + key.toLowerCase() : name;
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
    private onEscape?: () => void;
    private characterPreview?: Phaser.GameObjects.Sprite;
    private closeRoomInput?: () => void;

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
        this.statusText = this.scene.add.text(MENU_LAYOUT.menuX, 362, '', {
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

    /** Dois jogadores que digitam o mesmo nome entram na mesma sala. */
    showRoomInput(onConfirm: (roomName: string) => void, onCancel: () => void) {
        this.onEscape = undefined;
        this.renderActions([]);
        this.setStatus('');
        if (isTouchScreen()) {
            // Sem teclado físico, o prompt nativo abre o teclado do celular; a filtragem é a mesma.
            const name = [...(window.prompt('Nome da sala') ?? '')].reduce(editRoomName, '');
            if (name) onConfirm(name);
            else onCancel();
            return;
        }
        const textAt = (y: number, text: string, fontSize: string, color = '#ffffff') => this.scene.add
            .text(MENU_LAYOUT.menuX, y, text, { color, fontFamily: ACTION_FONT, fontSize, shadow: MENU_LAYOUT.actions.shadow })
            .setOrigin(0.5).setScrollFactor(0).setResolution(2);
        let name = '';
        const texts = [
            textAt(226, 'NOME DA SALA', '18px', ACTION_COLOR),
            textAt(258, '_', '24px'),
            textAt(292, 'SEU PARCEIRO VAI VER ESSE NOME NA LISTA', '12px'),
            textAt(310, 'ENTER: ENTRAR   ESC: VOLTAR', '12px')
        ];
        const keyboard = this.scene.input.keyboard;
        const close = () => {
            keyboard?.off('keydown', handleKey);
            texts.forEach((text) => text.destroy());
            this.closeRoomInput = undefined;
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || (event.key === 'Enter' && name)) {
                close();
                if (event.key === 'Enter') onConfirm(name);
                else onCancel();
                return;
            }
            name = editRoomName(name, event.key);
            texts[1].setText(`${name.toUpperCase()}_`);
        };
        keyboard?.on('keydown', handleKey);
        this.closeRoomInput = close;
        this.onEscape = () => {
            close();
            onCancel();
        };
    }

    /** A lista muda enquanto o jogador olha: mantém a opção onde ele está. */
    showMultiplayerMenu(rooms: readonly string[], handlers: MultiplayerMenuHandlers) {
        this.onEscape = handlers.onBack;
        this.renderKeepingSelection(createMultiplayerMenuActions(rooms, handlers));
    }

    /** Depois de trocar o personagem, o cursor continua na mesma opção. */
    refreshPlayMenu() {
        const selected = this.selectedAction;
        this.renderActions(createPlayMenuActions(this.options, () => this.showMainMenu()));
        this.selectedAction = selected;
        this.updateSelection();
        this.updateCharacterPreview();
    }

    private renderKeepingSelection(actions: MenuAction[]) {
        const selectedLabel = this.currentActions[this.selectedAction]?.label;
        this.renderActions(actions);
        const selected = this.currentActions.findIndex((action) => action.label === selectedLabel);
        if (selected >= 0) {
            this.selectedAction = selected;
            this.updateSelection();
        }
    }

    /** Prévia animada ao lado da opção, visível só no menu de jogar. */
    private updateCharacterPreview() {
        const action = this.currentActions.find(({ label }) => label.startsWith('PERSONAGEM'));
        const character = this.options.character?.();
        if (!action || !character) {
            this.characterPreview?.setVisible(false);
            return;
        }
        createWalkAnimations(this.scene, character.texture);
        this.characterPreview ??= this.scene.add.sprite(0, 0, character.texture).setScrollFactor(0);
        this.characterPreview
            .setVisible(true)
            .setScale(1.5 * character.scaleMultiplier)
            .setPosition(MENU_LAYOUT.menuX + 150, action.y - 8)
            .play(walkAnimationKey(character.texture, 'down'), true);
    }

    showWaitingForPartner(onCancel: () => void) {
        this.onEscape = onCancel;
        this.renderActions(positionActions([{ label: 'CANCELAR', onSelect: onCancel }]));
    }

    private showMainMenu() {
        this.onEscape = undefined;
        this.renderActions(createMainMenuActions(
            () => this.showPlayMenu(),
            this.options.onLeaderboard
        ));
    }

    showPlayMenu() {
        this.onEscape = () => this.showMainMenu();
        this.renderActions(createPlayMenuActions(this.options, () => this.showMainMenu()));
        this.updateCharacterPreview();
    }

    private renderActions(actions: MenuAction[]) {
        this.characterPreview?.setVisible(false);
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
                Math.max(ACTION_HIT_AREA_WIDTH, label.width + 24),
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
        bindGamepadActions(this.scene, {
            up: () => this.moveSelection(-1),
            down: () => this.moveSelection(1),
            confirm: () => this.currentActions[this.selectedAction]?.onSelect?.(),
            cancel: () => this.onEscape?.()
        });

        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        const selectPrevious = () => this.moveSelection(-1);
        const selectNext = () => this.moveSelection(1);
        const confirmSelection = () => this.currentActions[this.selectedAction]?.onSelect?.();
        const goBack = () => this.onEscape?.();

        keyboard.on('keydown-UP', selectPrevious);
        keyboard.on('keydown-W', selectPrevious);
        keyboard.on('keydown-DOWN', selectNext);
        keyboard.on('keydown-S', selectNext);
        keyboard.on('keydown-ENTER', confirmSelection);
        keyboard.on('keydown-SPACE', confirmSelection);
        keyboard.on('keydown-ESC', goBack);

        this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.closeRoomInput?.();
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
