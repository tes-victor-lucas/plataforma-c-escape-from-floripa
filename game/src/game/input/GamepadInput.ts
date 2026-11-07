import type { Scene } from 'phaser';

export type GamepadAction =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'confirm'
    | 'cancel'
    | 'dash'
    | 'attack'
    | 'interact'
    | 'pause';

type Direction = 'up' | 'down' | 'left' | 'right';
type GamepadActionHandlers = Partial<Record<GamepadAction, () => void>>;

const DEAD_ZONE = 0.35;
const PRIMARY_BUTTON = 0;
const SECONDARY_BUTTON = 1;
const RIGHT_SHOULDER_BUTTON = 5;
const START_BUTTON = 9;
const STANDARD_BUTTONS: Readonly<Partial<Record<GamepadAction, readonly number[]>>> = {
    // No mapeamento padrão, o botão principal fica embaixo (A no Xbox, B no SNES).
    confirm: [PRIMARY_BUTTON],
    attack: [PRIMARY_BUTTON],
    interact: [PRIMARY_BUTTON],
    cancel: [SECONDARY_BUTTON],
    dash: [SECONDARY_BUTTON, RIGHT_SHOULDER_BUTTON],
    pause: [START_BUTTON]
};
const GENERIC_SNES_BUTTONS: typeof STANDARD_BUTTONS = {
    // O USB Gamepad 0810:0001 não declara mapeamento padrão: A é 1 e B é 0.
    confirm: [SECONDARY_BUTTON],
    attack: [SECONDARY_BUTTON],
    interact: [SECONDARY_BUTTON],
    cancel: [PRIMARY_BUTTON],
    dash: [PRIMARY_BUTTON, RIGHT_SHOULDER_BUTTON],
    pause: [START_BUTTON]
};
const DIRECTION_BUTTONS: Readonly<Record<Direction, number>> = {
    up: 12,
    down: 13,
    left: 14,
    right: 15
};

/**
 * Normaliza controles modernos e controles USB genéricos pela Web Gamepad API.
 * O primeiro controle conectado é usado e pode ser conectado depois que o jogo abriu.
 */
export class GamepadInput {
    private currentButtons: readonly boolean[] = [];
    private previousButtons: readonly boolean[] = [];
    private currentDirections: Readonly<Record<Direction, boolean>> = {
        up: false,
        down: false,
        left: false,
        right: false
    };
    private previousDirections = this.currentDirections;
    private axes: readonly number[] = [];
    private usesStandardMapping = false;
    private lastFrameToken = Number.NaN;

    constructor() {
        // Uma cena aberta por um botão ainda segurado não deve interpretar o mesmo toque outra vez.
        const gamepad = this.getGamepad();
        if (!gamepad) return;
        this.usesStandardMapping = gamepad.mapping === 'standard';
        this.currentButtons = gamepad.buttons.map((button) => button.pressed || button.value > 0.5);
        this.previousButtons = [...this.currentButtons];
        this.axes = [...gamepad.axes];
        const horizontal = this.axis(0);
        const vertical = this.axis(1);
        this.currentDirections = {
            up: this.button(DIRECTION_BUTTONS.up) || vertical < -DEAD_ZONE,
            down: this.button(DIRECTION_BUTTONS.down) || vertical > DEAD_ZONE,
            left: this.button(DIRECTION_BUTTONS.left) || horizontal < -DEAD_ZONE,
            right: this.button(DIRECTION_BUTTONS.right) || horizontal > DEAD_ZONE
        };
        this.previousDirections = { ...this.currentDirections };
    }

    update(frameToken: number) {
        if (frameToken === this.lastFrameToken) return;
        this.lastFrameToken = frameToken;
        this.previousButtons = this.currentButtons;
        this.previousDirections = this.currentDirections;

        const gamepad = this.getGamepad();
        if (!gamepad) {
            this.currentButtons = [];
            this.axes = [];
            this.currentDirections = { up: false, down: false, left: false, right: false };
            return;
        }

        this.usesStandardMapping = gamepad.mapping === 'standard';
        this.currentButtons = gamepad.buttons.map((button) => button.pressed || button.value > 0.5);
        this.axes = [...gamepad.axes];
        const horizontal = this.axis(0);
        const vertical = this.axis(1);
        this.currentDirections = {
            up: this.button(DIRECTION_BUTTONS.up) || vertical < -DEAD_ZONE,
            down: this.button(DIRECTION_BUTTONS.down) || vertical > DEAD_ZONE,
            left: this.button(DIRECTION_BUTTONS.left) || horizontal < -DEAD_ZONE,
            right: this.button(DIRECTION_BUTTONS.right) || horizontal > DEAD_ZONE
        };
    }

    isDown(action: GamepadAction) {
        if (this.isDirection(action)) return this.currentDirections[action];
        return this.buttonsFor(action).some((button) => this.button(button));
    }

    justPressed(action: GamepadAction) {
        if (this.isDirection(action)) {
            return this.currentDirections[action] && !this.previousDirections[action];
        }
        return this.buttonsFor(action).some((button) =>
            this.button(button) && !this.previousButton(button));
    }

    getMovement() {
        let x = Number(this.currentDirections.right) - Number(this.currentDirections.left);
        let y = Number(this.currentDirections.down) - Number(this.currentDirections.up);
        const length = Math.hypot(x, y);
        if (length > 0) {
            x /= length;
            y /= length;
        }
        return { x, y };
    }

    private getGamepad() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return undefined;
        return Array.from(navigator.getGamepads()).find(
            (gamepad): gamepad is Gamepad => Boolean(gamepad?.connected)
        );
    }

    private button(index: number) {
        return this.currentButtons[index] ?? false;
    }

    private previousButton(index: number) {
        return this.previousButtons[index] ?? false;
    }

    private axis(index: number) {
        return this.axes[index] ?? 0;
    }

    private buttonsFor(action: GamepadAction) {
        const mapping = this.usesStandardMapping ? STANDARD_BUTTONS : GENERIC_SNES_BUTTONS;
        return mapping[action] ?? [];
    }

    private isDirection(action: GamepadAction): action is Direction {
        return action === 'up' || action === 'down' || action === 'left' || action === 'right';
    }
}

const sceneInputs = new WeakMap<Scene, GamepadInput>();

export function getGamepadInput(scene: Scene) {
    const existing = sceneInputs.get(scene);
    if (existing) return existing;
    const input = new GamepadInput();
    sceneInputs.set(scene, input);
    return input;
}

/** Liga ações de borda (um disparo por toque) ao ciclo de vida de uma cena. */
export function bindGamepadActions(scene: Scene, handlers: GamepadActionHandlers) {
    if (!scene.events) return () => undefined;
    const input = getGamepadInput(scene);
    const actions = Object.keys(handlers) as GamepadAction[];
    const update = (time: number) => {
        // Uma cena coberta por outro menu não deve responder ao mesmo botão por baixo dele.
        const activeScenes = scene.scene?.manager?.getScenes(true);
        if (activeScenes?.length && activeScenes[activeScenes.length - 1] !== scene) return;
        input.update(time);
        for (const action of actions) {
            if (input.justPressed(action)) handlers[action]?.();
        }
    };
    const cleanup = () => {
        scene.events.off('update', update);
        scene.events.off('shutdown', cleanup);
    };
    scene.events.on('update', update);
    scene.events.once('shutdown', cleanup);
    return cleanup;
}
