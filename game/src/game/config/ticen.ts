import { WORLD_CONFIG } from './world';

/** Catraca de entrada do TICEN (Sala V) e a carteira com o cartão Grande Floripa. */
export const TICEN_GATE = {
    // Catraca do meio: colunas 23-24 da linha 36 do room5.json (assets/ticen/gen_room5_map.py).
    x: 384,
    y: 592,
    // Encostado na catraca, vindo da calçada: é dali que o jogador passa o cartão.
    approach: { x: 384, y: 598 },
    triggerDistance: 16,
    // Quem fechou a carteira sem usar o cartão precisa se afastar para ela abrir de novo.
    rearmDistance: 64,
    blockerLayer: 'catraca-fechada',
    // Ao liberar, a grade ao lado da catraca também abre: a passagem fica clara e mais larga.
    railLayer: 'catracas',
    row: 36,
    widenCols: [22, 25],
    texture: 'catraca-ticen',
    path: 'assets/props/catraca-ticen.png',
    // Catraca nas cores originais, usada pela Sala V; a da paleta cyberpunk fica para ?room=51.
    originalTexture: 'catraca-ticen_original',
    originalPath: 'assets/props/catraca-ticen_original.png',
    frameSize: 32,
    // Quadros da catraca: fechada, cartão lido, girando, liberada.
    openFrameDuration: 220,
    hint: 'PASSE O CARTAO',
    hintDistance: 110
} as const;

/**
 * Pessoas sentadas nos bancos de cubo da pracinha antes das catracas (linha 42 do room5.json).
 * Usam a folha do casal do mercado: `person` é a linha da folha; os grupos conversam virados entre si.
 */
export const TICEN_SITTERS = [
    { col: 30, person: 0, flipX: false },
    { col: 32, person: 3, flipX: true },
    { col: 36, person: 2, flipX: false },
    { col: 37, person: 1, flipX: false },
    { col: 38, person: 0, flipX: true }
].map(({ col, person, flipX }) => ({ x: col * 16 + 8, y: 42 * 16 + 13, person, flipX }));

/**
 * Patinetes e bicicletas elétricas estacionados na calçada, como os de aluguel do Centro:
 * os mesmos sprites dos inimigos, parados no quadro de frente (0). Cada fileira bloqueia a passagem.
 */
export const TICEN_PARKED = [
    { texture: WORLD_CONFIG.scooter.texture, scale: WORLD_CONFIG.scooter.scale, fromX: 52, y: 42 * 16 + 14, count: 12, spacing: 14 },
    { texture: WORLD_CONFIG.bike.texture, scale: WORLD_CONFIG.bike.scale, fromX: 56, y: 44 * 16 + 14, count: 8, spacing: 20 }
] as const;

/**
 * Fim do jogo: chegar na porta da frente do 763.2 via Kobrasol, parado na faixa da Plataforma C
 * (ônibus nas colunas 38-44, linhas 29-31). O jogador encosta vindo da faixa, logo abaixo da porta.
 */
export const TICEN_GOAL = { left: 676, right: 716, top: 500, bottom: 536 } as const;

export const WALLET_UI = {
    walletTexture: 'carteira',
    walletPath: 'assets/ui/carteira.png',
    cardTexture: 'cartao-grande-floripa',
    cardPath: 'assets/ui/cartao-grande-floripa.png',
    scale: 3,
    // Cartão no bolso de cima, em pixels da imagem da carteira (antes da escala).
    cardInWallet: { x: 116, y: 22, width: 64, height: 40 }
} as const;

/** O saldo do cartão é a pontuação da partida até aqui, escrito como dinheiro. */
export function formatBalance(points: number) {
    return `R$ ${Math.max(0, Math.round(points)).toLocaleString('pt-BR')},00`;
}
