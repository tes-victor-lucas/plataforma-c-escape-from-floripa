import type { Tilemaps } from 'phaser';

const EXIT_BLOCKERS = new Set(['objectos-block-back', 'objects-block']);
// Corredor da camada street que chega à borda superior da Sala I (em tiles).
const EXIT_PASSAGE = { x: 9, y: 0, width: 4, height: 4 };

/** Remove as barricadas e a colisão escondida sob o piso da saída. */
export function openRoomExit(layers: Tilemaps.TilemapLayer[]) {
    for (const layer of layers) {
        if (EXIT_BLOCKERS.has(layer.layer.name)) {
            layer.setCollisionByExclusion([], false);
            layer.setVisible(false);
        } else if (layer.layer.name === 'wall-stores') {
            const { x, y, width, height } = EXIT_PASSAGE;
            // Não desabilita os mesmos índices de tile no restante das paredes.
            layer.forEachTile((tile) => tile.resetCollision(false), undefined, x, y, width, height);
            layer.calculateFacesWithin(x - 1, y, width + 2, height + 1);
        }
    }
}
