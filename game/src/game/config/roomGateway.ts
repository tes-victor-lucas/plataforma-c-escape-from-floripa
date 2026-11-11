import type { RoomKey } from './rooms';

export type RoomGatewayDefinition = {
    from: RoomKey;
    to: RoomKey;
    area: Readonly<{ left: number; right: number; top: number; bottom: number }>;
    portal: Readonly<{ x: number; y: number }>;
    /** Parede onde o halo da saída se apoia; sem ela o halo é um círculo inteiro. */
    portalWall?: 'right';
    /** Escala do halo; menor quando a saída é só o fim da rua, sem parede desenhada. */
    portalScale?: number;
};

/** Passagem liberada no topo da Room 1 depois da última onda. */
export const ROOM1_TO_ROOM2_GATEWAY: RoomGatewayDefinition = {
    from: 'room1',
    to: 'room2',
    // A troca de sala só acontece perto do fundo da passagem.
    area: { left: 9 * 16, right: 13 * 16, top: 0, bottom: 2 * 16 },
    // Centraliza somente no eixo horizontal e mantém o halo junto à borda superior.
    portal: { x: 11 * 16, y: 0.25 * 16 }
};

/** Fim da rua na borda direita da Room 2, liberado depois da última horda. */
export const ROOM2_TO_ROOM3_GATEWAY: RoomGatewayDefinition = {
    from: 'room2',
    to: 'room3',
    // O collider ocupa a coluna 45: o centro do jogador para logo antes dela.
    area: { left: 43 * 16, right: 46 * 16, top: 18 * 16, bottom: 22 * 16 },
    // O halo nasce na linha desenhada da parede, na borda direita da coluna 45.
    portal: { x: 46 * 16 - 2, y: 20 * 16 },
    portalWall: 'right'
};

/** Saídas que abrem ao vencer a sala; no máximo uma por sala. */
/** Fim da rua na borda direita da Sala III: segue para o Mercado Público. Mesma parede da Sala II. */
export const ROOM3_TO_ROOM4_GATEWAY: RoomGatewayDefinition = {
    from: 'room3',
    to: 'room4',
    area: { left: 43 * 16, right: 46 * 16, top: 18 * 16, bottom: 22 * 16 },
    portal: { x: 46 * 16 - 2, y: 20 * 16 },
    portalWall: 'right'
};

/** Fim da rua na borda direita da Sala IV: segue pela Paulo Fontes até o TICEN. */
export const ROOM4_TO_ROOM5_GATEWAY: RoomGatewayDefinition = {
    from: 'room4',
    to: 'room5',
    // Sem parede nessa borda: o limite do mundo (x 768) para o jogador.
    area: { left: 45 * 16, right: 48 * 16, top: 18 * 16, bottom: 23 * 16 },
    portal: { x: 48 * 16 - 2, y: 20.5 * 16 },
    portalWall: 'right',
    // Sem parede nessa borda: um halo do tamanho da rua, para não parecer um sol solto.
    portalScale: 0.55
};

export const ROOM_EXIT_GATEWAYS = [ROOM1_TO_ROOM2_GATEWAY, ROOM2_TO_ROOM3_GATEWAY, ROOM3_TO_ROOM4_GATEWAY, ROOM4_TO_ROOM5_GATEWAY];

/** Passagem para uma dungeon: sem parede, basta pisar na área (bueiro); com parede, é preciso encostar nela. */
export type SecretDungeonGateway = RoomGatewayDefinition & {
    wall?: 'left' | 'right' | 'up';
    returnSpawn: Readonly<{ x: number; y: number }>;
    /** Perguntas antes de entrar e de sair; sem elas, a passagem é imediata. */
    confirm?: Readonly<{ enter: string; exit: string }>;
};

/** Fresta escondida na última parede, e não em toda a lateral do Terminal Velho. */
export const ROOM2_TO_DUNGEON_GATEWAY: SecretDungeonGateway = {
    from: 'room2',
    to: 'dungeon',
    wall: 'right',
    returnSpawn: { x: 43.5 * 16, y: 28 * 16 },
    area: {
        left: 44 * 16,
        right: 45 * 16,
        top: 27 * 16,
        bottom: 29 * 16
    },
    portal: { x: 45 * 16 - 2, y: 28 * 16 }
};

/** Bueiro de 2×2 blocos no chão da Room 1; pisar na tampa (sem o aro) leva ao esconderijo. */
export const ROOM1_TO_GAUCHO_DUNGEON_GATEWAY: SecretDungeonGateway = {
    from: 'room1',
    to: 'gaucho-dungeon',
    returnSpawn: { x: 9 * 16, y: 26.5 * 16 },
    // Na briga é fácil pisar no bueiro ou na saída sem querer.
    confirm: { enter: 'ENTRAR NO ESCONDERIJO?', exit: 'SAIR DO ESCONDERIJO?' },
    // A área é testada contra os pés do jogador, que ficam numa hitbox de poucos pixels.
    area: {
        left: 7 * 16 - 12,
        right: 7 * 16 + 12,
        top: 26.5 * 16 - 12,
        bottom: 26.5 * 16 + 12
    },
    portal: { x: 7 * 16, y: 26.5 * 16 }
};

/** Portal central do Mercado Público na Sala IV: encostar nele vindo da calçada leva para dentro. */
export const ROOM4_TO_MERCADO_GATEWAY: SecretDungeonGateway = {
    from: 'room4',
    to: 'mercado-interior',
    wall: 'up',
    returnSpawn: { x: 384, y: 252 },
    // Vão do portal (x 358-410 no mapa); o corpo do jogador encosta na fachada logo abaixo da linha 14.
    area: { left: 364, right: 404, top: 220, bottom: 238 },
    portal: { x: 384, y: 224 }
};

export const SECRET_DUNGEON_GATEWAYS = [ROOM2_TO_DUNGEON_GATEWAY, ROOM1_TO_GAUCHO_DUNGEON_GATEWAY, ROOM4_TO_MERCADO_GATEWAY];

export function isInsideRoomGateway(
    x: number,
    y: number,
    gateway: RoomGatewayDefinition = ROOM1_TO_ROOM2_GATEWAY
) {
    const { area } = gateway;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}

export function isTouchingSecretDungeonEntrance(
    x: number,
    y: number,
    isBlockedAgainstWall: boolean,
    gateway: SecretDungeonGateway = ROOM2_TO_DUNGEON_GATEWAY
) {
    return isBlockedAgainstWall && isInsideRoomGateway(x, y, gateway);
}

export function isTouchingDungeonReturn(
    x: number,
    y: number,
    area: Readonly<{ left: number; right: number; top: number; bottom: number }>
) {
    return x >= area.left && x <= area.right
        && y >= area.top && y <= area.bottom;
}
