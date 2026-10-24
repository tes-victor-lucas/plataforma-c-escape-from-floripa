import type { RoomKey } from './rooms';

export type RoomGatewayDefinition = {
    from: RoomKey;
    to: RoomKey;
    area: Readonly<{ left: number; right: number; top: number; bottom: number }>;
    portal: Readonly<{ x: number; y: number }>;
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

/** Fresta escondida na última parede, e não em toda a lateral do Terminal Velho. */
export const ROOM2_TO_DUNGEON_GATEWAY: RoomGatewayDefinition = {
    from: 'room2',
    to: 'dungeon',
    area: {
        left: 44 * 16,
        right: 45 * 16,
        top: 27 * 16,
        bottom: 29 * 16
    },
    portal: { x: 45 * 16 - 2, y: 28 * 16 }
};

export const DUNGEON_RETURN_SPAWN = { x: 43.5 * 16, y: 28 * 16 } as const;

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
    isBlockedOnRight: boolean
) {
    return isBlockedOnRight && isInsideRoomGateway(x, y, ROOM2_TO_DUNGEON_GATEWAY);
}

export function isTouchingDungeonReturn(
    x: number,
    y: number,
    area: Readonly<{ left: number; right: number; top: number; bottom: number }>
) {
    return x >= area.left && x <= area.right
        && y >= area.top && y <= area.bottom;
}
