/**
 * Feira de Jogos do IFSC (API v2): o login é o do Google, com o Client ID que a feira autoriza, e quem
 * termina o jogo logado recebe o crédito em tijolinhos pelo `POST /credit`.
 */
export const FAIR = {
    googleClientId: '331191695151-ku8mdhd76pc2k36itas8lm722krn0u64.apps.googleusercontent.com',
    creditUrl: 'https://feira-de-jogos.dev.br/api/v2/credit',
    // Número do Escape from Floripa no cadastro de produtos da feira.
    product: 97,
    value: 100,
    messages: {
        PAID: '+100 TIJOLINHOS NA SUA CONTA DA FEIRA',
        RECENT: 'TIJOLINHOS JÁ CREDITADOS HÁ POUCO',
        FAILED: 'NÃO FOI POSSÍVEL CREDITAR OS TIJOLINHOS'
    }
} as const;

export type FairCreditResult = keyof typeof FAIR.messages;
