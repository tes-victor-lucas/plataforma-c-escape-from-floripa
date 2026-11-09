import type { Scene } from 'phaser';
import { FootstepAudio } from '../audio/FootstepAudio';
import { AUDIO_CONFIG } from '../config/audio';
import { getActorDepth, WORLD_CONFIG } from '../config/world';
import { COMBAT_CONFIG } from '../config/combat';
import { Health } from '../combat/Health';
import { DashState } from './DashState';
import { getGamepadInput } from '../input/GamepadInput';
import { touchInput } from '../input/TouchInput';
import { CHARACTERS, type CharacterId } from '../config/characters';
import { createWalkAnimations, walkAnimationKey, WALK_FRAMES, type Direction } from './PlayerAnimations';

export type { Direction } from './PlayerAnimations';

type MovementKeys = Record<Direction, Phaser.Input.Keyboard.Key>;
type MovementDirection = { x: number; y: number };
type SpawnPosition = { x: number; y: number };

/** Reúne o estado e o comportamento controlável do personagem. */
export class Player {
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    readonly health = new Health(COMBAT_CONFIG.player.maxHealth);

    private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly wasd: MovementKeys;
    private readonly dashKey: Phaser.Input.Keyboard.Key;
    private readonly gamepad: ReturnType<typeof getGamepadInput>;
    private readonly dash = new DashState(
        WORLD_CONFIG.player.dash.duration,
        WORLD_CONFIG.player.dash.cooldown
    );
    private readonly footsteps: FootstepAudio;
    private facing: Direction = 'down';
    private readonly texture: string;
    /** Última direção pedida pelo teclado; muda na hora, antes de a velocidade inverter. */
    private aimDirection: { x: number; y: number } = { x: 0, y: 1 };
    private movementSpeedMultiplier = 1;
    private invulnerableUntil = 0;
    private temporaryMovementSpeedMultiplier = 1;
    private controlsInverted = false;
    /**
     * `body.blocked` é limpo pelo Arcade Physics antes do próximo passo. Guardamos
     * a direção que bateu para não tentar avançar e bater de novo a cada quadro.
     */
    private blockedDirection?: MovementDirection;

    constructor(
        private readonly scene: Scene,
        spawnPosition: SpawnPosition,
        private readonly onDamageApplied?: (healthLost: number) => void,
        characterId: CharacterId = 'padrao'
    ) {
        const keyboard = scene.input.keyboard;

        if (!keyboard) {
            throw new Error('O teclado precisa estar habilitado para criar o jogador.');
        }

        const { player } = WORLD_CONFIG;
        this.sprite = scene.physics.add.sprite(
            spawnPosition.x,
            spawnPosition.y,
            CHARACTERS[characterId].texture,
            player.initialFrame
        );
        this.texture = CHARACTERS[characterId].texture;
        this.sprite.setScale(player.scale * CHARACTERS[characterId].scaleMultiplier);
        this.sprite.setDepth(10);
        this.sprite.setCollideWorldBounds(true);
        this.configureBody();

        createWalkAnimations(scene, this.texture);
        this.setIdleFrame();

        this.cursors = keyboard.createCursorKeys();
        this.wasd = {
            up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
        this.dashKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.gamepad = getGamepadInput(scene);
        this.footsteps = new FootstepAudio(scene);
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.footsteps.destroy());
    }

    update(delta: number) {
        if (!this.health.isAlive) return;
        this.sprite.setDepth(getActorDepth(this.sprite.body?.bottom ?? this.sprite.y));
        if (this.dash.tick(delta)) this.finishDash();

        const direction = this.getMovementDirection();
        const { x, y } = direction;
        const isReceivingMovementInput = x !== 0 || y !== 0;
        if (isReceivingMovementInput) this.aimDirection = direction;

        if (Phaser.Input.Keyboard.JustDown(this.dashKey) || this.gamepad.justPressed('dash')
            || touchInput.consume('dash')) {
            const dashDirection = isReceivingMovementInput
                ? direction
                : this.getFacingVector();
            if (this.dash.tryStart(dashDirection)) this.startDash();
        }

        if (this.dash.isActive) {
            this.updateDashVelocity();
            return;
        }

        if (!isReceivingMovementInput) {
            this.blockedDirection = undefined;
            this.sprite.setVelocity(0, 0);
            this.footsteps.update(false, delta);
            this.stopWalkingAnimation();
            return;
        }

        if (this.isMovementBlocked(direction)) {
            this.blockedDirection = direction;
        }

        if (this.isHoldingBlockedDirection(direction)) {
            this.sprite.setVelocity(0, 0);
            this.footsteps.stop();
            this.stopWalkingAnimation();
            return;
        }

        this.updateVelocity(direction, delta);

        // A velocidade foi resolvida pelo passo de física deste quadro. Assim,
        // encostar em uma parede não inicia animação nem um novo som de passo.
        const isMoving = this.getCurrentSpeed() > WORLD_CONFIG.player.stopThreshold;
        this.footsteps.update(isMoving, delta);

        if (!isMoving) {
            this.stopWalkingAnimation();
            return;
        }

        this.facing = this.getFacingDirection(x, y);

        const animationKey = walkAnimationKey(this.texture, this.facing);
        if (this.sprite.anims.currentAnim?.key !== animationKey || !this.sprite.anims.isPlaying) {
            this.playWalkAnimation(animationKey);
        }
    }

    getAimDirection() {
        return this.aimDirection;
    }

    getNetworkState() {
        return { x: this.sprite.x, y: this.sprite.y, facing: this.facing };
    }

    /** Levanta o jogador caído no multiplayer. */
    revive(amount: number) {
        this.health.heal(amount);
        this.sprite.clearTint().setAngle(0);
        if (this.sprite.body) this.sprite.body.enable = true;
    }

    /** Permite continuar andando se a barreira sumir enquanto a tecla está pressionada. */
    clearBlockedDirection() {
        this.blockedDirection = undefined;
    }

    setMovementSpeedMultiplier(multiplier: number) {
        this.movementSpeedMultiplier = Math.min(Math.max(0, multiplier), WORLD_CONFIG.player.maxSpeedMultiplier);
    }

    getMovementSpeedMultiplier() {
        return this.movementSpeedMultiplier;
    }

    setTemporaryMovementSpeedMultiplier(multiplier: number) {
        this.temporaryMovementSpeedMultiplier = Math.max(0, multiplier);
    }

    getEffectiveMovementSpeedMultiplier() {
        return this.movementSpeedMultiplier * this.temporaryMovementSpeedMultiplier;
    }

    getDashCharge() {
        return this.dash.charge;
    }

    setControlsInverted(inverted: boolean) {
        this.controlsInverted = inverted;
        this.clearBlockedDirection();
    }

    stopMovement() {
        this.dash.cancel();
        this.finishDash();
        this.sprite.setVelocity(0, 0);
        this.footsteps.stop();
        this.stopWalkingAnimation();
    }

    takeDamage(amount: number) {
        if (!this.health.isAlive) return;
        const now = this.scene.time?.now ?? 0;
        if (now < this.invulnerableUntil) return;
        const previousHealth = this.health.current;
        this.health.takeDamage(amount);
        const healthLost = previousHealth - this.health.current;
        if (healthLost <= 0) return;
        this.invulnerableUntil = now + WORLD_CONFIG.player.hurtInvulnerability;
        this.onDamageApplied?.(healthLost);
        const sound = this.health.isAlive
            ? AUDIO_CONFIG.effects.playerHurt
            : AUDIO_CONFIG.effects.playerDeath;
        this.scene.sound.play(sound.key, { volume: sound.volume });
        this.sprite.setTint(0xff5555);
        this.scene.time.delayedCall(120, () => {
            if (this.sprite.active && this.health.isAlive) this.sprite.clearTint();
        });
        if (!this.health.isAlive) {
            this.dash.cancel();
            this.finishDash();
            this.sprite.setVelocity(0, 0);
            this.sprite.anims.stop();
            this.footsteps.stop();
        }
    }

    private configureBody() {
        const body = this.sprite.body;

        if (body) {
            const { hitbox } = WORLD_CONFIG.player;

            // A área física acompanha apenas os pés, não o espaço transparente do sprite.
            body.setSize(hitbox.width, hitbox.height);
            body.setOffset(hitbox.offsetX, hitbox.offsetY);
        }
    }

    private getMovementDirection() {
        const gamepad = this.gamepad.getMovement();
        let x = Number(this.cursors.right.isDown || this.wasd.right.isDown)
            - Number(this.cursors.left.isDown || this.wasd.left.isDown)
            + gamepad.x + touchInput.x;
        let y = Number(this.cursors.down.isDown || this.wasd.down.isDown)
            - Number(this.cursors.up.isDown || this.wasd.up.isDown)
            + gamepad.y + touchInput.y;

        x = Math.max(-1, Math.min(1, x));
        y = Math.max(-1, Math.min(1, y));

        const length = Math.hypot(x, y);
        if (length > 0) {
            x /= length;
            y /= length;
        }

        if (this.controlsInverted) {
            x *= -1;
            y *= -1;
        }

        return { x, y };
    }

    private updateVelocity(direction: MovementDirection, delta: number) {
        const { speed, velocityResponsiveness } = WORLD_CONFIG.player;
        const interpolation = 1 - Math.exp(-velocityResponsiveness * delta / 1000);
        const body = this.sprite.body;
        const movementMultiplier = this.getEffectiveMovementSpeedMultiplier();
        const targetX = direction.x * speed * movementMultiplier;
        const targetY = direction.y * speed * movementMultiplier;

        if (!(body instanceof Phaser.Physics.Arcade.Body)) {
            this.sprite.setVelocity(targetX, targetY);
            return;
        }

        this.sprite.setVelocity(
            Phaser.Math.Linear(body.velocity.x, targetX, interpolation),
            Phaser.Math.Linear(body.velocity.y, targetY, interpolation)
        );
    }

    private startDash() {
        const { x, y } = this.dash.direction;
        this.blockedDirection = undefined;
        this.facing = this.getFacingDirection(x, y);
        this.sprite.setAlpha(WORLD_CONFIG.player.dash.alpha);
        this.updateDashVelocity();
    }

    private finishDash() {
        if (this.sprite.active) this.sprite.setAlpha(1);
    }

    private updateDashVelocity() {
        const { x, y } = this.dash.direction;
        const speed = WORLD_CONFIG.player.dash.speed * this.getEffectiveMovementSpeedMultiplier();
        this.sprite.setVelocity(x * speed, y * speed);
        this.footsteps.stop();
        this.stopWalkingAnimation();
    }

    private getCurrentSpeed() {
        const body = this.sprite.body;

        if (!(body instanceof Phaser.Physics.Arcade.Body)) {
            return 0;
        }

        return Math.hypot(body.velocity.x, body.velocity.y);
    }

    private isMovementBlocked(direction: MovementDirection) {
        const body = this.sprite.body;

        if (
            (direction.x === 0 && direction.y === 0)
            || !(body instanceof Phaser.Physics.Arcade.Body)
        ) {
            return false;
        }

        const isHorizontalMovementBlocked = direction.x === 0
            || (direction.x < 0 ? body.blocked.left : body.blocked.right);
        const isVerticalMovementBlocked = direction.y === 0
            || (direction.y < 0 ? body.blocked.up : body.blocked.down);

        return isHorizontalMovementBlocked && isVerticalMovementBlocked;
    }

    private isHoldingBlockedDirection(direction: MovementDirection) {
        if (!this.blockedDirection) {
            return false;
        }

        const isSameDirection = direction.x === this.blockedDirection.x
            && direction.y === this.blockedDirection.y;

        if (!isSameDirection) {
            this.blockedDirection = undefined;
        }

        return isSameDirection;
    }

    private getFacingDirection(x: number, y: number) {
        const { directionThreshold } = WORLD_CONFIG.player;
        const horizontal = Math.abs(x);
        const vertical = Math.abs(y);

        if (horizontal > vertical + directionThreshold) {
            return x < 0 ? 'left' : 'right';
        }

        if (vertical > horizontal + directionThreshold) {
            return y < 0 ? 'up' : 'down';
        }

        return this.facing;
    }

    private getFacingVector(): MovementDirection {
        switch (this.facing) {
            case 'up': return { x: 0, y: -1 };
            case 'down': return { x: 0, y: 1 };
            case 'left': return { x: -1, y: 0 };
            case 'right': return { x: 1, y: 0 };
        }
    }

    private playWalkAnimation(animationKey: string) {
        const currentFrame = this.sprite.anims.currentFrame;
        const startFrame = this.sprite.anims.isPlaying && currentFrame
            ? currentFrame.index - 1
            : 0;

        this.sprite.anims.play({ key: animationKey, startFrame }, true);
    }

    private stopWalkingAnimation() {
        this.sprite.anims.stop();
        this.setIdleFrame();
    }

    private setIdleFrame() {
        this.sprite.setTexture(this.texture, WALK_FRAMES[this.facing][0]);
    }
}
