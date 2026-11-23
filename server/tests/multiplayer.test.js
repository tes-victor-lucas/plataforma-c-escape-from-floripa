import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStore } from '../src/memoryStore.js';
import { dispatch, isOriginAllowed, leave } from '../src/multiplayer.js';

/** Mesmo papel do transporte: `publish` entrega uma mensagem do cliente, `close` desconecta. */
function setup() {
    const sent = [];
    const context = {
        store: createMemoryStore(),
        async send(clientId, message) {
            sent.push({ clientId, message });
        }
    };
    const broker = {
        publish: (clientId, message) => dispatch(context, clientId, message),
        close: (clientId) => leave(context, clientId)
    };
    return { broker, sent };
}

function messagesFor(sent, clientId, type) {
    return sent.filter((event) => event.clientId === clientId && event.message.type === type);
}

test('sala inicia com dois jogadores e rejeita o terceiro', async () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2', 'p3']) {
        await broker.publish(clientId, { type: 'lobby.join', roomId: 'dupla' });
    }

    assert.equal(messagesFor(sent, 'p1', 'match.ready').length, 1);
    assert.equal(messagesFor(sent, 'p2', 'match.ready').length, 1);
    // O cliente só sabe quem é anfitrião com o próprio id, que chega antes da entrada na sala.
    assert.deepEqual(sent.filter((event) => event.clientId === 'p1').slice(0, 2).map(({ message }) => message.type),
        ['session.welcome', 'lobby.joined']);
    assert.equal(messagesFor(sent, 'p3', 'lobby.rejected')[0].message.code, 'ROOM_FULL');
});

test('estado válido é enviado apenas ao companheiro da sala', async () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2']) {
        await broker.publish(clientId, { type: 'lobby.join', roomId: 'dupla' });
    }
    sent.length = 0;

    await broker.publish('p1', {
        type: 'player.state', sequence: 4, x: 100, y: 200, facing: 'left',
        health: 3, maxHealth: 4, reviveProgress: 0, revivesLeft: 2
    });

    assert.equal(messagesFor(sent, 'p1', 'player.state').length, 0);
    assert.deepEqual(messagesFor(sent, 'p2', 'player.state')[0].message, {
        type: 'player.state', playerId: 'p1', sequence: 4, x: 100, y: 200, facing: 'left',
        health: 3, maxHealth: 4, reviveProgress: 0, revivesLeft: 2, character: 'padrao',
        orbitCount: 0, orbitRadius: 0, companion: false, worn: 0
    });
});

test('estado inválido não é retransmitido', async () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2']) {
        await broker.publish(clientId, { type: 'lobby.join' });
    }
    sent.length = 0;
    await broker.publish('p1', {
        type: 'player.state', sequence: 1, x: Infinity, y: 0, facing: 'down',
        health: 4, maxHealth: 4, reviveProgress: 0, revivesLeft: 2
    });
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 0);
    assert.equal(messagesFor(sent, 'p1', 'error')[0].message.code, 'INVALID_PLAYER_STATE');
});

async function startedRoom() {
    const context = setup();
    for (const clientId of ['p1', 'p2']) {
        await context.broker.publish(clientId, { type: 'lobby.join', roomId: 'dupla' });
    }
    context.sent.length = 0;
    return context;
}

test('evento conhecido da partida chega somente ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    const event = { kind: 'cards.chosen' };
    await broker.publish('p2', { type: 'match.event', event });

    assert.equal(messagesFor(sent, 'p2', 'match.event').length, 0);
    assert.deepEqual(messagesFor(sent, 'p1', 'match.event')[0].message, {
        type: 'match.event', playerId: 'p2', event
    });
});

test('evento desconhecido ou grande demais não é retransmitido', async () => {
    const { broker, sent } = await startedRoom();
    for (const event of [
        { kind: 'desconhecido' },
        undefined,
        { kind: 'enemy.snapshot', rows: 'x'.repeat(20_000) }
    ]) {
        await broker.publish('p1', { type: 'match.event', event });
    }
    assert.equal(messagesFor(sent, 'p2', 'match.event').length, 0);
    assert.equal(messagesFor(sent, 'p1', 'error').length, 3);
});

test('vida acima do máximo invalida o estado do jogador', async () => {
    const { broker, sent } = await startedRoom();
    await broker.publish('p1', {
        type: 'player.state', sequence: 1, x: 0, y: 0, facing: 'down',
        health: 5, maxHealth: 4, reviveProgress: 0, revivesLeft: 2
    });
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 0);
});

test('partida iniciada não aceita novo jogador depois que alguém sai', async () => {
    const { broker, sent } = await startedRoom();
    await broker.close('p2');
    await broker.publish('p3', { type: 'lobby.join', roomId: 'dupla' });
    assert.equal(messagesFor(sent, 'p3', 'lobby.rejected')[0].message.code, 'ROOM_FULL');
});

test('eventos da espada, do gaúcho e dos itens chegam ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    for (const kind of ['player.swing', 'enemy.strike', 'item.drop', 'item.collected']) {
        await broker.publish('p1', { type: 'match.event', event: { kind } });
    }
    assert.deepEqual(
        messagesFor(sent, 'p2', 'match.event').map(({ message }) => message.event.kind),
        ['player.swing', 'enemy.strike', 'item.drop', 'item.collected']
    );
    assert.equal(messagesFor(sent, 'p1', 'error').length, 0);
});

async function joinPublic(broker, clientId) {
    await broker.publish(clientId, { type: 'lobby.join' });
}

test('sem código de sala cada dupla nova ganha uma sala própria', async () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2', 'p3', 'p4']) await joinPublic(broker, clientId);

    assert.equal(messagesFor(sent, 'p3', 'lobby.rejected').length, 0);
    assert.equal(messagesFor(sent, 'p1', 'match.ready')[0].message.roomId, 'publica');
    assert.equal(messagesFor(sent, 'p3', 'match.ready')[0].message.roomId, 'publica-2');
    assert.deepEqual(messagesFor(sent, 'p4', 'match.ready')[0].message.players, ['p3', 'p4']);
});

test('sala pública com partida iniciada não recebe quem chega depois', async () => {
    const { broker, sent } = setup();
    for (const clientId of ['p1', 'p2']) await joinPublic(broker, clientId);
    await broker.close('p2');

    await joinPublic(broker, 'p3');
    assert.equal(messagesFor(sent, 'p3', 'lobby.joined')[0].message.roomId, 'publica-2');

    await broker.close('p1');
    await joinPublic(broker, 'p4');
    assert.equal(messagesFor(sent, 'p4', 'lobby.joined')[0].message.roomId, 'publica');
});

test('origem só é restrita quando configurada', async () => {
    const allowed = 'https://escape-from-floripa.negoci.online';
    assert.equal(isOriginAllowed('https://outro-site.com', undefined), true);
    assert.equal(isOriginAllowed(allowed, allowed), true);
    assert.equal(isOriginAllowed('https://outro-site.com', allowed), false);
    assert.equal(isOriginAllowed(undefined, allowed), false);
    const both = `${allowed},https://feira-de-jogos.dev.br`;
    assert.equal(isOriginAllowed('https://feira-de-jogos.dev.br', both), true, 'o jogo hospedado na feira também conecta');
    assert.equal(isOriginAllowed(allowed, both), true);
    assert.equal(isOriginAllowed('https://outro-site.com', both), false);
});

test('mensagem sem tipo recebe erro e tipo desconhecido é ignorado', async () => {
    const { broker, sent } = setup();
    await broker.publish('p1', undefined);
    await broker.publish('p1', { type: 'admin.kick' });
    assert.deepEqual(sent.map(({ message }) => message), [{ type: 'error', code: 'INVALID_MESSAGE' }]);
});

async function openRooms(broker, sent, clientId) {
    sent.length = 0;
    await broker.publish(clientId, { type: 'lobby.list' });
    return messagesFor(sent, clientId, 'lobby.rooms')[0].message.rooms;
}

test('lista mostra só salas esperando parceiro, para quem ainda não entrou', async () => {
    const { broker, sent } = setup();
    const join = async (clientId, roomId) => {
        await broker.publish(clientId, { type: 'lobby.join', roomId });
    };
    assert.deepEqual(await openRooms(broker, sent, 'visitante'), []);

    await join('p1', 'sala-a');
    await join('p2', 'sala-b');
    assert.deepEqual(await openRooms(broker, sent, 'visitante'), ['sala-a', 'sala-b']);

    await join('p3', 'sala-a');
    assert.deepEqual(await openRooms(broker, sent, 'visitante'), ['sala-b']);

    await broker.close('p2');
    assert.deepEqual(await openRooms(broker, sent, 'visitante'), []);

    await broker.close('p3');
    assert.deepEqual(await openRooms(broker, sent, 'visitante'), [], 'Partida iniciada não reabre');
});

test('personagem escolhido é repassado e valor desconhecido invalida o estado', async () => {
    const { broker, sent } = await startedRoom();
    const state = (character) => broker.publish('p1', {
        type: 'player.state', sequence: sent.length + 1, x: 0, y: 0, facing: 'down',
        health: 4, maxHealth: 4, reviveProgress: 0, revivesLeft: 2, character
    });

    await state('gaucho');
    assert.equal(messagesFor(sent, 'p2', 'player.state')[0].message.character, 'gaucho');
    await state('admin');
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 1);
    assert.equal(messagesFor(sent, 'p1', 'error').at(-1).message.code, 'INVALID_PLAYER_STATE');
});

test('efeitos das cartas e faíscas orbitais chegam ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    await broker.publish('p1', {
        type: 'match.event', event: { kind: 'player.effect', effect: 'shockwave', x: 1, y: 2, radius: 150, color: 1 }
    });
    assert.equal(messagesFor(sent, 'p2', 'match.event')[0].message.event.effect, 'shockwave');

    const state = (extra) => broker.publish('p1', {
        type: 'player.state', sequence: sent.length + 1, x: 0, y: 0, facing: 'down',
        health: 4, maxHealth: 4, reviveProgress: 0, revivesLeft: 2, ...extra
    });
    await state({ orbitCount: 6, orbitRadius: 52, companion: true, worn: 5 });
    const relayed = messagesFor(sent, 'p2', 'player.state')[0].message;
    assert.deepEqual([relayed.orbitCount, relayed.orbitRadius, relayed.companion, relayed.worn], [6, 52, true, 5]);
    await state({ orbitCount: -1 });
    await state({ worn: 0x10000 });
    await state({ worn: 1.5 });
    assert.equal(messagesFor(sent, 'p2', 'player.state').length, 1);
    assert.equal(messagesFor(sent, 'p1', 'error').at(-1).message.code, 'INVALID_PLAYER_STATE');
});

test('catraca do TICEN e ações do golem chegam ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    const events = [
        { kind: 'ticen.gate' },
        { kind: 'boss.wake' },
        { kind: 'boss.action', action: { type: 'slam', ox: 1, oy: 2, tx: 3, ty: 4 } }
    ];
    for (const event of events) await broker.publish('p1', { type: 'match.event', event });
    assert.deepEqual(messagesFor(sent, 'p2', 'match.event').map(({ message }) => message.event), events);
    assert.equal(messagesFor(sent, 'p1', 'error').length, 0);
});

test('voto, baús e o fim da disputa pela vaga chegam ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    const events = [
        { kind: 'escape.vote' },
        { kind: 'escape.duel' },
        { kind: 'chest.spawn', id: 1, x: 10, y: 20, special: 'heart' },
        { kind: 'chest.claim', id: 1 },
        { kind: 'chest.opened', id: 1, byHost: false },
        { kind: 'duel.lost' }
    ];
    for (const event of events) await broker.publish('p1', { type: 'match.event', event });
    assert.deepEqual(messagesFor(sent, 'p2', 'match.event').map(({ message }) => message.event), events);
    assert.equal(messagesFor(sent, 'p1', 'error').length, 0);
});

test('pausa da dupla e voto do esconderijo chegam ao parceiro', async () => {
    const { broker, sent } = await startedRoom();
    const events = [
        { kind: 'game.pause', reason: 'pause' },
        { kind: 'game.pause' },
        { kind: 'gateway.vote', phase: 'ask', question: 'ENTRAR NO ESCONDERIJO?' },
        { kind: 'gateway.vote', phase: 'yes' }
    ];
    for (const event of events) await broker.publish('p1', { type: 'match.event', event });
    assert.deepEqual(messagesFor(sent, 'p2', 'match.event').map(({ message }) => message.event), events);
    assert.equal(messagesFor(sent, 'p1', 'error').length, 0);
});
