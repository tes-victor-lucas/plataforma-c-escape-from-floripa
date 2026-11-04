import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LobbyAgent } from '../src/agents/LobbyAgent.js';
import { MatchAgent } from '../src/agents/MatchAgent.js';
import { MessageBroker } from '../src/broker/MessageBroker.js';

function setup() {
    const broker = new MessageBroker();
    const sent = [];
    broker.subscribe('transport.send', (event) => sent.push(event));
    const lobby = new LobbyAgent(broker);
    const match = new MatchAgent(broker, lobby);
    lobby.start();
    match.start();
    return { broker, sent };
}

function messagesFor(sent, clientId, type) {
    return sent.filter((event) => event.clientId === clientId && event.message.type === type);
}

test('sala inicia com dois jogadores e rejeita o terceiro', () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2', 'p3']) {
        broker.publish('connection.opened', { clientId });
        broker.publish('client.message', { clientId, message: { type: 'lobby.join', roomId: 'dupla' } });
    }

    assert.equal(messagesFor(sent, 'p1', 'match.ready').length, 1);
    assert.equal(messagesFor(sent, 'p2', 'match.ready').length, 1);
    assert.equal(messagesFor(sent, 'p3', 'lobby.rejected')[0].message.code, 'ROOM_FULL');
});

test('estado válido é enviado apenas ao companheiro da sala', () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2']) {
        broker.publish('connection.opened', { clientId });
        broker.publish('client.message', { clientId, message: { type: 'lobby.join', roomId: 'dupla' } });
    }
    sent.length = 0;

    broker.publish('client.message', {
        clientId: 'p1',
        message: {
            type: 'player.state', sequence: 4, x: 100, y: 200, facing: 'left',
            health: 3, maxHealth: 4, reviveProgress: 0
        }
    });

    assert.equal(messagesFor(sent, 'p1', 'player.state').length, 0);
    assert.deepEqual(messagesFor(sent, 'p2', 'player.state')[0].message, {
        type: 'player.state', playerId: 'p1', sequence: 4, x: 100, y: 200, facing: 'left',
        health: 3, maxHealth: 4, reviveProgress: 0
    });
});

test('estado inválido não é retransmitido', () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2']) {
        broker.publish('connection.opened', { clientId });
        broker.publish('client.message', { clientId, message: { type: 'lobby.join' } });
    }
    sent.length = 0;
    broker.publish('client.message', {
        clientId: 'p1',
        message: {
            type: 'player.state', sequence: 1, x: Infinity, y: 0, facing: 'down',
            health: 4, maxHealth: 4, reviveProgress: 0
        }
    });
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 0);
    assert.equal(messagesFor(sent, 'p1', 'error')[0].message.code, 'INVALID_PLAYER_STATE');
});

function startedRoom() {
    const context = setup();
    for (const clientId of ['p1', 'p2']) {
        context.broker.publish('connection.opened', { clientId });
        context.broker.publish('client.message', { clientId, message: { type: 'lobby.join', roomId: 'dupla' } });
    }
    context.sent.length = 0;
    return context;
}

test('evento conhecido da partida chega somente ao parceiro', () => {
    const { broker, sent } = startedRoom();
    const event = { kind: 'cards.chosen' };
    broker.publish('client.message', { clientId: 'p2', message: { type: 'match.event', event } });

    assert.equal(messagesFor(sent, 'p2', 'match.event').length, 0);
    assert.deepEqual(messagesFor(sent, 'p1', 'match.event')[0].message, {
        type: 'match.event', playerId: 'p2', event
    });
});

test('evento desconhecido ou grande demais não é retransmitido', () => {
    const { broker, sent } = startedRoom();
    for (const event of [
        { kind: 'desconhecido' },
        undefined,
        { kind: 'enemy.snapshot', rows: 'x'.repeat(20_000) }
    ]) {
        broker.publish('client.message', { clientId: 'p1', message: { type: 'match.event', event } });
    }
    assert.equal(messagesFor(sent, 'p2', 'match.event').length, 0);
    assert.equal(messagesFor(sent, 'p1', 'error').length, 3);
});

test('vida acima do máximo invalida o estado do jogador', () => {
    const { broker, sent } = startedRoom();
    broker.publish('client.message', {
        clientId: 'p1',
        message: {
            type: 'player.state', sequence: 1, x: 0, y: 0, facing: 'down',
            health: 5, maxHealth: 4, reviveProgress: 0
        }
    });
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 0);
});

test('partida iniciada não aceita novo jogador depois que alguém sai', () => {
    const { broker, sent } = startedRoom();
    broker.publish('connection.closed', { clientId: 'p2' });
    broker.publish('connection.opened', { clientId: 'p3' });
    broker.publish('client.message', { clientId: 'p3', message: { type: 'lobby.join', roomId: 'dupla' } });
    assert.equal(messagesFor(sent, 'p3', 'lobby.rejected')[0].message.code, 'ROOM_FULL');
});
