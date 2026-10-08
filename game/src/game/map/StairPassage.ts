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
    minTileX: 12,
    maxTileX: 15,
    minTileY: 15,
    maxTileY: 21
};

export const ROOM2_STAIR_CLEARANCE: StairPassageDefinition = {
    ...ROOM2_STAIR_PASSAGE,
    maxTileY: 24
};

/** As partes laterais desenhadas na layer stairs são rampas/grades, não passagem. */
export function isOutsideStairPassage(
    tileX: number,
    tileY: number,
    passage: StairPassageDefinition = ROOM2_STAIR_PASSAGE
) {
    const isOnStairHeight = tileY >= passage.minTileY && tileY <= passage.maxTileY;
    const isInCentralCorridor = tileX >= passage.minTileX && tileX <= passage.maxTileX;
    return isOnStairHeight && !isInCentralCorridor;
}

/** Corredor que conecta o pé da escada ao patamar, incluindo sua aproximação. */
export function isInsideStairClearance(
    tileX: number,
    tileY: number,
    clearance: StairPassageDefinition = ROOM2_STAIR_CLEARANCE
) {
    return tileX >= clearance.minTileX && tileX <= clearance.maxTileX
        && tileY >= clearance.minTileY && tileY <= clearance.maxTileY;
}

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
