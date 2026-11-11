import type { Scene } from 'phaser';

/** Flores dos canteiros da Praça XV (Sala III) contaminadas: tom tóxico, brilho e esporos subindo. */
export const RADIOACTIVE_FLOWERS = {
    layer: 'flores',
    tint: 0x6dff96,
    glowColor: 0x66ff88,
    sporeColors: [0x7dff8a, 0x5ce5f1, 0xc6ff4a],
    // Um esporo novo a cada intervalo, de uma flor sorteada.
    sporeInterval: 60,
    sporeRise: [16, 30],
    sporeLifetime: [1_400, 2_200]
} as const;

// Acima do chão e dos canteiros (2), abaixo dos personagens (10).
const GLOW_DEPTH = 3;
// Os esporos sobem por cima de quem passa na frente do canteiro.
const SPORE_DEPTH = 12;

export function createRadioactiveFlowers(scene: Scene, map: Phaser.Tilemaps.Tilemap, random = Math.random) {
    const config = RADIOACTIVE_FLOWERS;
    const data = map.layers.find((layer) => (layer.name.split('/').pop() ?? layer.name) === config.layer);
    const layer = data?.tilemapLayer as Phaser.Tilemaps.TilemapLayer | undefined;
    if (!layer) return [];

    layer.setTint(config.tint);
    const centers: { x: number; y: number }[] = [];
    layer.forEachTile((tile) => {
        if (tile.index < 0) return;
        centers.push({
            x: layer.x + tile.pixelX + tile.width / 2,
            y: layer.y + tile.pixelY + tile.height / 2
        });
    });
    if (centers.length === 0) return centers;

    const glow = scene.add.graphics().setDepth(GLOW_DEPTH).setBlendMode(1);
    for (const { x, y } of centers) {
        glow.fillStyle(config.glowColor, 0.2).fillCircle(x, y, 10);
        glow.fillStyle(config.glowColor, 0.32).fillCircle(x, y, 5);
    }
    scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.45 }, duration: 900, yoyo: true, repeat: -1 });

    const between = ([min, max]: readonly number[]) => min + random() * (max - min);
    scene.time.addEvent({
        delay: config.sporeInterval,
        loop: true,
        callback: () => {
            const from = centers[Math.floor(random() * centers.length)];
            const color = config.sporeColors[Math.floor(random() * config.sporeColors.length)];
            const spore = scene.add.rectangle(from.x + between([-5, 5]), from.y + between([-4, 2]), 2, 2, color)
                .setDepth(SPORE_DEPTH)
                .setBlendMode(1);
            scene.tweens.add({
                targets: spore,
                y: spore.y - between(config.sporeRise),
                x: spore.x + between([-4, 4]),
                alpha: 0,
                duration: between(config.sporeLifetime),
                onComplete: () => spore.destroy()
            });
        }
    });
    return centers;
}
