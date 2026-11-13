export type DashDirection = Readonly<{ x: number; y: number }>;

/** Controla duração, direção e recarga sem depender do loop do Phaser. */
export class DashState {
    private remainingDuration = 0;
    private remainingCooldown = 0;
    private currentDirection: DashDirection = { x: 0, y: 1 };
    /** Itens que encurtam a recarga mudam este valor; vale a partir do próximo dash. */
    cooldownMultiplier = 1;

    constructor(
        private readonly duration: number,
        private readonly cooldown: number
    ) {}

    get isActive() {
        return this.remainingDuration > 0;
    }

    get direction() {
        return this.currentDirection;
    }

    get cooldownRemaining() {
        return this.remainingCooldown;
    }

    /** 0 logo após usar o dash e 1 quando ele está pronto novamente. */
    get charge() {
        const cooldown = this.cooldown * this.cooldownMultiplier;
        if (cooldown <= 0) return 1;
        return Math.max(0, Math.min(1, 1 - this.remainingCooldown / cooldown));
    }

    tick(delta: number) {
        const elapsed = Math.max(0, delta);
        const wasActive = this.isActive;
        this.remainingDuration = Math.max(0, this.remainingDuration - elapsed);
        this.remainingCooldown = Math.max(0, this.remainingCooldown - elapsed);
        return wasActive && !this.isActive;
    }

    tryStart(direction: DashDirection) {
        if (this.isActive || this.remainingCooldown > 0) return false;

        const length = Math.hypot(direction.x, direction.y);
        if (length === 0) return false;

        this.currentDirection = {
            x: direction.x / length,
            y: direction.y / length
        };
        this.remainingDuration = Math.max(0, this.duration);
        this.remainingCooldown = Math.max(this.remainingDuration, this.cooldown * this.cooldownMultiplier);
        return this.isActive;
    }

    cancel() {
        this.remainingDuration = 0;
    }
}
