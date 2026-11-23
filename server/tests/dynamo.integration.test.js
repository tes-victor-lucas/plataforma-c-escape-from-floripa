import assert from 'node:assert/strict';
import { before, test } from 'node:test';

// Roda contra o DynamoDB Local: docker run -p 8000:8000 amazon/dynamodb-local
// e DYNAMODB_ENDPOINT=http://localhost:8000 npm test. Sem a variável, os testes são pulados.
const endpoint = process.env.DYNAMODB_ENDPOINT;
const options = { skip: !endpoint && 'defina DYNAMODB_ENDPOINT para usar o DynamoDB Local' };
let multiplayer;
let store;

before(async () => {
    if (!endpoint) return;
    Object.assign(process.env, {
        TABLE_NAME: `multiplayer-${Date.now()}`,
        AWS_REGION: 'sa-east-1',
        AWS_ACCESS_KEY_ID: 'local',
        AWS_SECRET_ACCESS_KEY: 'local'
    });
    const { CreateTableCommand, DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    // Mesmo esquema da tabela criada pelo Pulumi.
    await new DynamoDBClient({ endpoint }).send(new CreateTableCommand({
        TableName: process.env.TABLE_NAME,
        BillingMode: 'PAY_PER_REQUEST',
        KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
        AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }]
    }));
    multiplayer = await import('../src/multiplayer.js');
    ({ store } = await import('../src/lambda/aws.js'));
});

function setup() {
    const sent = [];
    const context = { store, send: async (clientId, message) => { sent.push({ clientId, message }); } };
    const types = (clientId) => sent.filter((event) => event.clientId === clientId).map(({ message }) => message.type);
    return { context, sent, types };
}

test('dupla entra, inicia a partida e o estado chega só ao parceiro', options, async () => {
    const { context, sent, types } = setup();
    await multiplayer.join(context, 'a1', 'sala-1');
    await multiplayer.join(context, 'a2', 'sala-1');
    await multiplayer.join(context, 'a3', 'sala-1');

    assert.ok(types('a1').includes('match.ready'));
    assert.ok(types('a2').includes('match.ready'));
    assert.deepEqual(types('a3'), ['lobby.rejected']);

    sent.length = 0;
    await multiplayer.relayState(context, 'a1', {
        sequence: 1, x: 1, y: 2, facing: 'up', health: 4, maxHealth: 4, reviveProgress: 0, revivesLeft: 2
    });
    assert.deepEqual(sent.map(({ clientId }) => clientId), ['a2']);

    sent.length = 0;
    await multiplayer.leave(context, 'a2');
    assert.deepEqual(sent.map(({ clientId, message }) => [clientId, message.type]), [['a1', 'player.left']]);
    await multiplayer.join(context, 'a4', 'sala-1');
    assert.deepEqual(types('a4'), ['lobby.rejected'], 'Partida iniciada não reabre');
});

test('três entradas ao mesmo tempo deixam só dois na sala', options, async () => {
    const { context, types } = setup();
    await Promise.all(['b1', 'b2', 'b3'].map((clientId) => multiplayer.join(context, clientId, 'sala-2')));
    const rejected = ['b1', 'b2', 'b3'].filter((clientId) => types(clientId).includes('lobby.rejected'));
    assert.equal(rejected.length, 1);
});

test('lista só salas esperando parceiro e apaga a sala vazia', options, async () => {
    const { context, sent } = setup();
    await multiplayer.join(context, 'c1', 'sala-3');
    const rooms = async () => {
        sent.length = 0;
        await multiplayer.listRooms(context, 'visitante');
        return sent[0].message.rooms;
    };
    assert.ok((await rooms()).includes('sala-3'));
    await multiplayer.leave(context, 'c1');
    assert.ok(!(await rooms()).includes('sala-3'));
    await multiplayer.join(context, 'c2', 'sala-3');
    assert.ok((await rooms()).includes('sala-3'), 'Sala apagada pode ser criada de novo');
});
