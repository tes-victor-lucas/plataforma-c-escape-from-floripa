import type { Scene } from 'phaser';
import { TCHAY, type BarQueueConfig } from '../config/tchay';
import { getActorDepth } from '../config/world';

type Person = {
    sprite: Phaser.GameObjects.Sprite;
    row: number;
    state: 'fila' | 'saindo';
    targetX: number;
};

/** Fila de bar (o TCHAY e os barzinhos): a cada intervalo o primeiro sai com o copão, a fila anda e alguém entra no fim. */
export class TchayQueue {
    private readonly people: Person[] = [];
    private elapsed = 0;
    private nextRow = 0;
    /** Quantos já foram atendidos (para os testes e para variar as pessoas). */
    served = 0;

    constructor(private readonly scene: Scene, private readonly config: BarQueueConfig = TCHAY) {
        for (let row = 0; row < TCHAY.people; row += 1) {
            for (const [name, start] of [['parado', 0], ['anda', 2], ['copo', 4]] as const) {
                const key = `tchay-${row}-${name}`;
                if (scene.anims.exists(key)) continue;
                scene.anims.create({
                    key,
                    frames: scene.anims.generateFrameNumbers(TCHAY.peopleTexture, { start: row * 6 + start, end: row * 6 + start + 1 }),
                    frameRate: name === 'parado' ? 1.5 : 6,
                    repeat: -1
                });
            }
        }
        for (let i = 0; i < config.queueLength; i += 1) this.join(this.slotX(i));
    }

    /** Pessoas ainda na fila, da frente para o fim. */
    get queue() {
        return this.people.filter((person) => person.state === 'fila');
    }

    private slotX(index: number) {
        return this.config.counter.x + this.config.direction * index * this.config.spacing;
    }

    private join(x: number) {
        const row = this.nextRow;
        this.nextRow = (this.nextRow + 1) % TCHAY.people;
        const { y } = this.config.counter;
        const sprite = this.scene.add.sprite(x, y, TCHAY.peopleTexture, row * 6)
            .setOrigin(0.5, 1)
            .setDepth(getActorDepth(y));
        sprite.setFlipX(this.facesLeft).play({ key: `tchay-${row}-parado`, startFrame: row % 2 });
        this.people.push({ sprite, row, state: 'fila', targetX: x });
    }

    /** Na fila todo mundo olha para o balcão. */
    private get facesLeft() {
        return this.config.direction > 0;
    }

    update(delta: number) {
        this.elapsed += delta;
        if (this.elapsed >= this.config.serveInterval) {
            this.elapsed -= this.config.serveInterval;
            this.serveFirst();
        }
        const step = this.config.walkSpeed * delta / 1000;
        this.queue.forEach((person, index) => {
            person.targetX = this.slotX(index);
            const dx = person.targetX - person.sprite.x;
            if (Math.abs(dx) > step) {
                person.sprite.x += Math.sign(dx) * step;
                person.sprite.setFlipX(dx < 0).play(`tchay-${person.row}-anda`, true);
            } else {
                person.sprite.x = person.targetX;
                person.sprite.setFlipX(this.facesLeft).play(`tchay-${person.row}-parado`, true);
            }
        });
    }

    /** Sai do balcão com o copão, descendo da calçada até sumir; outra pessoa entra no fim da fila. */
    private serveFirst() {
        const [first] = this.queue;
        if (!first) return;
        this.served += 1;
        first.state = 'saindo';
        const { exit, exitDuration, exitFade } = this.config;
        first.sprite.setFlipX(exit.dx < 0).play(`tchay-${first.row}-copo`);
        // Anda devagar com o copão por 5 s; só depois some.
        this.scene.tweens.add({
            targets: first.sprite,
            x: first.sprite.x + exit.dx,
            y: first.sprite.y + exit.dy,
            duration: exitDuration,
            onUpdate: () => first.sprite.setDepth(getActorDepth(first.sprite.y)),
            onComplete: () => this.scene.tweens.add({
                targets: first.sprite,
                alpha: 0,
                duration: exitFade,
                onComplete: () => {
                    first.sprite.destroy();
                    this.people.splice(this.people.indexOf(first), 1);
                }
            })
        });
        // Quem chega entra andando pela esquerda e para no último lugar.
        this.join(this.slotX(this.config.queueLength) + this.config.direction * 24);
    }

    destroy() {
        for (const { sprite } of this.people) {
            this.scene.tweens.killTweensOf(sprite);
            sprite.destroy();
        }
        this.people.length = 0;
    }
}
