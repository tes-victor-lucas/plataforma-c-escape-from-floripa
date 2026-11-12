"""Interior do 763.2 via Kobrasol (Estrela) para o final da partida solo.

Visto do corredor, de lado: o ônibus anda para a direita. O jogo amplia 3x (296x167 -> 888x501).

onibus-interior.png        teto, balaústre, janelas vazadas, painel verde-água, bancos e piso
onibus-interior-frente.png assento e encosto do banco da frente, desenhados por cima das pernas do jogador
onibus-vista.png           o TICEN de noite pela janela; repete na horizontal e corre quando o ônibus sai

uso: python3 assets/ticen/gen_onibus_interior.py
"""
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'ui')
W, H = 296, 167

TEAL0 = (22, 112, 106, 255)
TEAL1 = (40, 156, 146, 255)
TEAL2 = (92, 196, 184, 255)
YELLOW = (240, 200, 40, 255)
CEIL0 = (40, 42, 48, 255)
CEIL1 = (60, 63, 70, 255)
METAL0 = (110, 116, 124, 255)
METAL1 = (170, 176, 184, 255)
FLOOR0 = (34, 36, 42, 255)
FLOOR1 = (46, 48, 56, 255)
SEAT0 = (16, 70, 84, 255)
SEAT1 = (26, 104, 120, 255)
SEAT2 = (54, 140, 152, 255)
OUTLINE = (12, 14, 20, 255)
LIGHT = (250, 244, 210, 255)

WINDOW_TOP, WINDOW_BOTTOM = 24, 78
PILLARS = range(0, W + 1, 74)
SEAT_XS = (14, 66, 118, 170, 222, 274)
# Banco onde o jogador senta: o encosto dele fica à esquerda e o do banco da frente à direita.
PLAYER_SEAT = 118
CUSHION_TOP = 120
FLOOR_TOP = 142


def seat(d, x, front=False):
    """Banco de perfil virado para a frente do ônibus (direita): encosto alto e assento."""
    if not front:
        d.rectangle((x, 92, x + 8, CUSHION_TOP + 6), fill=SEAT1, outline=OUTLINE)
        d.rectangle((x + 2, 94, x + 3, CUSHION_TOP + 4), fill=SEAT2)
        d.rectangle((x - 1, 90, x + 9, 93), fill=SEAT0, outline=OUTLINE)  # pega-mão
    d.rectangle((x, CUSHION_TOP, x + 30, CUSHION_TOP + 7), fill=SEAT1, outline=OUTLINE)
    d.line((x + 1, CUSHION_TOP + 1, x + 29, CUSHION_TOP + 1), fill=SEAT2)
    d.rectangle((x + 4, CUSHION_TOP + 8, x + 26, FLOOR_TOP), fill=SEAT0, outline=OUTLINE)  # saia do banco
    # estrela amarela bordada no encosto, como no logo
    for dx, dy in ((2, 0), (1, 1), (2, 1), (3, 1), (2, 2)):
        d.point((x + 2 + dx, 104 + dy), fill=YELLOW)


def interior():
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # teto e luminária
    d.rectangle((0, 0, W, 16), fill=CEIL0)
    d.rectangle((0, 12, W, 16), fill=CEIL1)
    for x in range(10, W, 60):
        d.rectangle((x, 4, x + 34, 8), fill=LIGHT)
    # balaústre com alças
    d.line((0, 19, W, 19), fill=METAL1, width=2)
    for x in range(20, W, 37):
        d.line((x, 20, x, 27), fill=METAL0)
        d.ellipse((x - 3, 27, x + 3, 33), outline=METAL1)
    # parede entre teto e janela
    d.rectangle((0, 17, W, WINDOW_TOP - 1), fill=TEAL1)
    d.rectangle((0, WINDOW_BOTTOM, W, FLOOR_TOP), fill=TEAL0)
    d.rectangle((0, WINDOW_BOTTOM, W, WINDOW_BOTTOM + 3), fill=TEAL2)
    d.rectangle((0, 112, W, 114), fill=YELLOW)  # faixa da Estrela
    # janelas vazadas, com um véu de vidro e reflexo diagonal
    d.rectangle((0, WINDOW_TOP, W, WINDOW_BOTTOM - 1), fill=(120, 200, 220, 38))
    for x in range(-40, W, 74):
        for k in range(10):
            d.line((x + k + 30, WINDOW_TOP, x + k, WINDOW_BOTTOM - 1), fill=(220, 250, 255, 26))
    for x in PILLARS:
        d.rectangle((x - 3, WINDOW_TOP - 2, x + 3, WINDOW_BOTTOM + 2), fill=METAL0, outline=OUTLINE)
    d.rectangle((0, WINDOW_TOP - 2, W, WINDOW_TOP), fill=METAL0)
    d.rectangle((0, WINDOW_BOTTOM - 1, W, WINDOW_BOTTOM + 1), fill=METAL0)
    # piso com a faixa de segurança
    d.rectangle((0, FLOOR_TOP, W, H), fill=FLOOR0)
    for x in range(0, W, 8):
        d.line((x, FLOOR_TOP + 6, x + 4, FLOOR_TOP + 6), fill=FLOOR1)
    d.rectangle((0, H - 6, W, H - 4), fill=YELLOW)
    for x in SEAT_XS:
        seat(d, x)
    return img


def front_layer():
    """Só o assento do banco do jogador e o encosto do banco da frente: cobrem as pernas dele."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    seat(d, PLAYER_SEAT, front=True)
    nxt = PLAYER_SEAT + 52
    d.rectangle((nxt, 92, nxt + 8, CUSHION_TOP + 6), fill=SEAT1, outline=OUTLINE)
    d.rectangle((nxt + 2, 94, nxt + 3, CUSHION_TOP + 4), fill=SEAT2)
    d.rectangle((nxt - 1, 90, nxt + 9, 93), fill=SEAT0, outline=OUTLINE)
    return img


def view():
    """TICEN de noite pela janela: céu, prédios com janelas acesas, postes. Repete a cada 296 px."""
    rng = random.Random(4)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line((0, y, W, y), fill=(int(10 + 30 * t), int(14 + 20 * t), int(40 + 30 * t), 255))
    x = 0
    while x < W:
        w = rng.randint(22, 46)
        top = rng.randint(30, 60)
        shade = rng.choice(((24, 28, 44), (30, 34, 52), (20, 22, 36)))
        d.rectangle((x, top, min(W - 1, x + w), H), fill=shade + (255,))
        for wy in range(top + 4, WINDOW_BOTTOM + 10, 6):
            for wx in range(x + 3, min(W - 3, x + w - 3), 5):
                if rng.random() < 0.45:
                    d.rectangle((wx, wy, wx + 2, wy + 2), fill=rng.choice(((255, 200, 90), (110, 226, 255), (240, 86, 197))) + (255,))
        x += w + rng.randint(0, 6)
    # postes do terminal passando rente à janela
    for px in range(30, W, 99):
        d.rectangle((px, 20, px + 3, H), fill=(14, 16, 22, 255))
        d.ellipse((px - 4, 16, px + 7, 24), fill=(255, 220, 140, 255))
    return img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    interior().save(os.path.join(OUT, 'onibus-interior.png'))
    front_layer().save(os.path.join(OUT, 'onibus-interior-frente.png'))
    view().save(os.path.join(OUT, 'onibus-vista.png'))
    print('ok')
