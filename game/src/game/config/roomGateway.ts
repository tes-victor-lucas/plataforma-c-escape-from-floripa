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
    area: { left: 9 * 16, right: 13 * 16, top: 0, bottom: 5 * 16 },
    // O halo fica deslocado para o canto superior esquerdo, como luz externa.
    portal: { x: 9.25 * 16, y: 1.25 * 16 }
};

export function isInsideRoomGateway(
    x: number,
    y: number,
    gateway: RoomGatewayDefinition = ROOM1_TO_ROOM2_GATEWAY
) {
    const { area } = gateway;
    return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}
