import { Geom } from 'phaser';

/** Compartilha a mesma visibilidade entre perseguição e disparos. */
export function hasLineOfSight(
    walls: Phaser.Tilemaps.TilemapLayer[],
    from: { x: number; y: number },
    to: { x: number; y: number }
) {
    const line = new Geom.Line(from.x, from.y, to.x, to.y);
    return !walls.some((layer) => layer.getTilesWithinWorldXY(
        Math.min(from.x, to.x), Math.min(from.y, to.y),
        Math.abs(from.x - to.x) || 1, Math.abs(from.y - to.y) || 1,
        { isColliding: true }
    ).some((tile) => Geom.Intersects.LineToRectangle(line, new Geom.Rectangle(
        tile.getLeft(), tile.getTop(), tile.width, tile.height
    ))));
}
