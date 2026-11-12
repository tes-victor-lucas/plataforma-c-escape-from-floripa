import { WORLD_CONFIG } from './world';

/** Catraca de entrada do TICEN (Sala V) e a carteira com o cartão Grande Floripa. */
export const TICEN_GATE = {
    // Catraca do meio: colunas 23-24 da linha 36 do room5.json (assets/ticen/gen_room5_map.py).
    x: 384,
    y: 592,
    // Encostado na catraca, vindo da calçada: é dali que o jogador passa o cartão.
    approach: { x: 384, y: 598 },
    triggerDistance: 16,
    // Já dentro do terminal: a catraca fecha atrás de quem passou, e o próximo usa o próprio cartão.
    passedMargin: 14,
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

/**
 * Chefe final: o Golem de Topázio espera na faixa entre as Plataformas B e C e acorda quando o
 * jogador passa a catraca e sobe para a Plataforma D. Distâncias em pixels, tempos em milissegundos.
 */
export const TOPAZIO_BOSS = {
    title: 'GOLEM DE TOPAZIO',
    texture: 'topazio-golem',
    path: 'assets/enemies/topazio/topazio-golem.png',
    frameSize: 96,
    shardTexture: 'topazio-projeteis',
    shardPath: 'assets/enemies/topazio/topazio-projeteis.png',
    shardFrameSize: 16,
    // Topázios que ficam no chão quando ele explode.
    gemTexture: 'topazio-gema',
    gemPath: 'assets/enemies/topazio/topazio-gema.png',
    gemCount: 14,
    // Centro do corpo; os pés ficam uns 44 px abaixo.
    spawn: { x: 384, y: 21 * 16 },
    feetOffset: 44,
    // Linha 35 é a Plataforma D, logo acima da catraca (linha 36).
    wakeY: 35 * 16,
    // Gigante: anda por cima de tudo, mas não sai do terminal nem desce até a catraca.
    bounds: { left: 56, right: 712, top: 8 * 16, bottom: 32 * 16 },
    maxHealth: 400,
    // Gigante: anda por cima de toldos, pilares, placas e quiosques (camada itens-topo, profundidade 20).
    depth: 20.5,
    speed: 34,
    contactDamage: 2,
    hitbox: { width: 52, height: 60, offsetX: 22, offsetY: 28 },
    frameDuration: 150,
    // Respiro entre ataques em cada estágio de rachadura: quanto mais rachado, mais rápido.
    rest: [1700, 1400, 1150, 900],
    firstRest: 1200,
    // Bate no chão: topázios brotam em três cadeias, em leque, na direção do jogador.
    slam: { windup: 700, recover: 700, spikeInterval: 55, spikeSpacing: 22, spikeCount: 15, spikeRadius: 13, spikeLifetime: 640, damage: 2, spread: 0.42 },
    // Gira em pé no lugar, como um pião (turnSpeed em radianos por ms), cuspindo topázios em volta.
    // A varredura dos punhos (sweepRadius) machuca quem chega perto, como o giro do Garen e do Balmond.
    spin: {
        duration: 2200, burstInterval: 280, shardsPerBurst: 10, shardSpeed: 125, shardLifetime: 3000, damage: 1, turnSpeed: 0.022,
        sweepRadius: 58, sweepDamage: 1,
        // Persegue o jogador enquanto gira, mais rápido que andando (34).
        chaseSpeed: 52
    },
    // Cutscenes rápidas aos 70% e aos 40%: a câmera vai até ele, ele ruge e a luta volta. calmBefore deixa ônibus e cadeias terminarem.
    roar: {
        calmBefore: 900, panTime: 380, duration: 1500, zoom: 1.45,
        cutscenes: [{ at: 0.7, caption: 'O TOPAZIO DESPERTA' }, { at: 0.4, caption: 'FURIA DO TOPAZIO' }]
    },
    // Ônibus: vai até a baia, ergue acima da cabeça, mira no jogador e arremessa.
    bus: { fetchSpeed: 130, liftTime: 450, holdTime: 1000, flightTime: 700, radius: 44, damage: 4, frameWidth: 112, frameHeight: 48, tilesWide: 7, tilesHigh: 3 },
    busLayer: 'onibus',
    // Um ônibus a cada limiar de vida. O golem não morre enquanto sobrar ônibus para arremessar.
    busThresholds: [0.8, 0.6, 0.4, 0.2],
    // Baias do room5.json (assets/ticen/gen_room5_map.py); `route` é a linha do ticen_onibus.png.
    // O 763.2 via Kobrasol (Estrela, rota 3, coluna 38 da linha 29) fica de fora: é a fuga.
    buses: [
        { route: 0, col: 3, row: 11 },
        { route: 1, col: 25, row: 11 },
        { route: 2, col: 12, row: 20 },
        { route: 4, col: 34, row: 20 }
    ]
} as const;

/**
 * Depois do golem: o 763.2 abre as portas com um feixe de luz e, na partida solo, o final dentro do ônibus.
 * Tempos em milissegundos.
 */
export const TICEN_ESCAPE = {
    // Porta da frente do 763.2: x 82-92, y 12-40 do ônibus no ticen_onibus.png, na baia da coluna 38, linha 29.
    door: { x: 690, y: 476, width: 11, height: 29 },
    bus: { route: 3, col: 38, row: 29 },
    // Espera o golem estilhaçar antes de a câmera ir até o ônibus.
    doorCutscene: { delay: 1700, hold: 1800, zoom: 1.6, caption: 'O 763.2 ABRIU AS PORTAS' },
    interior: {
        texture: 'onibus-interior',
        path: 'assets/ui/onibus-interior.png',
        frontTexture: 'onibus-interior-frente',
        frontPath: 'assets/ui/onibus-interior-frente.png',
        viewTexture: 'onibus-vista',
        viewPath: 'assets/ui/onibus-vista.png',
        // Gaúcho e homem-cachorro sentados nos outros bancos.
        passengersTexture: 'onibus-passageiros',
        passengersPath: 'assets/ui/onibus-passageiros.png',
        // Céu com o sol vermelho e o mar: fica parado enquanto a ponte corre pela janela.
        skyTexture: 'onibus-ceu',
        skyPath: 'assets/ui/onibus-ceu.png',
        // As imagens são 1/3 da tela (assets/ticen/gen_onibus_interior.py).
        scale: 3,
        // Escala do jogador na tela: maior que no mapa, na proporção dos bancos.
        playerScale: 4.2,
        // Em pixels da imagem: centro do assento, pés andando no corredor e pés sentado, escondidos atrás do
        // assento e do banco da frente (o assento começa na linha 120).
        seatX: 136,
        floorY: 160,
        seatedFeetY: 134,
        // Linhas do quadro de lado (38x38) dos personagens: o quadril, a calça e o sapato.
        seatedLegs: { hipRow: 29, pantsRows: [29, 31], shoeRows: [33, 35] },
        walkTime: 1400,
        seatedPause: 700,
        departTime: 2400
    },
    departure: { distance: 460, duration: 2400 }
} as const;

/**
 * Fim da fuga em dupla (multiplayer): os dois votam para embarcar, o motorista avisa que só cabe um e a dupla
 * disputa a última vaga de espada, com gaúchos atrapalhando e baús de especiais. Tempos em milissegundos.
 */
export const TICEN_DUEL = {
    question: 'ESCAPAR DE FLORIANÓPOLIS?',
    waiting: 'AGUARDANDO JOGADOR',
    caption: 'A ULTIMA VAGA',
    start: 'LUTEM! SO UM EMBARCA',
    leftBehind: 'VOCÊ FOI DEIXADO PARA TRÁS',
    driver: {
        texture: 'motorista',
        path: 'assets/props/motorista.png',
        frameWidth: 20,
        frameHeight: 32,
        speech: 'NÃO, NÃO! SÓ TEMOS ESPAÇO PARA UM DE VOCÊS... LUTEM ENTRE SI!',
        // Quanto a câmera fica no ônibus: o motorista desce, avisa e volta para dentro.
        cutscene: 4800
    },
    // Gaúchos de espada entrando aos poucos para atrapalhar a disputa.
    enemies: { count: 10, interval: 2500 },
    chest: {
        texture: 'bau',
        path: 'assets/props/bau.png',
        frameWidth: 18,
        frameHeight: 16,
        interval: 10_000,
        touchRadius: 16
    },
    // Um especial diferente por baú, na ordem em que aparecem; depois do sexto a lista recomeça.
    specials: [
        { id: 'heart', label: '+1 CORACAO' },
        { id: 'club', label: 'CACETE MELHORADO' },
        { id: 'speed', label: 'POCAO DE VELOCIDADE' },
        { id: 'shield', label: 'ESCUDO' },
        { id: 'lifesteal', label: 'ROUBO DE VIDA' },
        { id: 'spin', label: 'GIRO DE LONGO ALCANCE' }
    ],
    clubMultiplier: 1.6,
    speed: { multiplier: 1.5, duration: 8_000 },
    shieldDuration: 5_000,
    lifestealDuration: 12_000,
    spin: { rangeMultiplier: 1.8, duration: 10_000 },
    // Animação de morte de quem perdeu antes de a câmera ir para o ônibus.
    deathTime: 1_400,
    boardTime: 1_400
} as const;

export type DuelSpecialId = (typeof TICEN_DUEL.specials)[number]['id'];

/** Estágio de rachadura do golem (0 a 3): cada quarto de vida perdido racha mais o corpo. */
export function getGolemStage(current: number, max: number) {
    const ratio = max > 0 ? current / max : 0;
    return Math.min(3, Math.max(0, Math.floor((1 - ratio) * 4)));
}

/** Quantos limiares de vida já foram cruzados: um ônibus ou uma cutscene para cada. */
export function countThresholdsCrossed(current: number, max: number, thresholds: readonly number[]) {
    return thresholds.filter((threshold) => current <= max * threshold).length;
}

/** O saldo do cartão é a pontuação da partida até aqui, escrito como dinheiro. */
export function formatBalance(points: number) {
    return `R$ ${Math.max(0, Math.round(points)).toLocaleString('pt-BR')},00`;
}
