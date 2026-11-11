# SPEC: Último ônibus (roteiro C, versão cinematográfica com 3D)

GOAL:    o jogador sente a perseguição antes de jogar: Florianópolis, 2067; a IA Floria controla as rotas; quem sai
         delas vira ameaça; o último 763.2 via Kobrasol é a saída.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    32,3 s x 30 fps = 969 frames; trilha mainmenu-trecho.mp3 (faixa do menu a partir de 28,6 s): baixa até 8,8 s,
         o trecho mais forte entra com a corrida em Mode 7.
LOOK:    referência: The Last of Us – Story Trailer (planos de costas diante da cidade, contra-plongée, correria na rua em
         chamas, cartelas pretas). O meio é o jogo: ilustrações do menu, fachada do Centro Cultural, mapas das salas e
         sprites, tudo ampliado sem suavizar; sprites novos (arma, clarão, explosão, silhuetas) em gen_assets.py.
         Texto branco PixelGamer 52-72 px com sombra dura de 5 px, sem caixa; vermelho #e90931 só em AMEAÇA e na contagem.
MOTION:  câmera na mão = tremor de semente fixa (5 px contínuo, 14-26 px nos tiros e explosões); corridas a 15 qps;
         Mode 7 = mapa inclinado 66° com perspectiva de 520 px, chão deslizando 1500-1700 px por cena.
SHOTS:   0-4      por cima do ombro: personagem de costas diante da ponte; FLORIANÓPOLIS, 2067
         4-7      contra-plongée do Centro Cultural à noite, drone com holofote; FLORIA CONTROLA CADA ROTA DO CENTRO
         7-8,8    cartela preta: QUEM SAI DA ROTA / VIRA AMEAÇA (pancada)
         8,8-12,8 rua em chamas em 3D (lib/street3d.js, Three.js a 480x270 ampliado): fachadas do jogo, letreiros,
                  26 pessoas fugindo em volta da câmera, chamas e explosão à frente
         12,8-15,8 primeira pessoa no Terminal Velho: dois guardas, cinco tiros, um acerto em você, os dois caem
         15,8-19,3 rua dos murais em 3D: três drones mergulham atirando, explosões ao lado
         19,3-21,3 escondido no bar, o holofote varre e acha (flash vermelho, pancada)
         21,3-23,8 montagem de 0,42 s: drone, corrida de lado, guarda investindo, explosão, 04:37, corrida
         23,8-26,8 dentro do ônibus, devagar: O ÚLTIMO 763.2 VIA KOBRASOL; corte para preto
         26,8-32,3 título na ponte, CHEGUE AO 763.2 NA PLATAFORMA C; a contagem da partida chega a 00:00 em 31,8 s
                  e segura meio segundo: é o corte para o jogo (fluxo vídeo -> jogo)
BANNED:  vazio escuro com coisas pequenas flutuando; glow e partículas decorativas; tudo surgindo com fade; texto que
         se move enquanto é lido; caixas de texto (agora são cartelas e legendas com sombra); logo num canto.
QA:      1,5 / 5 / 7,9 / 10,5 / 13,8 / 14,5 / 17 / 20 / 20,8 / 21,5 / 23 / 25 / 29 s.
