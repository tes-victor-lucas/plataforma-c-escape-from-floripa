export type RoomKey = 'room1' | 'room2';

export interface RoomTilesetDefinition {
    mapName: string;
    textureKey: string;
    path: string;
}

export interface RoomDefinition {
    mapKey: RoomKey;
    mapPath: string;
    tilesets: readonly RoomTilesetDefinition[];
}

const SHARED_TILESETS = [
    {
        mapName: 'floor_and_buildings-01',
        textureKey: 'floor_and_buildings',
        path: 'assets/tilesets/floor_and_buildings-01.png'
    },
    {
        mapName: 'floor_and_walls-1',
        textureKey: 'floor_and_walls',
        path: 'assets/tilesets/floor_and_walls-1.png'
    },
    {
        mapName: 'objects_and_items-01',
        textureKey: 'objects',
        path: 'assets/tilesets/objects_and_items-01.png'
    }
] as const;

export const ROOM_DEFINITIONS: Record<RoomKey, RoomDefinition> = {
    room1: {
        mapKey: 'room1',
        mapPath: 'assets/maps/room01.json',
        tilesets: SHARED_TILESETS
    },
    room2: {
        mapKey: 'room2',
        mapPath: 'assets/maps/room2.json',
        tilesets: [
            ...SHARED_TILESETS,
            {
                mapName: 'centro-cultural-marinha-facade',
                textureKey: 'centro-cultural-marinha-facade',
                path: 'assets/props/centro-cultural-marinha-facade.png'
            },
            {
                mapName: 'centro-cultural-marinha-facade-18x12',
                textureKey: 'centro-cultural-marinha-facade-18x12',
                path: 'assets/props/centro-cultural-marinha-facade-18x12.png'
            },
            {
                mapName: 'centro-cultural-marinha-facade-v2-18x12',
                textureKey: 'centro-cultural-marinha-facade-v2-18x12',
                path: 'assets/props/centro-cultural-marinha-facade-v2-18x12.png'
            },
            {
                mapName: 'piranhas-bar-facade-12x8',
                textureKey: 'piranhas-bar-facade-12x8',
                path: 'assets/props/piranhas-bar-facade-12x8.png'
            },
            {
                mapName: 'piranhas-bar-facade-11x7',
                textureKey: 'piranhas-bar-facade-11x7',
                path: 'assets/props/piranhas-bar-facade-11x7.png'
            },
            {
                mapName: 'piranhas-bar-facade-12x8',
                textureKey: 'piranhas-bar-facade-12x8',
                path: 'assets/props/piranhas-bar-facade-12x8.png'
            },
            {
                mapName: 'piranhas-bar-sign-18x6',
                textureKey: 'piranhas-bar-sign-18x6',
                path: 'assets/props/piranhas-bar-sign-18x6.png'
            },
            {
                mapName: 'piranhas-bar-facade-12x8',
                textureKey: 'piranhas-bar-facade-12x8',
                path: 'assets/props/piranhas-bar-facade-12x8.png'
            },
            {
                mapName: 'terminal-antigo-modular-v2-256',
                textureKey: 'terminal-antigo-modular-v2-256',
                path: 'assets/tilesets/terminal-antigo-modular-v2-256.png'
            },
            {
                mapName: 'terminal-antigo-modular-v3-224',
                textureKey: 'terminal-antigo-modular-v3-224',
                path: 'assets/tilesets/terminal-antigo-modular-v3-224.png'
            },
            {
                mapName: 'terminal-antigo-props-256',
                textureKey: 'terminal-antigo-props-256',
                path: 'assets/tilesets/terminal-antigo-props-256.png'
            },
            {
                mapName: 'mural-franklin-cascaes-8x12',
                textureKey: 'mural-franklin-cascaes-8x12',
                path: 'assets/props/mural-franklin-cascaes-8x12.png'
            },
            {
                mapName: 'mural-cruz-e-sousa-8x12',
                textureKey: 'mural-cruz-e-sousa-8x12',
                path: 'assets/props/mural-cruz-e-sousa-8x12.png'
            }
        ]
    }
};

export function getRequestedRoomKey(search = window.location.search): RoomKey {
    const requestedRoom = new URLSearchParams(search).get('room');
    return requestedRoom === '2' || requestedRoom === 'room2' ? 'room2' : 'room1';
}
