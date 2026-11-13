import { CHARACTERS } from '../config/characters';
import { MERCADO_NPCS } from '../config/mercado';
import { PAGODE, POPULAR_BARS, TCHAY } from '../config/tchay';
import { TICEN_DUEL, TICEN_ESCAPE, TICEN_GATE, TOPAZIO_BOSS, WALLET_UI } from '../config/ticen';
import { Scene } from 'phaser';
import { AUDIO_CONFIG } from '../config/audio';
import { DRONE_EXPLOSION } from '../effects/playDroneExplosion';
import { HUD_CONFIG } from '../config/hud';
import { getMenuLayout } from '../config/menu';
import { getRequestedRoomKey, ROOM_DEFINITIONS } from '../config/rooms';
import { loadCampaignProgress } from '../progress/CampaignProgress';
import { runTracker } from '../scoring/RunTracker';

export function getInitialSceneRoute(
    search = typeof window === 'undefined' ? '' : window.location.search
) {
    const roomKey = getRequestedRoomKey(search);
    return roomKey !== 'room1'
        ? { key: 'RoomTransition', data: { roomKey } }
        : { key: 'MainMenu', data: undefined };
}

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        const menuLayout = getMenuLayout();
        this.load.image(menuLayout.title.texture, menuLayout.title.path);
        menuLayout.backgrounds.forEach(({ texture, path }) => this.load.image(texture, path));

        this.load.image(HUD_CONFIG.heart.texture, HUD_CONFIG.heart.path);
        this.load.image(
            HUD_CONFIG.controls.pauseTexture,
            HUD_CONFIG.controls.pausePath
        );

        this.load.image('piranhas-cookie-magico', 'assets/items/piranhas-bar/cookie-magico-transparent.png');
        this.load.image('piranhas-gin-melancia', 'assets/items/piranhas-bar/gin-de-10-melancia-transparent.png');
        this.load.image('piranhas-gin-tropical', 'assets/items/piranhas-bar/gin-de-10-tropical-transparent.png');

        const loadedTextures = new Set<string>();
        for (const room of Object.values(ROOM_DEFINITIONS)) {
            if (room.mapPath) this.load.tilemapTiledJSON(room.mapKey, room.mapPath);
            for (const tileset of room.tilesets) {
                if (loadedTextures.has(tileset.textureKey)) continue;
                loadedTextures.add(tileset.textureKey);
                this.load.image(tileset.textureKey, tileset.path);
            }
        }

        for (const { texture, path } of Object.values(CHARACTERS)) {
            this.load.spritesheet(texture, path, { frameWidth: 38, frameHeight: 38 });
        }

        this.load.spritesheet(
            'drone-fly',
            'assets/enemies/drone-robot_nyknck/drone-robot_nyknck.png',
            { frameWidth: 32, frameHeight: 32 }
        );

        this.load.spritesheet(
            'scooter-drive',
            'assets/enemies/patinete-autonomo/patinete-autonomo.png',
            { frameWidth: 32, frameHeight: 32 }
        );

        this.load.spritesheet(
            'electric-bike',
            'assets/enemies/bicicleta-eletrica/bicicleta-eletrica.png',
            { frameWidth: 32, frameHeight: 32 }
        );

        this.load.spritesheet(
            'cyber-guard-walk',
            'assets/enemies/guarda-municipal-cyber/guarda-municipal-cyber.png',
            { frameWidth: 32, frameHeight: 32 }
        );

        this.load.spritesheet(
            'gaucho-walk',
            'assets/enemies/gaucho-escape/gaucho_robotico/walk.png',
            { frameWidth: 32, frameHeight: 40 }
        );
        const { skaters, merchants, couple } = MERCADO_NPCS;
        this.load.spritesheet(skaters.texture, skaters.path, { frameWidth: skaters.frameWidth, frameHeight: skaters.frameHeight });
        this.load.spritesheet(merchants.texture, merchants.path, { frameWidth: merchants.frameWidth, frameHeight: merchants.frameHeight });
        this.load.spritesheet(couple.texture, couple.path, { frameWidth: couple.frameWidth, frameHeight: couple.frameHeight });
        this.load.image(WALLET_UI.walletTexture, WALLET_UI.walletPath);
        this.load.image(WALLET_UI.cardTexture, WALLET_UI.cardPath);
        this.load.spritesheet(TICEN_GATE.texture, TICEN_GATE.path, { frameWidth: TICEN_GATE.frameSize, frameHeight: TICEN_GATE.frameSize });
        this.load.spritesheet(TICEN_GATE.originalTexture, TICEN_GATE.originalPath, { frameWidth: TICEN_GATE.frameSize, frameHeight: TICEN_GATE.frameSize });
        this.load.spritesheet(TOPAZIO_BOSS.texture, TOPAZIO_BOSS.path, { frameWidth: TOPAZIO_BOSS.frameSize, frameHeight: TOPAZIO_BOSS.frameSize });
        this.load.spritesheet(TOPAZIO_BOSS.shardTexture, TOPAZIO_BOSS.shardPath, { frameWidth: TOPAZIO_BOSS.shardFrameSize, frameHeight: TOPAZIO_BOSS.shardFrameSize });
        this.load.image(TOPAZIO_BOSS.gemTexture, TOPAZIO_BOSS.gemPath);
        const { interior } = TICEN_ESCAPE;
        this.load.image(interior.texture, interior.path);
        this.load.image(interior.frontTexture, interior.frontPath);
        this.load.image(interior.viewTexture, interior.viewPath);
        this.load.image(interior.skyTexture, interior.skyPath);
        this.load.image(interior.passengersTexture, interior.passengersPath);
        const { driver, chest } = TICEN_DUEL;
        this.load.spritesheet(driver.texture, driver.path, { frameWidth: driver.frameWidth, frameHeight: driver.frameHeight });
        this.load.spritesheet(chest.texture, chest.path, { frameWidth: chest.frameWidth, frameHeight: chest.frameHeight });
        this.load.spritesheet(TCHAY.peopleTexture, TCHAY.peoplePath, { frameWidth: TCHAY.frameWidth, frameHeight: TCHAY.frameHeight });
        this.load.image(TCHAY.signTexture, TCHAY.signPath);
        this.load.spritesheet(POPULAR_BARS.texture, POPULAR_BARS.path, { frameWidth: POPULAR_BARS.frameWidth, frameHeight: POPULAR_BARS.frameHeight });
        this.load.spritesheet(PAGODE.texture, PAGODE.path, { frameWidth: PAGODE.frameSize, frameHeight: PAGODE.frameSize });
        this.load.image(PAGODE.tableTexture, PAGODE.tablePath);
        this.load.image('chimarrao', 'assets/items/chimarrao.png');
        this.load.image('manhole', 'assets/props/manhole.png');
        this.load.image('sword', 'assets/items/sword.png');
        this.load.spritesheet('sword-hit', 'assets/effects/sword-hit.png', { frameWidth: 18, frameHeight: 16 });

        this.load.spritesheet(DRONE_EXPLOSION.texture, DRONE_EXPLOSION.path, {
            frameWidth: DRONE_EXPLOSION.frameWidth,
            frameHeight: DRONE_EXPLOSION.frameHeight
        });

        this.load.audio(
            AUDIO_CONFIG.effects.playerFootstep.key,
            AUDIO_CONFIG.effects.playerFootstep.path
        );


        this.load.audio(
            AUDIO_CONFIG.effects.playerHurt.key,
            AUDIO_CONFIG.effects.playerHurt.path
        );

        this.load.audio(
            AUDIO_CONFIG.effects.droneExplosion.key,
            AUDIO_CONFIG.effects.droneExplosion.path
        );

        this.load.audio(
            AUDIO_CONFIG.effects.playerDeath.key,
            AUDIO_CONFIG.effects.playerDeath.path
        );

        for (const { key, path } of [AUDIO_CONFIG.effects.golemRoar, AUDIO_CONFIG.effects.golemSlam, AUDIO_CONFIG.effects.golemSpin]) {
            this.load.audio(key, path);
        }

        this.load.audio(
            AUDIO_CONFIG.effects.playerShot.key,
            AUDIO_CONFIG.effects.playerShot.path,
            { instances: 4 }
        );

        this.load.audio(
            AUDIO_CONFIG.effects.enemyShot.key,
            AUDIO_CONFIG.effects.enemyShot.path,
            { instances: 24 }
        );

        this.load.audio(
            AUDIO_CONFIG.effects.waveThreat.key,
            AUDIO_CONFIG.effects.waveThreat.path
        );

        this.load.audio(
            AUDIO_CONFIG.music.mainMenu.key,
            AUDIO_CONFIG.music.mainMenu.path
        );

        this.load.audio(
            AUDIO_CONFIG.music.room1.key,
            AUDIO_CONFIG.music.room1.path
        );
    }

    create() {
        const route = getInitialSceneRoute();
        if (route.key === 'RoomTransition') {
            const continuation = loadCampaignProgress();
            if (continuation?.run) runTracker.restore(continuation.run);
            else runTracker.startNew('SINGLE_PLAYER');
            this.scene.start(route.key, {
                ...route.data,
                ...(continuation ? { playerProgress: continuation.playerProgress } : {})
            });
            return;
        }
        this.scene.start(route.key, route.data);
    }
}
