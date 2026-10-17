import type { Scene } from 'phaser';

type MusicConfig = Readonly<{ key: string; volume: number }>;
type MusicTransitionOptions = Readonly<{
    fadeOutDuration?: number;
    fadeInDuration?: number;
    restart?: boolean;
}>;

type VolumeSound = Phaser.Sound.BaseSound & {
    key: string;
    manager: Phaser.Sound.BaseSoundManager & { context?: BaseAudioContext };
    pendingRemove: boolean;
    volume: number;
    volumeNode?: GainNode;
    setVolume(value: number): Phaser.Sound.BaseSound;
};

type SoundManagerWithSounds = Scene['sound'] & { sounds: Phaser.Sound.BaseSound[] };
type DesiredTrack = {
    config: MusicConfig;
    fadeInDuration: number;
    scene: Scene;
    version: number;
};
type VolumeTransition = {
    sound: VolumeSound;
    targetVolume: number;
    tween: Phaser.Tweens.Tween;
    onComplete?: () => void;
};

/**
 * Dono único das músicas do jogo.
 *
 * A troca é sempre serial: a faixa atual chega a zero e é destruída antes de
 * a próxima ser criada em volume zero. Os tweens rodam na cena Audio, que não
 * é encerrada durante as trocas de tela.
 */
export class MusicDirector {
    private current?: { key: string; sound: VolumeSound };
    private desired?: DesiredTrack;
    private transition?: VolumeTransition;
    private transitionVersion = 0;
    private pendingUnlock?: { manager: Scene['sound']; callback: () => void };
    private readonly musicKeys = new Set<string>();

    play(scene: Scene, config: MusicConfig, fadeDuration = 0) {
        this.transitionTo(scene, config, {
            fadeOutDuration: fadeDuration,
            fadeInDuration: fadeDuration
        });
    }

    transitionTo(scene: Scene, config: MusicConfig, options: MusicTransitionOptions = {}) {
        const fadeOutDuration = options.fadeOutDuration ?? 0;
        const fadeInDuration = options.fadeInDuration ?? fadeOutDuration;
        const restart = options.restart ?? false;
        this.musicKeys.add(config.key);
        this.removeOrphanedMusic(scene);

        if (this.desired?.config.key === config.key && !restart) {
            this.debug(scene, 'pedido repetido ignorado');
            return;
        }

        const version = ++this.transitionVersion;
        this.cancelPendingUnlock();
        this.desired = { config, fadeInDuration, scene, version };
        this.debug(scene, `transição solicitada para ${config.key}`);

        if (this.current?.key === config.key && !restart) {
            this.fadeWhenUnlocked(scene, this.current.sound, config.volume, fadeInDuration);
            return;
        }

        if (!this.current) {
            this.startDesiredTrack();
            return;
        }

        const outgoing = this.current.sound;
        this.fade(this.getAudioScene(scene), outgoing, 0, fadeOutDuration, () => {
            this.release(outgoing);
            if (version === this.transitionVersion) this.startDesiredTrack();
        });
    }

    stop(scene: Scene, fadeDuration = 0) {
        this.transitionVersion += 1;
        this.desired = undefined;
        this.cancelPendingUnlock();
        if (!this.current) {
            this.removeOrphanedMusic(scene);
            return;
        }

        const outgoing = this.current.sound;
        this.fade(
            this.getAudioScene(scene),
            outgoing,
            0,
            scene.sound.locked ? 0 : fadeDuration,
            () => this.release(outgoing)
        );
    }

    private startDesiredTrack() {
        const desired = this.desired;
        if (!desired || desired.version !== this.transitionVersion) return;

        this.removeOrphanedMusic(desired.scene);
        const sound = desired.scene.sound.add(desired.config.key, {
            loop: true,
            volume: 0
        }) as VolumeSound;

        // Reforça o zero antes e depois de play nos backends WebAudio e HTML5.
        this.setVolume(sound, 0);
        sound.play();
        this.setVolume(sound, 0);
        this.current = { key: desired.config.key, sound };
        this.debug(desired.scene, `faixa criada em zero: ${desired.config.key}`);
        this.fadeWhenUnlocked(
            desired.scene,
            sound,
            desired.config.volume,
            desired.fadeInDuration
        );
    }

    private fadeWhenUnlocked(
        scene: Scene,
        sound: VolumeSound,
        targetVolume: number,
        duration: number
    ) {
        this.setVolume(sound, 0);
        if (duration <= 0 || !scene.sound.locked) {
            this.fade(this.getAudioScene(scene), sound, targetVolume, duration);
            return;
        }

        const callback = () => {
            this.pendingUnlock = undefined;
            if (this.current?.sound !== sound) return;
            this.setVolume(sound, 0);
            this.fade(this.getAudioScene(scene), sound, targetVolume, duration);
        };
        this.pendingUnlock = { manager: scene.sound, callback };
        scene.sound.once('unlocked', callback);
    }

    private fade(
        scene: Scene,
        sound: VolumeSound,
        targetVolume: number,
        duration: number,
        onComplete?: () => void
    ) {
        if (this.transition?.sound === sound && this.transition.targetVolume === targetVolume) {
            this.transition.onComplete = onComplete;
            return;
        }

        this.cancelTransition();
        if (duration <= 0 || Math.abs(sound.volume - targetVolume) < 0.001) {
            this.setVolume(sound, targetVolume);
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
                this.setVolume(sound, initialVolume + (targetVolume - initialVolume) * progress);
            },
            onComplete: () => {
                this.setVolume(sound, targetVolume);
                const callback = this.transition?.tween === tween
                    ? this.transition.onComplete
                    : undefined;
                if (this.transition?.tween === tween) this.transition = undefined;
                callback?.();
            }
        });
        this.transition = { sound, targetVolume, tween, onComplete };
    }

    private getAudioScene(scene: Scene) {
        const audioScene = scene.scene?.get?.('Audio');
        return audioScene && audioScene.tweens ? audioScene : scene;
    }

    private setVolume(sound: VolumeSound, value: number) {
        sound.setVolume(value);

        // Phaser usa setValueAtTime(value, 0). Com o AudioContext suspenso,
        // o GainNode pode continuar expondo o ganho padrão 1 até o unlock.
        // Escrever no tempo atual garante silêncio antes de liberar o source.
        const gain = sound.volumeNode?.gain;
        if (!gain) return;
        const context = sound.manager.context;
        gain.value = value;
        if (!context) return;
        gain.cancelScheduledValues(context.currentTime);
        gain.setValueAtTime(value, context.currentTime);
    }

    private removeOrphanedMusic(scene: Scene) {
        const manager = scene.sound as SoundManagerWithSounds;
        if (!Array.isArray(manager.sounds)) return;

        for (const candidate of [...manager.sounds] as VolumeSound[]) {
            if (
                candidate.pendingRemove
                || !this.musicKeys.has(candidate.key)
                || candidate === this.current?.sound
            ) continue;
            candidate.stop();
            candidate.destroy();
            this.debug(scene, `instância órfã removida: ${candidate.key}`);
        }
    }

    private cancelTransition() {
        this.transition?.tween.stop();
        this.transition = undefined;
    }

    private cancelPendingUnlock() {
        if (!this.pendingUnlock) return;
        const { manager, callback } = this.pendingUnlock;
        manager.off('unlocked', callback);
        this.pendingUnlock = undefined;
    }

    private release(sound: VolumeSound) {
        if (this.transition?.sound === sound) this.cancelTransition();
        if (this.current?.sound === sound) this.current = undefined;
        sound.stop();
        sound.destroy();
    }

    private debug(scene: Scene, event: string) {
        if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('audioDebug')) {
            return;
        }

        const manager = scene.sound as SoundManagerWithSounds;
        const music = Array.isArray(manager.sounds)
            ? (manager.sounds as VolumeSound[])
                .filter((sound) => this.musicKeys.has(sound.key) && !sound.pendingRemove)
                .map((sound) => ({ key: sound.key, volume: sound.volume, playing: sound.isPlaying }))
            : [];
        console.debug(`[audio] ${event} ${JSON.stringify(music)}`);
    }
}

export const musicDirector = new MusicDirector();
