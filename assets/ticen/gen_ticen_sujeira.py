"""Sujeira cyberpunk do TICEN: decalques por cima do mapa fiel da Sala V.

ticen_sujeira.png (8 x 4 tiles):
  linha 0  chão: rachadura, rachadura, óleo, poça rosa, poça ciano, lixo, bitucas, respiro com vapor
  linha 1  parede: pichação rosa, pichação ciana, cartaz da Floria, cartaz rasgado, seta neon,
           adesivos, piso quebrado, escorrido de ferrugem
  linhas 2-3  telão holográfico da Floria (2x2) e letreiro "FLORIA TE VE" (4x1)

uso: python3 assets/ticen/gen_ticen_sujeira.py
"""
import math
import os
import random

from gen_ticen_assets import draw_text, centered  # noqa: F401
from room_palette import to_room_palette
from gen_mercado_assets import OL, Canvas, ellipse

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'tilesets')

PINK = (240, 86, 197)
CYAN = (92, 229, 241)
GREEN = (120, 255, 140)
DIRT = (30, 26, 24)


def a(color, alpha):
    return color[:3] + (alpha,)


def crack(cv, ox, oy, seed):
    rng = random.Random(seed)
    x, y = ox + rng.randint(2, 6), oy + rng.randint(1, 4)
    for _ in range(14):
        cv.put(x, y, a(DIRT, 200))
        if rng.random() < 0.3:
            cv.put(x + 1, y, a(DIRT, 120))
        x += rng.choice((0, 1, 1))
        y += rng.choice((0, 1))
        if not (ox <= x < ox + 16 and oy <= y < oy + 16):
            break


def oil(cv, ox, oy):
    for y in range(16):
        for x in range(16):
            d = ((x - 8) / 6) ** 2 + ((y - 9) / 4) ** 2
            if d <= 1:
                cv.put(ox + x, oy + y, a((16, 14, 20), int(150 * (1.2 - d))))
    cv.put(ox + 6, oy + 7, a(PINK, 120))
    cv.put(ox + 9, oy + 8, a(CYAN, 120))


def puddle(cv, ox, oy, glow):
    for y in range(16):
        for x in range(16):
            d = ((x - 8) / 7) ** 2 + ((y - 9) / 4.5) ** 2
            if d <= 1:
                cv.put(ox + x, oy + y, a((20, 26, 40), 170))
    # reflexo do neon tremendo na água
    for k in range(4):
        y = oy + 7 + k
        for x in range(ox + 5 + k % 2, ox + 12 - k % 2, 2):
            cv.put(x, y, a(glow, 200 - k * 35))


def litter(cv, ox, oy):
    cv.rect(ox + 2, oy + 8, ox + 7, oy + 12, a((220, 220, 210), 230))
    cv.rect(ox + 3, oy + 9, ox + 6, oy + 10, a((150, 150, 140), 230))
    cv.rect(ox + 9, oy + 4, ox + 13, oy + 7, a((200, 40, 46), 240))  # lata amassada
    cv.rect(ox + 9, oy + 4, ox + 10, oy + 7, a((240, 240, 240), 240))
    cv.put(ox + 12, oy + 12, a(CYAN, 220))  # embalagem com neon


def butts(cv, ox, oy, seed):
    rng = random.Random(seed)
    for _ in range(5):
        x, y = ox + rng.randint(2, 13), oy + rng.randint(3, 13)
        cv.rect(x, y, x + 2, y + 1, a((236, 220, 190), 230))
        cv.put(x + 2, y, a((200, 120, 60), 230))


def vent(cv, ox, oy):
    cv.rect(ox + 3, oy + 9, ox + 13, oy + 15, (50, 54, 60, 255))
    for x in range(ox + 4, ox + 13, 2):
        cv.rect(x, oy + 10, x + 1, oy + 14, (20, 22, 26, 255))
    for k in range(6):
        cv.put(ox + 6 + (k % 3) * 2, oy + 8 - k, a(GREEN, 140 - k * 18))


def tag(cv, ox, oy, color, seed):
    """Pichação: rabisco grosso com contorno, em neon."""
    rng = random.Random(seed)
    pts = set()
    x, y = ox + 2, oy + 9
    for t in range(12):
        y2 = oy + 9 + int(4 * math.sin(t * 1.3 + seed))
        for dy in (0, 1):
            pts.add((x, y2 + dy))
        x += 1
    for x, y in pts:
        cv.put(x, y, a(color, 230))
    for x, y in pts:
        for dx, dy in ((0, -1), (0, 2)):
            if (x, y + dy) not in pts and rng.random() < 0.7:
                cv.put(x, y + dy, a(OL, 160))
    cv.put(ox + 13, oy + 4, a(color, 230))


def floria_poster(cv, ox, oy, torn):
    cv.rect(ox + 2, oy + 1, ox + 14, oy + 15, a((24, 22, 40), 240))
    cv.rect(ox + 2, oy + 1, ox + 14, oy + 2, a(CYAN, 240))
    cv.shape(ellipse(ox + 8, oy + 7, 4, 2.4), a(CYAN, 240), outline=None)
    cv.shape(ellipse(ox + 8, oy + 7, 1.6, 1.6), a(PINK, 255), outline=None)
    cv.rect(ox + 4, oy + 11, ox + 12, oy + 12, a((200, 200, 220), 220))
    if torn:
        for y in range(oy + 9, oy + 15):
            for x in range(ox + 2 + (y - oy - 9) * 2, ox + 14):
                cv.put(x, y, (0, 0, 0, 0))
        cv.rect(ox + 8, oy + 13, ox + 14, oy + 15, a((180, 160, 140), 200))


def arrow(cv, ox, oy):
    for k in range(10):
        cv.put(ox + 3 + k, oy + 8, a(PINK, 240))
    for k in range(4):
        cv.put(ox + 12 - k, oy + 8 - k, a(PINK, 240))
        cv.put(ox + 12 - k, oy + 8 + k, a(PINK, 240))


def stickers(cv, ox, oy):
    for (x, y, c) in ((3, 3, CYAN), (9, 5, PINK), (5, 10, (250, 200, 40)), (11, 11, GREEN)):
        cv.rect(ox + x, oy + y, ox + x + 3, oy + y + 3, a(c, 230))


def broken_tiles(cv, ox, oy):
    for y in range(4, 13):
        for x in range(3, 13):
            if (x + y) % 5 == 0 or (x * y) % 11 == 0:
                cv.put(ox + x, oy + y, a(DIRT, 170))
    cv.rect(ox + 6, oy + 7, ox + 9, oy + 9, a((60, 56, 52), 230))


def rust(cv, ox, oy):
    for x in (5, 9, 10):
        for y in range(0, 10 + x % 4):
            cv.put(ox + x, oy + y, a((140, 70, 30), 150 - y * 10))


def holo_screen(cv, ox, oy):
    """Telão da Floria (2x2): o olho vigiando, com linhas de varredura."""
    for y in range(oy + 2, oy + 28):
        for x in range(ox + 2, ox + 30):
            scan = 150 if (y - oy) % 3 else 90
            cv.put(x, y, a((14, 40, 60), scan + 60))
    cv.rect(ox + 2, oy + 2, ox + 30, oy + 3, a(CYAN, 255))
    cv.rect(ox + 2, oy + 27, ox + 30, oy + 28, a(CYAN, 255))
    cv.shape(ellipse(ox + 16, oy + 13, 9, 5), a(CYAN, 230), outline=None)
    cv.shape(ellipse(ox + 16, oy + 13, 3.5, 3.5), a(PINK, 255), outline=None)
    cv.put(ox + 15, oy + 12, (255, 255, 255, 255))
    draw_text(cv, ox + 5, oy + 20, 'FLORIA', a(CYAN, 255))
    cv.rect(ox + 15, oy + 28, ox + 17, oy + 32, (50, 54, 60, 255))  # suporte


def neon_sign(cv, ox, oy):
    """Letreiro de neon (4x1) com halo."""
    text = 'FLORIA TE VE'
    for y in range(oy + 2, oy + 14):
        for x in range(ox + 1, ox + 63):
            cv.put(x, y, a((10, 8, 20), 200))
    draw_text(cv, ox + 32 - (len(text) * 4 - 1) // 2, oy + 5, text, a(PINK, 255))
    for x in range(ox + 1, ox + 63):
        cv.put(x, oy + 2, a(PINK, 160))
        cv.put(x, oy + 13, a(PINK, 160))


def build():
    cv = Canvas(128, 64)
    crack(cv, 0, 0, 1)
    crack(cv, 16, 0, 9)
    oil(cv, 32, 0)
    puddle(cv, 48, 0, PINK)
    puddle(cv, 64, 0, CYAN)
    litter(cv, 80, 0)
    butts(cv, 96, 0, 4)
    vent(cv, 112, 0)
    tag(cv, 0, 16, PINK, 2)
    tag(cv, 16, 16, CYAN, 5)
    floria_poster(cv, 32, 16, torn=False)
    floria_poster(cv, 48, 16, torn=True)
    arrow(cv, 64, 16)
    stickers(cv, 80, 16)
    broken_tiles(cv, 96, 16)
    rust(cv, 112, 16)
    holo_screen(cv, 0, 32)
    neon_sign(cv, 32, 32)
    return cv.img


if __name__ == '__main__':
    if '--original' in __import__('sys').argv:
        build().save(os.path.join(OUT, 'ticen_sujeira_original.png'))
    else:
        to_room_palette(build()).save(os.path.join(OUT, 'ticen_sujeira.png'))
    print('ok')
