/** Estado de vida compartilhado pelo jogador e pelos inimigos. */
export class Health {
    current: number;

    constructor(readonly max: number) {
        this.current = max;
    }

    get isAlive() {
        return this.current > 0;
    }

    takeDamage(amount: number) {
        this.current = Math.max(0, this.current - Math.max(0, amount));
    }
}
