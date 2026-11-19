/** Formulário único da Feira de Jogos do IFSC, com o nome do jogo já preenchido. */
export const EVALUATION_FORM = {
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSeeleFRJ3PbTeX9nmxFtfqF_3VMD6bBGixNGFODEtqjbHGK9A/viewform?entry.52413313=Plataforma%20C%3A%20Escape%20from%20Floripa',
    // Gerado com: qrencode -l M -s 3 -m 2 -o public/assets/ui/qrcode-avaliacao.png "<url>"
    qrTexture: 'qrcode-avaliacao',
    qrPath: 'assets/ui/qrcode-avaliacao.png'
} as const;
