/**
 * Personagens da Sala IV (Mercado Público). Posições em pixels do room4.json; os corredores
 * livres dos skatistas e as mesas vêm de assets/mercado-publico/gen_room4_map.py.
 */
export const MERCADO_NPCS = {
    skaters: {
        texture: 'skatistas-emo',
        path: 'assets/npcs/skatistas-emo.png',
        frameWidth: 24,
        frameHeight: 32,
        scale: 0.85,
        speed: 80,
        // Atropelamento mata na hora: o dano passa de qualquer vida máxima.
        damage: Number.POSITIVE_INFINITY,
        // Só os pés atropelam: área do skate em volta da base do sprite.
        hitbox: { width: 14, height: 8 },
        fadeDuration: 400,
        // Título da derrota por atropelamento, em duas linhas para caber no painel.
        defeatTitle: 'VOCE FOI ATROPELADO\nPELOS SKATISTAS',
        // Cruzam entre o primeiro e o segundo poste, perto do bueiro: da calçada até a beira do largo.
        // Um desce; os outros dois sobem.
        paths: [
            { x: 152, fromY: 236, toY: 396, delay: 0 },
            { x: 184, fromY: 396, toY: 236, delay: 600 },
            { x: 216, fromY: 396, toY: 236, delay: 1_200 }
        ]
    },
    merchants: {
        texture: 'comerciantes',
        path: 'assets/npcs/comerciantes.png',
        frameWidth: 16,
        frameHeight: 24,
        // Calmos: bem mais devagar que o jogador (120).
        speed: 22,
        // Pés atrás do balcão e na frente da banca; atrás, o corte esconde o corpo abaixo do balcão.
        behindY: 436,
        frontY: 462,
        counterTopY: 428,
        counterBottomY: 448,
        workTime: { behind: [2_600, 1_900], front: 3_200 },
        // Coluna de cada banca e lado por onde o comerciante contorna; 0 é banca sem lateral livre.
        stalls: [
            { col: 2, side: -1 },
            { col: 5, side: 1 },
            { col: 13, side: -1 },
            { col: 37, side: -1 },
            { col: 40, side: 0 },
            { col: 43, side: 1 }
        ]
    },
    couple: {
        texture: 'casal',
        path: 'assets/npcs/casal.png',
        frameWidth: 16,
        frameHeight: 24,
        people: 4,
        // Um casal por mesa (coluna e linha do canto da mesa no mapa).
        tables: [
            { col: 13, row: 29 }, { col: 17, row: 29 }, { col: 27, row: 29 }, { col: 30, row: 29 },
            { col: 13, row: 34 }, { col: 18, row: 34 }, { col: 27, row: 34 }, { col: 31, row: 34 }
        ],
        // Cadeiras e centro da mesa a partir do canto dela, em pixels.
        seatOffsets: [{ x: 5, y: 42, flipX: false }, { x: 43, y: 42, flipX: true }],
        centerOffset: { x: 24, y: 36 },
        // Só fogem com o jogador colado na mesa e um inimigo junto.
        playerDistance: 40,
        enemyDistance: 140,
        runSpeed: 150,
        fadeDuration: 1_800
    }
} as const;

/** Interior do Mercado Público (dungeon surpresa da Sala IV) e o minijogo do fliperama. */
export const MERCADO_INTERIOR = {
    // Porta de volta para o Largo, na borda esquerda do corredor.
    returnArea: { left: 0, right: 12, top: 8 * 16, bottom: 13 * 16 },
    // Pés diante do fliperama (colunas 26-27, base na linha 7).
    cabinet: { x: 432, y: 132 },
    triggerDistance: 36,
    // A pergunta "VAMOS JOGAR?" aparece no chão a partir desta distância.
    promptDistance: 200,
    arcade: {
        width: 10,
        height: 16,
        pointsPerLine: 50,
        goalScore: 200,
        // Prêmio em corações, como os itens do Piranhas Bar.
        rewardHearts: 2,
        // Duas chances por jogador; quem vence não joga de novo.
        maxAttempts: 2,
        // Depois de perder, só reabre se o jogador se afastar além disto e voltar.
        rearmDistance: 56,
        dropInterval: 550
    }
} as const;

/**
 * Placa de pé na calçada, à direita do portal central (vão x 356-413): avisa que dá para entrar no mercado.
 * Posição da base do poste, em pixels do room4.json.
 */
export const MERCADO_ENTRANCE_SIGN = {
    x: 432,
    y: 258,
    text: 'ENTRADA',
    // A seta aponta para o portal e balança alguns pixels nessa direção.
    arrowBob: 3
} as const;
