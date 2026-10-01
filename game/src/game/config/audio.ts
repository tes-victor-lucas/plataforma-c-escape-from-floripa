export const AUDIO_CONFIG = {
    effects: {
        playerFootstep: {
            key: 'player-footstep-concrete',
            path: 'assets/audio/player-footstep-concrete.wav',
            volume: 0.05,
            interval: 320
        },
        playerHurt: {
            key: 'player-hurt',
            path: 'assets/audio/hurt.wav',
            volume: 0.06
        },
        droneExplosion: {
            key: 'drone-explosion-sound',
            path: 'assets/audio/explosion_small.wav',
            volume: 0.06
        },
        playerDeath: {
            key: 'player-death',
            path: 'assets/audio/lose.wav',
            // Um pouco mais alto que o passo (0.05), para marcar a derrota.
            volume: 0.07
        },
        playerShot: {
            key: 'player-shot',
            path: 'assets/audio/player-shot.wav',
            volume: 0.035
        },
        enemyShot: {
            key: 'enemy-shot',
            path: 'assets/audio/enemy-shot.wav',
            volume: 0.035
        },
    },
    music: {
        fadeDuration: 1800,
        sceneExitFadeDuration: 500,
        mainMenu: {
            key: 'main-menu-music',
            path: 'assets/audio/mainmenu.mp3',
            volume: 0.12
        },
        room1: {
            key: 'room1-music',
            path: 'assets/audio/room01.mp3',
            // Música de fundo: deixa os efeitos, como os passos, audíveis.
            volume: 0.08
        }
    }
} as const;
