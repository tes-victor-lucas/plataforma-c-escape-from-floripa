# SPEC: Último ônibus (roteiro C, animação 2D em pixel art)

GOAL:    o jogador sente a perseguição antes de jogar: Florianópolis, 2067; a IA Floria controla as rotas; quem sai
         delas vira ameaça; o último 763.2 via Kobrasol é a saída. Termina em 00:00, o corte para o jogo.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps; animação desenhada em 480 x 270 e ampliada 4x sem suavizar
TIME:    32,3 s x 30 fps = 969 frames; trilha mainmenu-trecho.mp3, baixa até 8,8 s e forte a partir da corrida
LOOK:    o estilo dos assets e da tela de início: pixel art com a paleta do jogo (lib/palette.js, 45 cores tiradas das
         ilustrações do menu, do logo e dos mapas). Cada quadro é reduzido à paleta com pontilhado ordenado Bayer 4x4,
         como as ilustrações do menu. Silhuetas articuladas (personagem, multidão, robôs, drones) com contorno aceso
         pelo fogo ou pelo neon; cenários em camadas de parallax. Texto em PixelGamer com sombra dura; vermelho #e90931
         só em AMEAÇA e na contagem.
MOTION:  câmera na mão = tremor de semente fixa (leve contínuo, forte nos tiros e explosões); corridas com pernas e
         braços em fases diferentes; parallax: céu 0,2x, prédios 0,6x, carros e fogo 0,9x.
SHOTS:   0-4      telhado: personagem de costas diante da Ponte Hercílio Luz e do sol vermelho; FLORIANÓPOLIS, 2067
         4-7      contra-plongée do Centro Cultural, drone com holofote; FLORIA CONTROLA CADA ROTA DO CENTRO
         7-8,8    cartela preta: QUEM SAI DA ROTA / VIRA AMEAÇA
         8,8-12,8 rua em chamas de lado: multidão correndo, carros queimando, explosão
         12,8-15,8 tiroteio no Terminal Velho: o personagem atira, um robô revida, os dois robôs caem
         15,8-19,3 drones mergulhando com holofote, tiros e explosões
         19,3-21,3 escondido no bar, o holofote acha o personagem
         21,3-23,8 montagem: drone, corrida, robô, explosão, contagem, corrida
         23,8-26,8 Plataforma C: corrida até o 763.2 da Estrela, porta abrindo; O ÚLTIMO 763.2 VIA KOBRASOL
         26,8-32,3 título na ponte; CHEGUE AO 763.2 NA PLATAFORMA C; contagem 00:00 em 31,8 s
BANNED:  3D e fotos coladas; gradientes lisos fora da paleta (tudo passa pelo pontilhado); texto que se move enquanto
         é lido; logo num canto.
QA:      2 / 5,5 / 10,3 / 11,2 / 13,35 / 17,6 / 20,6 / 25,3 / 32,05 s.
