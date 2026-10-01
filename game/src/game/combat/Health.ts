/** Estado de vida compartilhado pelo jogador e pelos inimigos. */
export class Health {
    current: number;
    max: number;

    constructor(max: number) {
        this.max = Math.max(0, max);
        this.current = this.max;
    }

    get isAlive() {
        return this.current > 0;
    }

    takeDamage(amount: number) {
        this.current = Math.max(0, this.current - Math.max(0, amount));
    }

    heal(amount: number) {
        this.current = Math.min(this.max, this.current + Math.max(0, amount));
    }

    increaseMax(amount: number, healAmount = amount) {
        const increase = Math.max(0, amount);
        this.max += increase;
        this.heal(healAmount);
    }
}
