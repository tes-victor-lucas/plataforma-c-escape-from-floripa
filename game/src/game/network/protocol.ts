import type { EnemyKind } from '../config/combat';
import type { RoomKey } from '../config/rooms';
import type { CharacterId } from '../config/characters';
import type { Direction } from '../entities/Player';
import type { GolemAction } from '../entities/TopazioGolem';
import type { DuelSpecialId } from '../config/ticen';

export type MatchReadyMessage = {
    type: 'match.ready';
    roomId: string;
    players: string[];
};

export type RemotePlayerState = {
    type: 'player.state';
    playerId: string;
    sequence: number;
    x: number;
    y: number;
    facing: Direction;
    health: number;
    maxHealth: number;
    /** Entre 0 e 1 enquanto o jogador caído recebe ajuda. */
    reviveProgress: number;
    revivesLeft: number;
    character?: CharacterId;
    /** Faíscas orbitais e drone companheiro seguem o jogador, então vão no estado e não como evento. */
    orbitCount?: number;
    orbitRadius?: number;
    companion?: boolean;
    /** Itens vestidos (chapéu, capacete, galochas), um bit por item; cliente antigo não manda. */
    worn?: number;
};

type Point = Readonly<{ x: number; y: number }>;

/** Efeito visual de carta, repetido na tela do parceiro. */
/** Por que o parceiro congelou a dupla: o texto que aparece na tela do outro. */
export type PartnerPauseReason = 'pause' | 'piranhas' | 'menu';

export type PlayerEffect =
    | { effect: 'shockwave' | 'explosion' | 'slash'; x: number; y: number; radius: number; color: number }
    | { effect: 'lightning'; points: readonly Point[]; color: number }
    | { effect: 'beams'; origin: Point; angles: readonly number[]; length: number; color: number }
    // Rajada espiral: o parceiro redesenha os fragmentos; o dano já foi resolvido por quem tem a carta.
    | { effect: 'spiral'; x: number; y: number; startAngle: number; shards: number; range: number };

export type EnemySpawnRow = Readonly<{
    kind: EnemyKind;
    x: number;
    y: number;
    patrolLeft: number;
    patrolRight: number;
    health: number;
    maxHealth: number;
}>;

/** Estado visual de um inimigo; `null` quando ele já morreu no cliente anfitrião. */
export type EnemySnapshotRow = readonly [x: number, y: number, health: number, frame: string | number, flipX: 0 | 1, scaleX?: number] | null;

export type CoopEvent =
    | { kind: 'enemy.spawn'; enemies: readonly EnemySpawnRow[] }
    | { kind: 'enemy.snapshot'; rows: readonly EnemySnapshotRow[] }
    | { kind: 'enemy.shot'; x: number; y: number; angle: number }
    // freeze: ms de congelamento do cajado de gelo; vai junto do acerto para não exigir um tipo novo no servidor.
    | { kind: 'enemy.hit'; index: number; damage: number; dx: number; dy: number; freeze?: number }
    | { kind: 'enemy.killed'; index: number }
    | { kind: 'player.shot'; x: number; y: number; angle: number; speed: number; color: number; pierces?: number }
    | { kind: 'player.swing'; x: number; y: number; angle: number; flame?: boolean }
    | ({ kind: 'player.effect' } & PlayerEffect)
    | { kind: 'player.damage'; amount: number }
    /** `hitPeer` diz se o golpe do gaúcho acertou quem recebe o evento. */
    | { kind: 'enemy.strike'; x: number; y: number; hitPeer: boolean }
    | { kind: 'item.drop'; id: number; x: number; y: number }
    | { kind: 'item.collected'; id: number }
    | { kind: 'world.ready'; epoch: number }
    | { kind: 'wave.intermission' }
    | { kind: 'combat.complete'; rewardClaimed: boolean }
    | { kind: 'cards.chosen' }
    | { kind: 'cards.released' }
    | { kind: 'room.request'; roomKey: RoomKey; spawn?: Readonly<{ x: number; y: number }> }
    | { kind: 'room.transition'; roomKey: RoomKey; spawn?: Readonly<{ x: number; y: number }>; seed?: number }
    /** O parceiro passou a catraca do TICEN com o cartão dele; ela fecha atrás de cada um. */
    | { kind: 'ticen.gate' }
    /** O anfitrião acordou o golem: o convidado entra na luta e mostra a barra. */
    | { kind: 'boss.wake' }
    /** Cada golpe do golem do anfitrião, para o espelho do convidado repetir. */
    | { kind: 'boss.action'; action: GolemAction }
    /** Disputa pela vaga do 763.2: voto para embarcar, início da luta, baús e quem perdeu. */
    | { kind: 'escape.vote' }
    // Menu aberto num cliente congela os dois; sem reason, o menu fechou.
    | { kind: 'game.pause'; reason?: PartnerPauseReason }
    // Pergunta dos esconderijos: quem pisa pergunta, os dois respondem, só entram com os dois SIM.
    | { kind: 'gateway.vote'; phase: 'ask' | 'yes' | 'no'; question?: string }
    | { kind: 'escape.duel' }
    | { kind: 'chest.spawn'; id: number; x: number; y: number; special: DuelSpecialId }
    | { kind: 'chest.claim'; id: number }
    | { kind: 'chest.opened'; id: number; byHost: boolean }
    | { kind: 'duel.lost' };

export type ServerMessage =
    | { type: 'session.welcome'; playerId: string }
    | { type: 'lobby.joined'; roomId: string; playerId: string; players: string[] }
    | { type: 'lobby.players'; roomId: string; players: string[] }
    | { type: 'lobby.rejected'; code: string; roomId: string }
    | { type: 'lobby.rooms'; rooms: string[] }
    | MatchReadyMessage
    | RemotePlayerState
    | { type: 'match.event'; playerId: string; event: CoopEvent }
    | { type: 'player.left'; roomId: string; playerId: string; players: string[] }
    | { type: 'error'; code: string };
