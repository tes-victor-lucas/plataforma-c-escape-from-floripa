import type { Scene } from 'phaser';

export function playDamageNumber(scene: Scene, x: number, y: number, damage: number) {
    const rounded = Math.round(damage * 10) / 10;
    const label = scene.add.text(x, y - 10, `-${rounded}`, {
        fontFamily: 'monospace',
        fontStyle: 'bold',
        fontSize: '8px',
        color: '#fff2a8',
        stroke: '#451010',
        strokeThickness: 2
    }).setOrigin(0.5).setDepth(35);

    scene.tweens.add({
        targets: label,
        y: label.y - 12,
        alpha: 0,
        duration: 480,
        ease: 'Sine.Out',
        onComplete: () => label.destroy()
    });
}
