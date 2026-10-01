import type { Scene } from 'phaser';

type MusicConfig = Readonly<{
    key: string;
    volume: number;
}>;

type VolumeSound = Phaser.Sound.BaseSound & {
    volume: number;
    setVolume(value: number): Phaser.Sound.BaseSound;
};

/** Mantém uma única música ativa e faz transições suaves entre cenas. */
export class MusicDirector {
    private active?: { key: string; sound: VolumeSound };
    private readonly fadingOut = new Set<VolumeSound>();
    private transitions: Phaser.Tweens.Tween[] = [];
    private transitionVersion = 0;
    private pendingUnlock?: { manager: Scene['sound']; callback: () => void };

    play(scene: Scene, config: MusicConfig, fadeDuration = 0) {
        const version = ++this.transitionVersion;
        this.cancelPendingUnlock();
        this.cancelTransitions();

        if (this.active?.key === config.key) {
            if (!this.active.sound.isPlaying) this.active.sound.play();
            this.fadeOutInactive(scene, fadeDuration);
            this.fadeWhenUnlocked(scene, this.active.sound, config.volume, fadeDuration);
            return;
        }

        if (this.active) {
            this.fadingOut.add(this.active.sound);
            this.active = undefined;
        }

        const outgoing = [...this.fadingOut];
        if (outgoing.length === 0) {
            this.startTrack(scene, config, fadeDuration, version);
            return;
        }

        let remaining = outgoing.length;
        for (const sound of outgoing) {
            this.fade(scene, sound, 0, fadeDuration, () => {
                this.release(sound);
                remaining -= 1;
                if (remaining === 0 && version === this.transitionVersion) {
                    this.startTrack(scene, config, fadeDuration, version);
                }
            });
        }
    }

    stop(scene: Scene, fadeDuration = 0) {
        this.transitionVersion += 1;
        this.cancelPendingUnlock();
        this.cancelTransitions();
        if (this.active) {
            this.fadingOut.add(this.active.sound);
            this.active = undefined;
        }
        this.fadeOutInactive(scene, scene.sound.locked ? 0 : fadeDuration);
    }

    private startTrack(scene: Scene, config: MusicConfig, duration: number, version: number) {
        if (version !== this.transitionVersion) return;

        const sound = scene.sound.add(config.key, {
            loop: true,
            volume: duration > 0 ? 0 : config.volume
        }) as VolumeSound;
        sound.play();
        this.active = { key: config.key, sound };
        this.fadeWhenUnlocked(scene, sound, config.volume, duration);
    }

    private fadeWhenUnlocked(
        scene: Scene,
        sound: VolumeSound,
        targetVolume: number,
        duration: number
    ) {
        if (duration <= 0 || !scene.sound.locked) {
            this.fade(scene, sound, targetVolume, duration);
            return;
        }

        sound.setVolume(0);
        const callback = () => {
            this.pendingUnlock = undefined;
            if (this.active?.sound !== sound) return;
            this.fade(scene, sound, targetVolume, duration);
        };
        this.pendingUnlock = { manager: scene.sound, callback };
        scene.sound.once('unlocked', callback);
    }

    private fadeOutInactive(scene: Scene, duration: number) {
        for (const sound of this.fadingOut) {
            this.fade(scene, sound, 0, duration, () => this.release(sound));
        }
    }

    private fade(
        scene: Scene,
        sound: VolumeSound,
        targetVolume: number,
        duration: number,
        onComplete?: () => void
    ) {
        if (duration <= 0 || Math.abs(sound.volume - targetVolume) < 0.001) {
            sound.setVolume(targetVolume);
            onComplete?.();
            return;
        }

        const initialVolume = sound.volume;
        const tween = scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration,
            ease: 'Sine.InOut',
            onUpdate: (activeTween) => {
                const progress = activeTween.getValue() ?? 1;
                const volume = initialVolume
                    + (targetVolume - initialVolume) * progress;
                sound.setVolume(volume);
            },
            onComplete: () => {
                sound.setVolume(targetVolume);
                this.transitions = this.transitions.filter((candidate) => candidate !== tween);
                onComplete?.();
            }
        });
        this.transitions.push(tween);
    }

    private cancelTransitions() {
        for (const tween of this.transitions) tween.stop();
        this.transitions = [];
    }

    private cancelPendingUnlock() {
        if (!this.pendingUnlock) return;
        const { manager, callback } = this.pendingUnlock;
        manager.off('unlocked', callback);
        this.pendingUnlock = undefined;
    }

    private release(sound: VolumeSound) {
        this.fadingOut.delete(sound);
        sound.stop();
        sound.destroy();
    }
}

export const musicDirector = new MusicDirector();
