import type { Scene } from 'phaser';
import { WORLD_CONFIG } from '../config/world';

export function configureWorldCamera(
    scene: Scene,
    map: Phaser.Tilemaps.Tilemap,
    target: Phaser.GameObjects.GameObject
) {
    const camera = scene.cameras.main;

    camera.setBackgroundColor('#011418');
    camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    camera.setZoom(WORLD_CONFIG.camera.zoom);
    camera.startFollow(target, true, WORLD_CONFIG.camera.lerpX, WORLD_CONFIG.camera.lerpY);
    camera.setRoundPixels(true);
}
