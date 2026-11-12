export type RoomKey = 'room1' | 'room2' | 'room3' | 'room4' | 'room5' | 'room51' | 'mercado-interior' | 'dungeon' | 'gaucho-dungeon';

/** Sala V (cores originais) e a versão guardada na paleta cyberpunk das Salas I e II (`?room=51`). */
export function isTicenRoom(roomKey: RoomKey) {
    return roomKey === 'room5' || roomKey === 'room51';
}

export function isDungeonRoom(roomKey: RoomKey) {
    return roomKey === 'dungeon' || roomKey === 'gaucho-dungeon';
}

export interface RoomTilesetDefinition {
    mapName: string;
    textureKey: string;
    path: string;
}

export interface RoomDefinition {
    mapKey: RoomKey;
    mapPath?: string;
    title: string;
    spawn: Readonly<{ x: number; y: number }>;
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

const ROOM2_TILESETS = [
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
    },
    {
        mapName: 'terminal-placa-pendente-3x3',
        textureKey: 'terminal-placa-pendente-3x3',
        path: 'assets/props/terminal-placa-pendente-3x3.png'
    },
    {
        mapName: 'curva-faixa-rua-256',
        textureKey: 'curva-faixa-rua-256',
        path: 'assets/tilesets/curva-faixa-rua-256.png'
    }
] as const;

// A Praça XV repete os tilesets da Sala II na mesma ordem e acrescenta os seus.
const ROOM3_TILESETS = [
    ...ROOM2_TILESETS,
    { mapName: 'praca_xv_itens', textureKey: 'praca_xv_itens', path: 'assets/tilesets/praca_xv_itens.png' },
    { mapName: 'figueira_copa', textureKey: 'figueira_copa', path: 'assets/tilesets/figueira_copa.png' },
    { mapName: 'figueira_tronco', textureKey: 'figueira_tronco', path: 'assets/tilesets/figueira_tronco.png' },
    { mapName: 'catedral', textureKey: 'catedral', path: 'assets/tilesets/catedral.png' },
    { mapName: 'catedral_predio', textureKey: 'catedral_predio', path: 'assets/tilesets/catedral_predio.png' },
    { mapName: 'catedral_escadaria', textureKey: 'catedral_escadaria', path: 'assets/tilesets/catedral_escadaria.png' },
    { mapName: 'praca_canteiros', textureKey: 'praca_canteiros', path: 'assets/tilesets/praca_canteiros.png' },
    { mapName: 'monumento', textureKey: 'monumento', path: 'assets/tilesets/monumento.png' },
    { mapName: 'pergola_modulo', textureKey: 'pergola_modulo', path: 'assets/tilesets/pergola_modulo.png' },
    { mapName: 'poste_3_globos', textureKey: 'poste_3_globos', path: 'assets/tilesets/poste_3_globos.png' },
    { mapName: 'pedra_placa', textureKey: 'pedra_placa', path: 'assets/tilesets/pedra_placa.png' },
    { mapName: 'praca_detalhes_tiles', textureKey: 'praca_detalhes_tiles', path: 'assets/tilesets/praca_detalhes_tiles.png' },
    { mapName: 'paredao_tiles', textureKey: 'paredao_tiles', path: 'assets/tilesets/paredao_tiles.png' },
    { mapName: 'antena', textureKey: 'antena', path: 'assets/tilesets/antena.png' },
    { mapName: 'pichacao', textureKey: 'pichacao', path: 'assets/tilesets/pichacao.png' },
    { mapName: 'letreiro_farmacia', textureKey: 'letreiro_farmacia', path: 'assets/tilesets/letreiro_farmacia.png' },
    { mapName: 'letreiro_farmacia', textureKey: 'letreiro_farmacia', path: 'assets/tilesets/letreiro_farmacia.png' },
    { mapName: 'neon_bar', textureKey: 'neon_bar', path: 'assets/tilesets/neon_bar.png' },
    { mapName: 'outdoor_floria', textureKey: 'outdoor_floria', path: 'assets/tilesets/outdoor_floria.png' }
] as const;

// Ordem igual à do room4.json (gerado por assets/mercado-publico/gen_room4_map.py).
const ROOM4_TILESETS = [
    { mapName: 'mercado_piso', textureKey: 'mercado_piso', path: 'assets/tilesets/mercado_piso.png' },
    { mapName: 'curva-faixa-rua-256', textureKey: 'curva-faixa-rua-256', path: 'assets/tilesets/curva-faixa-rua-256.png' },
    { mapName: 'mercado_fachada', textureKey: 'mercado_fachada', path: 'assets/tilesets/mercado_fachada.png' },
    { mapName: 'mercado_itens', textureKey: 'mercado_itens', path: 'assets/tilesets/mercado_itens.png' },
    { mapName: 'poste_3_globos', textureKey: 'poste_3_globos', path: 'assets/tilesets/poste_3_globos.png' },
    { mapName: 'ticen_sujeira', textureKey: 'ticen_sujeira', path: 'assets/tilesets/ticen_sujeira.png' }
] as const;

// Ordem igual à do room5.json (gerado por assets/ticen/gen_room5_map.py).
const ROOM5_TILESETS = [
    { mapName: 'ticen_piso', textureKey: 'ticen_piso', path: 'assets/tilesets/ticen_piso.png' },
    { mapName: 'ticen_fachada', textureKey: 'ticen_fachada', path: 'assets/tilesets/ticen_fachada.png' },
    { mapName: 'ticen_onibus', textureKey: 'ticen_onibus', path: 'assets/tilesets/ticen_onibus.png' },
    { mapName: 'ticen_itens', textureKey: 'ticen_itens', path: 'assets/tilesets/ticen_itens.png' },
    { mapName: 'ticen_quiosques', textureKey: 'ticen_quiosques', path: 'assets/tilesets/ticen_quiosques.png' },
    { mapName: 'ticen_recarga', textureKey: 'ticen_recarga', path: 'assets/tilesets/ticen_recarga.png' },
    { mapName: 'ticen_sujeira', textureKey: 'ticen_sujeira', path: 'assets/tilesets/ticen_sujeira.png' },
    // Reaproveitados das salas anteriores (mesmas texturas já carregadas por elas).
    { mapName: 'objects_and_items-01', textureKey: 'objects', path: 'assets/tilesets/objects_and_items-01.png' }
] as const;

// Sala V com as cores originais (folhas `*_original.png`, geradas com --original). A versão na paleta
// cyberpunk das Salas I e II fica guardada em ?room=51, com o mesmo mapa.
const ROOM5_ORIGINAL_TILESETS = ROOM5_TILESETS.map((tileset) => tileset.mapName.startsWith('ticen_')
    ? { ...tileset, textureKey: `${tileset.textureKey}_original`, path: tileset.path.replace('.png', '_original.png') }
    : tileset);

export const ROOM_DEFINITIONS: Record<RoomKey, RoomDefinition> = {
    room1: {
        mapKey: 'room1',
        mapPath: 'assets/maps/room01.json',
        title: 'Sala I',
        spawn: { x: 400, y: 536 },
        tilesets: SHARED_TILESETS
    },
    room2: {
        mapKey: 'room2',
        mapPath: 'assets/maps/room2.json',
        title: 'Sala II: O Antigo Terminal',
        spawn: { x: 184, y: 536 },
        tilesets: ROOM2_TILESETS
    },
    room3: {
        mapKey: 'room3',
        mapPath: 'assets/maps/room3.json',
        title: 'Sala III: A Praça XV',
        // Continua a rua que sai pela direita da Sala II: entra pela borda esquerda.
        spawn: { x: 6 * 16, y: 20 * 16 },
        tilesets: ROOM3_TILESETS
    },
    room4: {
        mapKey: 'room4',
        mapPath: 'assets/maps/room4.json',
        title: 'Sala IV: O Mercado Público',
        // Mercado Público: entra pela rua, na borda esquerda.
        spawn: { x: 24, y: 20 * 16 },
        tilesets: ROOM4_TILESETS
    },
    room5: {
        mapKey: 'room5',
        mapPath: 'assets/maps/room5.json',
        title: 'Sala V: O TICEN',
        // TICEN: chega pela calçada da Av. Paulo Fontes, diante da catraca fechada.
        spawn: { x: 24 * 16, y: 44 * 16 + 8 },
        tilesets: ROOM5_ORIGINAL_TILESETS
    },
    room51: {
        mapKey: 'room51',
        mapPath: 'assets/maps/room5.json',
        title: 'Sala V (cyberpunk)',
        // Fora do fluxo do jogo: só abre pela URL em desenvolvimento, como alternativa guardada.
        spawn: { x: 24 * 16, y: 44 * 16 + 8 },
        tilesets: ROOM5_TILESETS
    },
    'mercado-interior': {
        mapKey: 'mercado-interior',
        mapPath: 'assets/maps/mercado-interior.json',
        title: 'Mercado Público',
        // Logo depois da porta, fora da área que devolve ao Largo, na linha do fliperama.
        spawn: { x: 40, y: 140 },
        tilesets: [
            { mapName: 'mercado_interior', textureKey: 'mercado_interior', path: 'assets/tilesets/mercado_interior.png' },
            { mapName: 'mercado_itens', textureKey: 'mercado_itens', path: 'assets/tilesets/mercado_itens.png' }
        ]
    },
    dungeon: {
        mapKey: 'dungeon',
        title: 'Subsolo do Terminal',
        // A primeira sala procedural sempre é escavada ao redor deste ponto.
        spawn: { x: 88, y: 328 },
        tilesets: [
            {
                mapName: 'neo-zero-dungeon-tiles',
                textureKey: 'neo-zero-dungeon-tiles',
                path: 'assets/tilesets/neo-zero-dungeon-tiles.png'
            },
            {
                mapName: 'neo-zero-dungeon-props',
                textureKey: 'neo-zero-dungeon-props',
                path: 'assets/tilesets/neo-zero-dungeon-props.png'
            }
        ]
    },
    'gaucho-dungeon': {
        mapKey: 'gaucho-dungeon',
        title: 'Esconderijo dos Gaúchos',
        spawn: { x: 88, y: 328 },
        tilesets: []
    }
};

export function getRequestedRoomKey(
    search = typeof window === 'undefined' ? '' : window.location.search
): RoomKey {
    const requestedRoom = new URLSearchParams(search).get('room');
    if (requestedRoom === 'dungeon' || requestedRoom === 'gaucho-dungeon') return requestedRoom;
    if (requestedRoom === '3' || requestedRoom === 'room3') return 'room3';
    if (requestedRoom === '4' || requestedRoom === 'room4') return 'room4';
    if (requestedRoom === '5' || requestedRoom === 'room5') return 'room5';
    if (requestedRoom === '51' || requestedRoom === 'room51') return 'room51';
    if (requestedRoom === 'mercado' || requestedRoom === 'mercado-interior') return 'mercado-interior';
    return requestedRoom === '2' || requestedRoom === 'room2' ? 'room2' : 'room1';
}

/**
 * Atalho de teste do multiplayer: `?start=5` leva a dupla direto para a sala pedida.
 * O `room` não serve aqui porque no multiplayer ele é o nome da partida.
 */
export function getMultiplayerStartRoom(
    search = typeof window === 'undefined' ? '' : window.location.search
): RoomKey {
    const start = new URLSearchParams(search).get('start');
    return start ? getRequestedRoomKey(`?room=${encodeURIComponent(start)}`) : 'room1';
}

export function getRoomSearch(roomKey: RoomKey, search = '') {
    const parameters = new URLSearchParams(search);
    if (roomKey === 'room1') parameters.delete('room');
    else parameters.set('room', roomKey === 'room2' ? '2' : roomKey === 'room3' ? '3' : roomKey === 'room4' ? '4' : roomKey === 'room5' ? '5' : roomKey === 'room51' ? '51' : roomKey);
    const serialized = parameters.toString();
    return serialized ? `?${serialized}` : '';
}

/** Mantém recarregamentos e links compatíveis com a sala atualmente aberta. */
export function replaceRequestedRoomKey(roomKey: RoomKey) {
    if (typeof window === 'undefined') return;
    const search = getRoomSearch(roomKey, window.location.search);
    window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`);
}
