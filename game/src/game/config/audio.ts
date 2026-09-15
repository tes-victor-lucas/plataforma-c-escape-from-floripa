export const AUDIO_CONFIG = {
    effects: {
        playerFootstep: {
            key: 'player-footstep-concrete',
            path: 'assets/audio/player-footstep-concrete.wav',
            volume: 0.08,
            interval: 320
        }
    },
    music: {
        room1: {
            key: 'room1-music',
            path: 'assets/audio/song-room1.mp3',
            // Música de fundo: deixa os efeitos, como os passos, audíveis.
            volume: 0.06
        }
    }
} as const;
