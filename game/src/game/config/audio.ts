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
        waveThreat: {
            key: 'wave-threat',
            path: 'assets/audio/horror-tension.wav',
            volume: 0.16
        },
        // Sons do golem (assets/topazio/gen_sons.py). A pancada do rugido cai junto com a da cutscene.
        golemRoar: {
            key: 'golem-roar',
            path: 'assets/audio/golem-roar.wav',
            volume: 0.3
        },
        // Baque no chão e um estalo de cristal para cada topázio da cadeia.
        golemSlam: {
            key: 'golem-slam',
            path: 'assets/audio/golem-slam.wav',
            volume: 0.28
        },
        // Dura o giro inteiro (2,2 s), com um sopro a cada punho que passa.
        golemSpin: {
            key: 'golem-spin',
            path: 'assets/audio/golem-spin.wav',
            volume: 0.22
        }
    },
    music: {
        fadeDuration: 1800,
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
