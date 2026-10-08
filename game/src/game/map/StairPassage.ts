export interface StairPassageArea {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface StairPassageDefinition {
    minTileX: number;
    maxTileX: number;
    minTileY: number;
    maxTileY: number;
}

export const ROOM2_STAIR_PASSAGE: StairPassageDefinition = {
    minTileX: 8,
    maxTileX: 18,
    minTileY: 15,
    maxTileY: 21
};

export function toStairPassageArea(
    tileWidth: number,
    tileHeight: number,
    passage: StairPassageDefinition = ROOM2_STAIR_PASSAGE
): StairPassageArea {
    return {
        left: passage.minTileX * tileWidth,
        right: (passage.maxTileX + 1) * tileWidth,
        top: passage.minTileY * tileHeight,
        bottom: (passage.maxTileY + 1) * tileHeight
    };
}

/** 0 representa o pé da escada e 1 o patamar superior. */
export function getStairProgress(x: number, y: number, area: StairPassageArea) {
    if (x < area.left || x > area.right || y < area.top || y > area.bottom) return null;
    const height = area.bottom - area.top;
    return height > 0 ? Math.min(1, Math.max(0, (area.bottom - y) / height)) : 0;
}
