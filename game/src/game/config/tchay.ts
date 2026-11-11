/** Rua dos bares da Sala I: o TCHAY lotado com fila, e o varal de lâmpadas sobre a calçada. */
export const TCHAY = {
    peopleTexture: 'fila-tchay',
    peoplePath: 'assets/npcs/fila-tchay.png',
    frameWidth: 16,
    frameHeight: 24,
    people: 6,
    signTexture: 'tchay-letreiro',
    signPath: 'assets/props/tchay-letreiro.png',
    // Letreiro sobre a loja de balcão (colunas 36-38 do room01.json).
    sign: { x: 600, y: 22 },
    // Quem está na frente da fila fica diante do balcão; a fila cresce para a esquerda.
    counter: { x: 600, y: 84 },
    queueLength: 15,
    spacing: 13,
    // -1: a fila cresce para a esquerda do balcão; 1: para a direita.
    direction: -1,
    // Cada pessoa leva 5 s no balcão e sai com o copão.
    serveInterval: 5_000,
    walkSpeed: 34,
    // Quem foi atendido desce da calçada andando com o copão por 5 s e só então some.
    exit: { dx: -120, dy: 46 },
    exitDuration: 5_000,
    exitFade: 700
} as const;

/** O que uma fila de bar precisa: o TCHAY e os barzinhos da calçada de baixo usam a mesma lógica. */
export type BarQueueConfig = Readonly<{
    counter: Readonly<{ x: number; y: number }>;
    queueLength: number;
    spacing: number;
    direction: number;
    serveInterval: number;
    walkSpeed: number;
    exit: Readonly<{ dx: number; dy: number }>;
    exitDuration: number;
    exitFade: number;
}>;

/**
 * Bares da calçada de baixo da Sala I (linhas 31-33), com referência direta aos de verdade:
 * Gatus Rock Bar (com fila) e Bar do Noel (com uma roda de pagode na frente). Quadros 0 e 1 da folha.
 */
export const POPULAR_BARS = {
    texture: 'bares-populares',
    path: 'assets/props/bares-populares.png',
    frameWidth: 64,
    frameHeight: 48,
    bars: [
        {
            // Gatus Rock Bar: colunas 6-9.
            frame: 0,
            x: 128,
            y: 544,
            queue: { ...TCHAY, counter: { x: 128, y: 558 }, queueLength: 6, direction: 1, exit: { dx: 110, dy: -24 } }
        },
        {
            // Bar do Noel: colunas 39-42; em vez de fila, a roda de pagode da mesa ao lado.
            frame: 1,
            x: 656,
            y: 544
        }
    ]
} as const;

/** Roda de pagode na frente do Bar do Noel: mesa vermelha e gente atrás dela tocando e brindando. */
export const PAGODE = {
    texture: 'pagode',
    path: 'assets/npcs/pagode.png',
    frameSize: 16,
    tableTexture: 'pagode-mesa',
    tablePath: 'assets/props/pagode-mesa.png',
    // Mesa nas colunas 35-38, linha 33; as pessoas ficam atrás, com a mesa cobrindo a cintura.
    table: { x: 592, y: 544 },
    people: [
        { x: 570, y: 534, person: 0, play: 'pandeiro' },
        { x: 584, y: 534, person: 1, play: 'cavaquinho' },
        { x: 598, y: 534, person: 2, play: 'pandeiro' },
        { x: 612, y: 534, person: 3, play: 'copo' }
    ]
} as const;

/** Linha de cada instrumento na folha `pagode.png` (2 quadros cada). */
export const PAGODE_FRAMES = { pandeiro: 0, cavaquinho: 2, copo: 4 } as const;

/**
 * Varal preso em coisas de verdade: ganchos na parede das fachadas e o topo dos postes da calçada
 * (colunas 8, 13, 36 e 41 do room01.json). Sem poste no meio, um fio longo atravessa de um ao outro.
 * Os ganchos evitam o beco das colunas 9-12, que é a passagem para a Sala II.
 */
export const STRING_LIGHTS = {
    points: [
        { x: 96, y: 60, anchor: 'gancho' },
        { x: 136, y: 130, anchor: 'poste' },
        { x: 216, y: 130, anchor: 'poste' },
        { x: 584, y: 130, anchor: 'poste' },
        { x: 632, y: 60, anchor: 'gancho' },
        { x: 664, y: 130, anchor: 'poste' },
        { x: 712, y: 60, anchor: 'gancho' }
    ],
    // O fio cai mais quanto mais longo é o trecho.
    sagBase: 4,
    sagPerPixel: 0.06,
    bulbSpacing: 10,
    color: 0xffd27a
} as const;
