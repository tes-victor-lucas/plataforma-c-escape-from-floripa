"""Interior do 763.2 via Kobrasol (Estrela) para o final da partida solo: um ônibus abandonado e destruído.

Quase preto com luz carmim: sol vermelho se pondo no mar com a ponte pênsil (Hercílio Luz) pela janela,
uma janela trincada, trepadeiras, bancos rasgados, entulho no chão e feixes de luz vermelha entrando.
Visto do corredor, de lado: o ônibus anda para a direita. O jogo amplia 3x (296x167 -> 888x501).

onibus-ceu.png             céu, sol e mar; fica parado atrás das janelas
onibus-vista.png           ponte e morros, com o céu vazado; corre quando o ônibus sai e repete a cada 296 px
onibus-interior.png        teto quebrado, janelas vazadas, trepadeiras, bancos, piso e feixes de luz
onibus-interior-frente.png assento do jogador e encosto do banco da frente, por cima das pernas dele

uso: python3 assets/ticen/gen_onibus_interior.py
"""
import math
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'ui')
W, H = 296, 167

K0 = (6, 6, 10, 255)
K1 = (12, 12, 20, 255)
K2 = (20, 20, 32, 255)
K3 = (30, 30, 46, 255)
K4 = (46, 44, 64, 255)
K5 = (72, 66, 88, 255)
R0 = (52, 6, 14, 255)
R1 = (98, 10, 24, 255)
R2 = (160, 18, 40, 255)
R3 = (220, 36, 56, 255)
R4 = (255, 96, 100, 255)
LEAF = (26, 34, 30, 255)
LEAF1 = (40, 52, 42, 255)

WINDOW_TOP, WINDOW_BOTTOM = 24, 78
PILLARS = range(0, W + 1, 74)
SEAT_XS = (14, 66, 118, 170, 222, 274)
# Banco onde o jogador senta (aceso pelo feixe): o encosto dele à esquerda, o do banco da frente à direita.
PLAYER_SEAT = 118
CUSHION_TOP = 120
FLOOR_TOP = 142
CRACKED_WINDOW = 1  # segunda janela, trincada como se uma pedra tivesse batido


def seat(d, x, rng, lit=False, front=False):
    """Banco de perfil virado para a frente (direita), rasgado; o do jogador recebe a luz vermelha."""
    body, edge, rim = (R1, R2, R3) if lit else (K3, K4, R1)
    if not front:
        d.polygon([(x, 90), (x + 9, 88), (x + 10, CUSHION_TOP + 4), (x + 1, CUSHION_TOP + 6)], fill=body, outline=K0)
        d.line((x + 9, 89, x + 10, CUSHION_TOP + 2), fill=rim)
        # rasgos no encosto com a espuma aparecendo
        for _ in range(2):
            ty = rng.randint(96, 112)
            d.line((x + 3, ty, x + 6, ty + 3), fill=K0)
            d.point((x + 4, ty + 1), fill=K5)
    d.rectangle((x, CUSHION_TOP, x + 30, CUSHION_TOP + 6), fill=body, outline=K0)
    d.line((x + 1, CUSHION_TOP + 1, x + 29, CUSHION_TOP + 1), fill=rim if lit else edge)
    d.line((x + 12, CUSHION_TOP + 2, x + 19, CUSHION_TOP + 4), fill=K0)  # assento rasgado
    d.rectangle((x + 4, CUSHION_TOP + 7, x + 26, FLOOR_TOP), fill=K1, outline=K0)
    d.line((x + 6, CUSHION_TOP + 9, x + 6, FLOOR_TOP - 2), fill=K2)


def vine(d, rng, x, y, length, step=1):
    """Trepadeira pendurada: caule escuro com folhas, algumas tocadas pela luz vermelha."""
    for k in range(length):
        x += rng.choice((-1, 0, 0, 1))
        y += step
        d.point((x, y), fill=LEAF)
        if k % 3 == 0:
            leaf = R2 if rng.random() < 0.35 else LEAF1
            side = rng.choice((-1, 1))
            d.point((x + side, y), fill=leaf)
            d.point((x + side * 2, y - 1), fill=leaf)


def sky():
    img = Image.new('RGBA', (W, H), K0)
    d = ImageDraw.Draw(img)
    horizon = 66
    for y in range(horizon):
        t = y / horizon
        d.line((0, y, W, y), fill=(int(14 + 70 * t), int(8 + 8 * t), int(20 + 10 * t), 255))
    sun = (196, 52)
    for r, color in ((26, (110, 14, 30, 255)), (21, (170, 20, 42, 255)), (17, (232, 28, 52, 255))):
        d.ellipse((sun[0] - r, sun[1] - r, sun[0] + r, sun[1] + r), fill=color)
    d.rectangle((0, horizon, W, H), fill=(18, 6, 14, 255))
    # o sol se esconde atrás do mar e deixa um reflexo em listras
    for k, y in enumerate(range(horizon + 1, horizon + 16, 2)):
        half = max(2, 18 - k * 2)
        d.line((sun[0] - half, y, sun[0] + half, y), fill=(200, 24, 46, 255) if k % 2 == 0 else (120, 14, 30, 255))
    return img


def view():
    """Ponte pênsil e morros no horizonte, com o céu transparente para o sol aparecer atrás."""
    rng = random.Random(4)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    horizon = 66
    # morros do continente ao fundo
    for x in range(W):
        top = horizon - 6 - int(5 * math.sin(x / 23) + 3 * math.sin(x / 9 + 1))
        d.line((x, top, x, horizon), fill=(26, 8, 18, 255))
    # ponte: duas torres, cabos em curva, pendurais e tabuleiro
    left, right, deck = 40, 210, horizon - 4
    tower_top = deck - 26
    for tx in (left + 40, right - 40):
        d.rectangle((tx - 2, tower_top, tx + 2, horizon), fill=K0)
        d.line((tx - 4, tower_top + 6, tx + 4, tower_top + 6), fill=K0)
    for x in range(left, right + 1):
        if x < left + 40:
            y = deck - (x - left) / 40 * 26
        elif x > right - 40:
            y = deck - (right - x) / 40 * 26
        else:
            mid = (left + right) / 2
            y = tower_top + 24 * (1 - ((x - mid) / ((right - left) / 2 - 40)) ** 2)
        d.point((x, int(y)), fill=K0)
        if x % 5 == 0:
            d.line((x, int(y), x, deck), fill=(14, 6, 12, 255))
    d.rectangle((left - 10, deck, right + 10, deck + 2), fill=K0)
    # brilho do sol nos cabos
    for x in range(left + 46, right - 46, 9):
        d.point((x, deck - 1), fill=R2)
    # postes que passam rente à janela quando o ônibus anda
    for px in (12, 262):  # longe das torres da ponte, para não escondê-las
        d.rectangle((px, 18, px + 3, H), fill=K0)
        d.point((px + 1, 18), fill=R3)
    return img


def interior():
    rng = random.Random(9)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # teto destruído: forro caído, vigas expostas e placas penduradas
    d.rectangle((0, 0, W, 17), fill=K1)
    for x in range(0, W, 24):
        d.line((x, 0, x + 6, 17), fill=K3)
    for x in rng.sample(range(10, W - 30, 12), 5):
        d.polygon([(x, 6), (x + 22, 4), (x + 18 + rng.randint(0, 6), 14 + rng.randint(0, 6))], fill=K2, outline=K0)
    d.line((0, 18, W, 18), fill=K4)
    # balaústre torto
    d.line((0, 20, W, 22), fill=K4)
    # paredes
    d.rectangle((0, 17, W, WINDOW_TOP - 1), fill=K2)
    d.rectangle((0, WINDOW_BOTTOM, W, FLOOR_TOP), fill=K2)
    d.rectangle((0, WINDOW_BOTTOM, W, WINDOW_BOTTOM + 2), fill=K3)
    for x in range(0, W, 6):  # painel descascado
        if rng.random() < 0.3:
            d.line((x, WINDOW_BOTTOM + 4, x, WINDOW_BOTTOM + 4 + rng.randint(2, 10)), fill=K1)
    # janelas vazadas com véu escuro de vidro sujo e borda acesa pelo pôr do sol
    d.rectangle((0, WINDOW_TOP, W, WINDOW_BOTTOM - 1), fill=(20, 8, 16, 46))
    for index, x in enumerate(PILLARS):
        d.rectangle((x - 3, WINDOW_TOP - 2, x + 3, WINDOW_BOTTOM + 2), fill=K3, outline=K0)
        d.line((x + 3, WINDOW_TOP, x + 3, WINDOW_BOTTOM), fill=R1)
    d.rectangle((0, WINDOW_TOP - 2, W, WINDOW_TOP), fill=K3)
    d.line((0, WINDOW_TOP, W, WINDOW_TOP), fill=R1)
    d.rectangle((0, WINDOW_BOTTOM - 1, W, WINDOW_BOTTOM + 1), fill=K3)
    # janela trincada: teia de rachaduras a partir do ponto do impacto
    cx, cy = 74 + 30, 48
    d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(40, 30, 40, 200))
    for k in range(11):
        angle = k / 11 * math.tau + rng.uniform(-0.2, 0.2)
        reach = rng.randint(14, 30)
        px, py = cx, cy
        for step in range(reach):
            px += math.cos(angle) + rng.uniform(-0.4, 0.4)
            py += math.sin(angle) + rng.uniform(-0.4, 0.4)
            if 76 < px < 146 and WINDOW_TOP < py < WINDOW_BOTTOM - 1:
                d.point((int(px), int(py)), fill=(200, 170, 180, 200) if step % 4 else R3)
    for r in (9, 17):
        d.ellipse((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), outline=(150, 120, 130, 120))
    # trepadeiras descendo das janelas e subindo pelas colunas
    for x in rng.sample(range(4, W - 4), 16):
        vine(d, rng, x, WINDOW_TOP - 1, rng.randint(8, 30))
    for x in PILLARS:
        vine(d, rng, x, WINDOW_BOTTOM + 30, 50, step=-1)
    # piso: entulho, folhas e mato nas frestas
    d.rectangle((0, FLOOR_TOP, W, H), fill=K1)
    for x in range(0, W, 9):
        d.line((x, FLOOR_TOP + 5, x + rng.randint(2, 7), FLOOR_TOP + 5 + rng.randint(-1, 1)), fill=K2)
    for _ in range(70):
        x, y = rng.randint(0, W - 1), rng.randint(FLOOR_TOP + 2, H - 2)
        d.point((x, y), fill=rng.choice((K3, K4, LEAF, LEAF1, R1)))
    for x in rng.sample(range(0, W, 3), 22):
        for k in range(rng.randint(2, 5)):
            d.point((x + rng.choice((-1, 0, 1)), H - 3 - k), fill=LEAF1)
    for x in SEAT_XS:
        seat(d, x, rng, lit=x == PLAYER_SEAT)
    # feixes de luz vermelha entrando pelas janelas e descendo até o chão
    rays = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for start in (96, 120, 150, 176):
        rd.polygon([(start, WINDOW_TOP + 8), (start + 9, WINDOW_TOP + 8), (start - 60, FLOOR_TOP + 14), (start - 72, FLOOR_TOP + 14)],
                   fill=(220, 30, 50, 34))
    img.alpha_composite(rays)
    return img


def front_layer():
    """Só o assento do jogador e o encosto do banco da frente: cobrem as pernas dele sentado."""
    rng = random.Random(9)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    seat(d, PLAYER_SEAT, rng, lit=True, front=True)
    nxt = PLAYER_SEAT + 52
    d.polygon([(nxt, 90), (nxt + 9, 88), (nxt + 10, CUSHION_TOP + 4), (nxt + 1, CUSHION_TOP + 6)], fill=K3, outline=K0)
    d.line((nxt + 9, 89, nxt + 10, CUSHION_TOP + 2), fill=R1)
    return img


# ---------------------------------------------------------------- passageiros

SKIN = (230, 180, 150, 255)
SKIN_D = (196, 140, 112, 255)
EYE = (20, 16, 20, 255)
GLASSES = (14, 12, 18, 255)


def seated_body(d, ox, shirt, shirt_d, pants, pants_d, shoes, skin=SKIN, skin_d=SKIN_D):
    """Corpo sentado de perfil, virado para a frente do ônibus (direita). `ox` é onde as costas encostam."""
    d.rectangle((ox + 16, 119, ox + 20, 139), fill=pants, outline=pants_d)          # canela
    d.rectangle((ox + 15, 139, ox + 24, 141), fill=shoes)                           # pé
    d.rectangle((ox + 1, 112, ox + 19, 119), fill=pants, outline=pants_d)           # coxa no assento
    d.rectangle((ox + 1, 99, ox + 10, 117), fill=shirt, outline=shirt_d)            # tronco
    d.rectangle((ox + 4, 101, ox + 7, 111), fill=shirt_d)                           # braço
    d.rectangle((ox + 6, 109, ox + 15, 112), fill=shirt_d)                          # antebraço no colo
    d.rectangle((ox + 15, 109, ox + 17, 112), fill=skin)                            # mão
    d.rectangle((ox + 5, 96, ox + 8, 99), fill=skin_d)                              # pescoço
    d.rectangle((ox + 2, 87, ox + 11, 97), fill=skin, outline=skin_d)               # cabeça
    d.rectangle((ox + 12, 91, ox + 12, 93), fill=skin_d)                            # nariz
    d.point((ox + 9, 91), fill=EYE)
    d.line((ox + 9, 95, ox + 11, 95), fill=skin_d)                                  # boca


def round_glasses(d, ox):
    """Óculos de armação escura e fina; um ponto claro é o reflexo na lente."""
    d.rectangle((ox + 8, 89, ox + 11, 92), outline=GLASSES)
    d.line((ox + 4, 90, ox + 8, 90), fill=GLASSES)                                  # haste até a orelha
    d.point((ox + 10, 90), fill=(200, 210, 220, 255))


def gaucho(d, ox):
    """Gaúcho de chapéu, bigode, poncho listrado, bombacha e uma cuia de chimarrão na mão."""
    seated_body(d, ox, (180, 40, 36, 255), (120, 24, 24, 255), (120, 110, 96, 255), (84, 76, 66, 255), K0)
    d.rectangle((ox + 15, 124, ox + 21, 141), fill=K0)                              # bota até a canela
    d.rectangle((ox, 113, ox + 20, 121), fill=(120, 110, 96, 255), outline=(84, 76, 66, 255))  # bombacha larga
    # poncho caindo dos ombros sobre o tronco e os braços, com listras amarelas
    d.polygon([(ox, 98), (ox + 11, 98), (ox + 15, 114), (ox - 1, 114)], fill=(180, 40, 36, 255), outline=(110, 20, 22, 255))
    for y in (103, 109):
        d.line((ox, y, ox + 13, y), fill=(230, 180, 40, 255))
    d.rectangle((ox + 15, 109, ox + 17, 112), fill=SKIN)
    # cuia de chimarrão com a bomba de metal
    d.rectangle((ox + 16, 104, ox + 19, 109), fill=(70, 100, 50, 255), outline=(40, 60, 30, 255))
    d.line((ox + 18, 99, ox + 18, 104), fill=(200, 200, 210, 255))
    d.rectangle((ox + 2, 88, ox + 4, 94), fill=(60, 40, 28, 255))                   # cabelo atrás
    d.line((ox + 9, 94, ox + 12, 94), fill=(50, 32, 24, 255))                       # bigode
    d.rectangle((ox - 2, 86, ox + 14, 87), fill=K0)                                 # aba larga
    d.rectangle((ox + 2, 81, ox + 10, 85), fill=K0)                                 # copa
    d.line((ox + 2, 85, ox + 10, 85), fill=R2)                                      # fita


def dog_man(d, ox):
    """Meio homem, meio cachorro: cabelo castanho cacheado e volumoso, óculos de armação escura,
    camiseta escura e focinho de pug."""
    seated_body(d, ox, (44, 44, 52, 255), (26, 26, 32, 255), (40, 52, 90, 255), (24, 32, 60, 255), (230, 230, 236, 255))
    curl, curl_d, curl_l = (104, 66, 38, 255), (62, 38, 22, 255), (150, 100, 58, 255)
    # cachos: bolinhas por cima, atrás da cabeça e caindo na testa
    for cx, cy in ((2, 85), (5, 83), (8, 83), (11, 85), (13, 87), (1, 88), (4, 86), (7, 86), (10, 87), (1, 91), (2, 94), (12, 89)):
        d.ellipse((ox + cx - 2, cy - 2, ox + cx + 1, cy + 1), fill=curl, outline=curl_d)
        d.point((ox + cx - 1, cy - 1), fill=curl_l)
    round_glasses(d, ox)
    # focinho de pug saindo do rosto, com o nariz preto
    d.rectangle((ox + 10, 92, ox + 14, 97), fill=(66, 50, 44, 255), outline=(36, 26, 22, 255))
    d.rectangle((ox + 13, 92, ox + 14, 93), fill=K0)
    d.line((ox + 11, 96, ox + 13, 96), fill=(40, 20, 20, 255))


def cat(d, seat_x):
    """Gato preto e branco dormindo enrolado sozinho no assento, com a mancha preta de bigodinho no focinho."""
    white, white_d, black = (236, 236, 236, 255), (186, 186, 196, 255), (14, 12, 16, 255)
    x = seat_x
    # rabo preto enrolado para a frente do corpo
    d.arc((x + 7, 110, x + 15, 121), 90, 300, fill=black, width=2)
    d.ellipse((x + 9, 110, x + 27, 121), fill=white, outline=white_d)                # corpo deitado
    d.ellipse((x + 12, 111, x + 19, 117), fill=black)                               # manchas
    d.ellipse((x + 20, 115, x + 24, 119), fill=black)
    d.ellipse((x + 23, 105, x + 32, 114), fill=white, outline=white_d)              # cabeça
    d.polygon([(x + 24, 107), (x + 25, 102), (x + 28, 106)], fill=black)             # orelhas
    d.polygon([(x + 28, 106), (x + 31, 102), (x + 32, 108)], fill=black)
    d.rectangle((x + 23, 105, x + 27, 108), fill=black)                             # mancha preta na cabeça
    d.line((x + 26, 109, x + 27, 109), fill=black)                                  # olhos fechados
    d.line((x + 29, 109, x + 30, 109), fill=black)
    d.point((x + 31, 110), fill=(250, 150, 170, 255))                               # nariz
    d.line((x + 29, 111, x + 32, 111), fill=black)                                  # bigodinho
    d.point((x + 30, 112), fill=black)


def grade(img):
    """Leva os passageiros para a luz do ônibus: mais escuros, puxados para o vermelho e com borda vermelha
    do lado da janela (em cima e à direita)."""
    px = img.load()
    solid = {(x, y) for y in range(H) for x in range(W) if px[x, y][3]}
    for x, y in solid:
        r, g, b, a = px[x, y]
        if max(r, g, b) < 30:
            continue  # preto continua preto
        r, g, b = int(r * 0.62 + 18), int(g * 0.4), int(b * 0.48)
        if (x + 1, y) not in solid or (x, y - 1) not in solid:
            r, g, b = (r + R3[0]) // 2, (g + R3[1]) // 2, (b + R3[2]) // 2
        px[x, y] = (r, g, b, a)
    for x, y in solid:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in solid and 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] == 0:
                px[nx, ny] = K0
    return img


# Bancos ocupados: o gato no banco do fundo, o gaúcho atrás do jogador e o homem-cachorro mais à frente.
PASSENGERS = ((66, gaucho), (222, dog_man))
CAT_SEAT = 14


def passengers():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for seat_x, draw in PASSENGERS:
        draw(d, seat_x + 9)
    cat(d, CAT_SEAT)
    return grade(img)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sky().save(os.path.join(OUT, 'onibus-ceu.png'))
    view().save(os.path.join(OUT, 'onibus-vista.png'))
    interior().save(os.path.join(OUT, 'onibus-interior.png'))
    front_layer().save(os.path.join(OUT, 'onibus-interior-frente.png'))
    passengers().save(os.path.join(OUT, 'onibus-passageiros.png'))
    print('ok')
