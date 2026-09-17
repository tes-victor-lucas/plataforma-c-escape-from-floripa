import type { Scene } from 'phaser';
import { FootstepAudio } from '../audio/FootstepAudio';
import { WORLD_CONFIG } from '../config/world';

export type Direction = 'up' | 'down' | 'left' | 'right';

// LPC: 9 quadros de 64px por linha, organizados em quatro direções.
const WALK_FRAMES: Record<Direction, number[]> = {
    up: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    left: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    down: [18, 19, 20, 21, 22, 23, 24, 25, 26],
    right: [27, 28, 29, 30, 31, 32, 33, 34, 35]
};

type MovementKeys = Record<Direction, Phaser.Input.Keyboard.Key>;
type MovementDirection = { x: number; y: number };
type SpawnPosition = { x: number; y: number };

/** Reúne o estado e o comportamento controlável do personagem. */
export class Player {
    readonly sprite: Phaser.Physics.Arcade.Sprite;

    private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private readonly wasd: MovementKeys;
    private readonly footsteps: FootstepAudio;
    private facing: Direction = 'down';
    /**
     * `body.blocked` é limpo pelo Arcade Physics antes do próximo passo. Guardamos
     * a direção que bateu para não tentar avançar e bater de novo a cada quadro.
     */
    private blockedDirection?: MovementDirection;

    constructor(private readonly scene: Scene, spawnPosition: SpawnPosition) {
        const keyboard = scene.input.keyboard;

        if (!keyboard) {
            throw new Error('O teclado precisa estar habilitado para criar o jogador.');
        }

        const { player } = WORLD_CONFIG;
        this.sprite = scene.physics.add.sprite(
            spawnPosition.x,
            spawnPosition.y,
            player.texture,
            player.initialFrame
        );
        this.sprite.setScale(player.scale);
        this.sprite.setDepth(10);
        this.sprite.setCollideWorldBounds(true);
        this.configureBody();

        this.createAnimations();
        this.setIdleFrame();

        this.cursors = keyboard.createCursorKeys();
        this.wasd = {
            up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
        this.footsteps = new FootstepAudio(scene);
    }

    update(delta: number) {
        const direction = this.getMovementDirection();
        const { x, y } = direction;
        const isReceivingMovementInput = x !== 0 || y !== 0;

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

        const animationKey = `player-walk-${this.facing}`;
        if (this.sprite.anims.currentAnim?.key !== animationKey || !this.sprite.anims.isPlaying) {
            this.playWalkAnimation(animationKey);
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
        let x = Number(this.cursors.right.isDown || this.wasd.right.isDown)
            - Number(this.cursors.left.isDown || this.wasd.left.isDown);
        let y = Number(this.cursors.down.isDown || this.wasd.down.isDown)
            - Number(this.cursors.up.isDown || this.wasd.up.isDown);

        const length = Math.hypot(x, y);
        if (length > 0) {
            x /= length;
            y /= length;
        }

        return { x, y };
    }

    private updateVelocity(direction: MovementDirection, delta: number) {
        const { speed, velocityResponsiveness } = WORLD_CONFIG.player;
        const interpolation = 1 - Math.exp(-velocityResponsiveness * delta / 1000);
        const body = this.sprite.body;
        const targetX = direction.x * speed;
        const targetY = direction.y * speed;

        if (!(body instanceof Phaser.Physics.Arcade.Body)) {
            this.sprite.setVelocity(targetX, targetY);
            return;
        }

        this.sprite.setVelocity(
            Phaser.Math.Linear(body.velocity.x, targetX, interpolation),
            Phaser.Math.Linear(body.velocity.y, targetY, interpolation)
        );
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

    private createAnimations() {
        for (const [direction, frames] of Object.entries(WALK_FRAMES) as [Direction, number[]][]) {
            const key = `player-walk-${direction}`;

            if (!this.scene.anims.exists(key)) {
                this.scene.anims.create({
                    key,
                    frames: this.scene.anims.generateFrameNumbers(WORLD_CONFIG.player.texture, { frames }),
                    frameRate: 9,
                    repeat: -1
                });
            }
        }
    }

    private setIdleFrame() {
        this.sprite.setTexture(WORLD_CONFIG.player.texture, WALK_FRAMES[this.facing][0]);
    }
}
