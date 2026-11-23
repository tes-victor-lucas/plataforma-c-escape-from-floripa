import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { MAX_PLAYERS } from '../multiplayer.js';

// O SDK já vem no runtime nodejs22.x da Lambda: o pacote de cada função leva só o próprio código.
const TableName = process.env.TABLE_NAME;
// DYNAMODB_ENDPOINT só existe no teste de integração, que usa o DynamoDB Local.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.DYNAMODB_ENDPOINT }));
const api = new ApiGatewayManagementApiClient({ endpoint: process.env.CALLBACK_URL });
const roomKey = (roomId) => ({ pk: `ROOM#${roomId}` });
const clientKey = (clientId) => ({ pk: `CONN#${clientId}` });
// Uma conexão do API Gateway dura no máximo 2 h; o TTL limpa o que um $disconnect perdido deixar.
const expiresAt = () => Math.floor(Date.now() / 1000) + 3 * 3600;
// O parceiro não muda depois que a partida começa: guardar evita uma leitura no DynamoDB por mensagem.
const peers = new Map();

const isConditionFailure = (error) => error.name === 'ConditionalCheckFailedException';

export const store = {
    async getRoom(clientId) {
        const { Item } = await db.send(new GetCommand({ TableName, Key: clientKey(clientId) }));
        return Item?.roomId;
    },

    /** A condição é avaliada pelo DynamoDB, então dois jogadores entrando juntos não passam de dois. */
    async tryJoin(roomId, clientId) {
        try {
            const { Attributes } = await db.send(new UpdateCommand({
                TableName,
                Key: roomKey(roomId),
                UpdateExpression: 'SET players = list_append(if_not_exists(players, :empty), :me), '
                    + 'roomId = :room, started = if_not_exists(started, :false), expiresAt = :ttl',
                ConditionExpression: 'attribute_not_exists(pk) OR (size(players) < :max AND started = :false)',
                ExpressionAttributeValues: {
                    ':empty': [], ':me': [clientId], ':room': roomId, ':false': false, ':max': MAX_PLAYERS, ':ttl': expiresAt()
                },
                ReturnValues: 'ALL_NEW'
            }));
            await db.send(new PutCommand({ TableName, Item: { ...clientKey(clientId), roomId, expiresAt: expiresAt() } }));
            return Attributes.players;
        } catch (error) {
            if (isConditionFailure(error)) return undefined;
            throw error;
        }
    },

    async start(roomId, [first, second]) {
        const setPeer = (clientId, peer) => db.send(new UpdateCommand({
            TableName, Key: clientKey(clientId), UpdateExpression: 'SET peer = :peer', ExpressionAttributeValues: { ':peer': peer }
        }));
        await Promise.all([
            db.send(new UpdateCommand({
                TableName, Key: roomKey(roomId), UpdateExpression: 'SET started = :true', ExpressionAttributeValues: { ':true': true }
            })),
            setPeer(first, second),
            setPeer(second, first)
        ]);
    },

    async getPeer(clientId) {
        if (peers.has(clientId)) return peers.get(clientId);
        const { Item } = await db.send(new GetCommand({ TableName, Key: clientKey(clientId) }));
        if (Item?.peer) peers.set(clientId, Item.peer);
        return Item?.peer;
    },

    async leave(clientId) {
        const { Attributes } = await db.send(new DeleteCommand({ TableName, Key: clientKey(clientId), ReturnValues: 'ALL_OLD' }));
        const roomId = Attributes?.roomId;
        if (!roomId) return undefined;
        const { Item } = await db.send(new GetCommand({ TableName, Key: roomKey(roomId), ConsistentRead: true }));
        if (!Item) return undefined;
        // shortcut: dois jogadores saindo no mesmo instante podem deixar um nome a mais na sala; ela já
        // começou, então não aparece na lista e o TTL a apaga. Se virar problema, condicionar a escrita a `players`.
        const players = Item.players.filter((playerId) => playerId !== clientId);
        if (players.length === 0) {
            await db.send(new DeleteCommand({ TableName, Key: roomKey(roomId) }));
            return { roomId, players };
        }
        await db.send(new UpdateCommand({
            TableName, Key: roomKey(roomId), UpdateExpression: 'SET players = :players', ExpressionAttributeValues: { ':players': players }
        }));
        await Promise.all(players.map((playerId) => db.send(new UpdateCommand({
            TableName, Key: clientKey(playerId), UpdateExpression: 'REMOVE peer', ConditionExpression: 'attribute_exists(pk)'
        })).catch((error) => {
            if (!isConditionFailure(error)) throw error;
        })));
        return { roomId, players };
    },

    // shortcut: varre a tabela inteira, que só tem salas e conexões vivas; com muitas salas, criar um índice.
    async openRooms(limit) {
        const rooms = [];
        let ExclusiveStartKey;
        do {
            const page = await db.send(new ScanCommand({
                TableName,
                ExclusiveStartKey,
                FilterExpression: 'begins_with(pk, :room) AND size(players) < :max AND started = :false',
                ProjectionExpression: 'roomId',
                ExpressionAttributeValues: { ':room': 'ROOM#', ':max': MAX_PLAYERS, ':false': false }
            }));
            rooms.push(...page.Items.map((item) => item.roomId));
            ExclusiveStartKey = page.LastEvaluatedKey;
        } while (ExclusiveStartKey && rooms.length < limit);
        return rooms.slice(0, limit);
    }
};

export async function send(clientId, message) {
    try {
        await api.send(new PostToConnectionCommand({ ConnectionId: clientId, Data: JSON.stringify(message) }));
    } catch (error) {
        // O parceiro já desconectou: o $disconnect dele avisa quem ficou.
        if (error.name !== 'GoneException') throw error;
    }
}

export const context = { store, send };
export const connectionId = (event) => event.requestContext.connectionId;
export const body = (event) => JSON.parse(event.body);
export const ok = { statusCode: 200 };

/** Operações críticas em uma linha JSON, para filtrar no CloudWatch Logs Insights. */
export function audit(operation, fields) {
    console.log(JSON.stringify({ operation, ...fields }));
}
