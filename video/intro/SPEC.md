# SPEC: Último ônibus (roteiro C)

GOAL:    o jogador sabe onde está (Centro de Florianópolis, 2067), quem manda (a IA Floria), por que é caçado
         (saiu da rota) e para onde ir (o 763.2 na Plataforma C), e quer começar a correr.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps
TIME:    30 s x 30 fps = 900 frames; trilha mainmenu.mp3 a partir de 22,9 s, pico (42,4 s) em 19,5 s do filme
LOOK:    o meio é o próprio jogo: capturas reais das salas e arte do menu, ampliadas sem suavização
         (image-rendering: pixelated), escala da câmera 3x nas salas, 2,5x a 5x no TICEN.
         Texto: PixelGamer, 56 px nas frases, 120 px na contagem; tinta #ffffff; acento vermelho #e90931 só na
         contagem e na palavra AMEAÇA. Caixas de texto pretas a 88% como as dicas do jogo, 22 px x 30 px de folga,
         alinhadas à esquerda em x = 200, base em y = 940.
OBJECTS: o 763.2 via Kobrasol (pintura da Estrela, letreiro verde), o TICEN, o Mercado Público, a Praça XV com a
         figueira, o Terminal Velho com drones, a Sala I com o varal de lâmpadas, o personagem padrão de costas,
         a Ponte Hercílio Luz com o sol vermelho (arte do menu) e o logo do jogo.
MOTION:  câmera: power2.inOut; entrada de caixas de texto: recorte em steps(6) em 8 frames; logo: recorte em
         steps(12) em 18 frames; troca de cena: dissolução em blocos de 120 px em 12 frames; corrida do personagem:
         9 quadros a 15 qps (steps(9) em 0,6 s).
SHOTS:   0–7,5 s   TICEN: 763.2 a 5x e contagem 05:00 → recua para 2,5x sobre as plataformas; PLATAFORMA C · TICEN,
                   depois FLORIANÓPOLIS, 2067.
         7,5–11,5  Mercado Público a 3x, câmera recua da direita para a esquerda; FLORIA CONTROLA CADA ROTA DO CENTRO.
         11,5–15,5 Praça XV a 3x, câmera desce da figueira; QUEM SAI DA ROTA VIRA AMEAÇA (pancada horror-tension).
         15,5–19   Terminal Velho a 3x, drones na rua; tiros e uma explosão; sem texto.
         19–24,5   Sala I a 3x: personagem de costas na calçada; VOCÊ SAIU DA ROTA; corre para cima com passos; CORRA.
         24,5–30   Ponte com o sol vermelho; logo entra; PEGUE O 763.2 ANTES DA PARTIDA; contagem 04:35 a 04:31.
BANNED:  vazio escuro com coisas pequenas flutuando; glow, partículas e lens flare adicionados (o neon é só o que o
         jogo já desenha); tudo surgindo com fade e subindo; texto que se move enquanto é lido; molduras, cantos e
         HUD decorativo; logo pequeno num canto.
QA:      0,0 s (primeiro quadro já mostra o 763.2 e a contagem), 3,0, 7,2 (dissolução), 9,5, 13,5, 17,0, 20,5,
         23,0 (correndo), 27,0 e 29,8 (logo e frase legíveis).
