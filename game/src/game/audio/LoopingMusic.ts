import type { Scene } from 'phaser';

type LoopingMusicConfig = Readonly<{
    key: string;
    volume: number;
}>;

/** Controla uma música ambiente e libera seus recursos ao sair da cena. */
export class LoopingMusic {
    private readonly sound: Phaser.Sound.BaseSound;

    constructor(scene: Scene, config: LoopingMusicConfig) {
        this.sound = scene.sound.add(config.key, {
            loop: true,
            volume: config.volume
        });
    }

    start() {
        if (!this.sound.isPlaying) {
            this.sound.play();
        }
    }

    destroy() {
        this.sound.stop();
        this.sound.destroy();
    }
}
