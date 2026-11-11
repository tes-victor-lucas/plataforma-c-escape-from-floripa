"""Fila do TCHAY na Sala I: pessoas em pé, andando e saindo com o copão, e o letreiro neon.

fila-tchay.png     quadros de 16x24, uma linha por pessoa (6), viradas para a direita:
                   0-1 parado (respirando), 2-3 andando, 4-5 andando com o copão
tchay-letreiro.png 64x24: letreiro neon do bar
bares-populares.png 128x48: Gatus Rock Bar e Bar do Noel (64x48 cada) na calçada de baixo
pagode.png         quadros de 16x16 (bustos atrás da mesa): pandeiro, cavaquinho e copo, 2 quadros cada
pagode-mesa.png    64x16: mesa vermelha da roda de pagode

uso: python3 assets/room1/gen_tchay.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mercado-publico'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ticen'))
from gen_mercado_assets import OL, Canvas, ellipse  # noqa: E402,F401
from gen_ticen_assets import centered, draw_text  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets')

SKINS = [(236, 196, 170, 255), (190, 140, 100, 255), (120, 80, 56, 255)]
# cabelo, roupa de cima, calça
PEOPLE = [
    ((30, 26, 30, 255), (34, 34, 40, 255), (60, 70, 100, 255)),       # moletom preto
    ((90, 60, 40, 255), (70, 110, 70, 255), (190, 180, 150, 255)),    # jaqueta verde, calça clara
    ((20, 18, 24, 255), (60, 100, 160, 255), (40, 44, 60, 255)),      # jaqueta jeans
    ((230, 110, 180, 255), (240, 240, 236, 255), (30, 30, 36, 255)),  # cabelo rosa, camiseta branca
    ((140, 90, 50, 255), (200, 60, 60, 255), (70, 64, 60, 255)),      # blusa vermelha
    ((50, 40, 30, 255), (110, 90, 130, 255), (50, 60, 90, 255)),      # moletom roxo
]
SHOE = (20, 20, 24, 255)
CUP = (220, 236, 240, 255)
DRINK = (240, 110, 60, 255)
STRAW = (20, 20, 24, 255)


def person(cv, ox, oy, hair, top, pants, skin, frame):
    walking = frame >= 2
    cup = frame >= 4
    step = frame % 2
    bob = 1 if frame == 1 else 0
    # pernas
    if walking:
        for lx, lift in ((ox + 6, step), (ox + 9, 1 - step)):
            cv.rect(lx, oy + 16, lx + 2, oy + 22 - lift, pants)
            cv.rect(lx, oy + 22 - lift, lx + 3, oy + 23 - lift, SHOE)
    else:
        for lx in (ox + 6, ox + 9):
            cv.rect(lx, oy + 16, lx + 2, oy + 22, pants)
            cv.rect(lx, oy + 22, lx + 3, oy + 23, SHOE)
    # tronco e cabeça (perfil virado para a direita)
    cv.rect(ox + 5, oy + 9 + bob, ox + 11, oy + 17, top)
    cv.rect(ox + 6, oy + 3 + bob, ox + 11, oy + 9 + bob, skin)
    cv.rect(ox + 5, oy + 2 + bob, ox + 11, oy + 4 + bob, hair)
    cv.rect(ox + 5, oy + 4 + bob, ox + 7, oy + 7 + bob, hair)
    cv.put(ox + 9, oy + 5 + bob, OL)
    # braço: balança ao andar ou segura o copão na frente do corpo
    if cup:
        cv.rect(ox + 9, oy + 11, ox + 12, oy + 13, skin)
        cv.shape([(x, y) for y in range(oy + 8, oy + 15) for x in range(ox + 11, ox + 16)
                  if x - ox - 11 >= (y - oy - 8) // 4], lambda x, y: DRINK if y > oy + 10 else CUP)
        cv.rect(ox + 13, oy + 5, ox + 14, oy + 9, STRAW)
    else:
        swing = step if walking else 0
        cv.rect(ox + 7 + swing, oy + 10 + bob, ox + 9 + swing, oy + 15 + bob, skin)


def outline(cv, x0, y0, w, h):
    solid = {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w) if cv.get(x, y)[3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in solid and x0 <= n[0] < x0 + w and y0 <= n[1] < y0 + h:
                cv.put(*n, OL)


def build_people():
    cv = Canvas(16 * 6, 24 * len(PEOPLE))
    for row, (hair, top, pants) in enumerate(PEOPLE):
        skin = SKINS[row % len(SKINS)]
        for frame in range(6):
            person(cv, frame * 16, row * 24, hair, top, pants, skin, frame)
            outline(cv, frame * 16, row * 24, 16, 24)
    return cv.img


def build_sign():
    cv = Canvas(64, 24)
    green = (120, 255, 140, 255)
    cv.shape([(x, y) for y in range(2, 22) for x in range(1, 63)], (12, 16, 18, 240))
    for x in range(2, 62):
        cv.put(x, 3, (60, 160, 80, 255))
        cv.put(x, 20, (60, 160, 80, 255))
    centered(cv, 34, 7, 'TCHAY', green, 2)
    # copinho neon ao lado do nome
    cv.shape([(x, y) for y in range(6, 18) for x in range(5, 13) if x - 5 >= (y - 6) // 5], (240, 110, 60, 255))
    cv.rect(10, 3, 11, 7, green)
    return cv.img


# Paleta da Sala I (floor_and_buildings-01): azul-petróleo, vermelhos e o dourado.
TEAL0 = (0, 48, 54, 255)
TEAL1 = (1, 102, 114, 255)
TEAL2 = (3, 127, 140, 255)
CYAN = (71, 193, 206, 255)
RED0 = (155, 0, 22, 255)
RED1 = (191, 4, 4, 255)
GOLD = (240, 190, 104, 255)
WARM = (255, 214, 130, 255)


def popular_bar(cv, ox, name, neon, sub=None):
    """Barzinho de esquina (3x3): placa neon (uma ou duas linhas), toldo listrado e balcão com garrafas."""
    # corpo azul-petróleo
    cv.shape([(x, y) for y in range(12, 46) for x in range(ox + 2, ox + 46)], TEAL1)
    cv.rect(ox + 2, 12, ox + 46, 14, TEAL2)
    # placa com o nome em neon
    cv.shape([(x, y) for y in range(0, 14 if sub else 12) for x in range(ox + 1, ox + 47)], (14, 16, 22, 255))
    if sub:
        centered(cv, ox + 24, 1, name, neon)
        centered(cv, ox + 24, 7, sub, neon[:3] + (200,))
    else:
        centered(cv, ox + 24, 4, name, neon)
        for x in range(ox + 2, ox + 46):
            cv.put(x, 1, neon[:3] + (140,))
    # toldo listrado
    for x in range(ox + 3, ox + 45):
        color = RED1 if ((x - ox) // 4) % 2 else (215, 222, 212, 255)
        for y in range(14, 19):
            cv.put(x, y, color)
        if (x - ox) % 4 == 0:
            cv.put(x, 19, color)
    # vão do balcão iluminado com garrafas
    cv.shape([(x, y) for y in range(21, 36) for x in range(ox + 6, ox + 42)], (70, 40, 30, 255))
    for x in range(ox + 7, ox + 41):
        for y in range(22, 35):
            if y < 28:
                cv.put(x, y, WARM if (x + y) % 7 else GOLD)
    for k, bx in enumerate(range(ox + 9, ox + 39, 4)):
        cv.rect(bx, 26, bx + 2, 31, (RED0, CYAN, GOLD, (90, 160, 90, 255))[k % 4])
        cv.put(bx, 25, (30, 30, 30, 255))
    # tampo do balcão e frente com o logo de copo
    cv.rect(ox + 4, 36, ox + 44, 39, (215, 222, 212, 255))
    cv.rect(ox + 4, 39, ox + 44, 40, OL)
    cv.shape([(x, y) for y in range(40, 46) for x in range(ox + 4, ox + 44)], TEAL0)
    cv.shape([(x, y) for y in range(41, 45) for x in range(ox + 21, ox + 27) if x - ox - 21 >= (y - 41) // 3], neon)


ROSE0 = (122, 48, 48, 255)
ROSE1 = (168, 78, 72, 255)
ROSE2 = (196, 106, 96, 255)
PEEL = (215, 222, 212, 255)
MAROON0 = (83, 21, 22, 255)
MAROON1 = (110, 30, 36, 255)
ORANGE0 = (176, 72, 26, 255)
ORANGE1 = (214, 104, 44, 255)
ORANGE2 = (236, 140, 70, 255)
INK = (26, 26, 26, 255)
CAT_EYE = (240, 200, 60, 255)


def wall(cv, ox, w, h, base, dark, light, seed):
    """Parede gasta: reboco com manchas escuras e tinta descascando."""
    import random
    rng = random.Random(seed)
    for y in range(h):
        for x in range(w):
            c = base
            n = rng.random()
            if n < 0.08:
                c = dark
            elif n < 0.11:
                c = light
            cv.put(ox + x, y, c)
    for _ in range(5):
        px, py = ox + rng.randint(2, w - 8), rng.randint(2, h - 8)
        for k in range(rng.randint(3, 6)):
            cv.rect(px + k % 3, py + k // 2, px + k % 3 + 2, py + k // 2 + 1, PEEL)


def gatus(cv, ox):
    """Gatus Rock Bar: parede rosada descascada, mural de fogo, toldo bordô e placa com o gato."""
    wall(cv, ox, 64, 48, ROSE1, ROSE0, ROSE2, 7)
    # mural de fogo vermelho e amarelo atrás do toldo
    for y in range(8, 46):
        for x in range(ox + 2, ox + 30):
            t = (x * 3 + y * 5 + (x * y) % 7) % 16
            cv.put(x, y, (240, 190, 60, 255) if t < 5 else (230, 120, 40, 255) if t < 10 else (200, 40, 40, 255))
    cv.rect(ox + 6, 30, ox + 9, 33, (71, 193, 206, 255))  # adesivo
    # porta e vitrine escuras com luz quente
    cv.shape([(x, y) for y in range(28, 47) for x in range(ox + 4, ox + 40)], (40, 24, 22, 255))
    for x in range(ox + 6, ox + 38):
        for y in range(30, 40):
            if (x + y) % 6:
                cv.put(x, y, WARM if y < 35 else GOLD)
    cv.rect(ox + 21, 28, ox + 22, 47, INK)
    # toldo bordô inclinado, mais estreito em cima
    for y in range(12, 28):
        inset = max(0, (20 - y)) // 2
        for x in range(ox + 1 + inset, ox + 43 - inset):
            cv.put(x, y, MAROON1 if (x + y // 3) % 9 else MAROON0)
    cv.rect(ox + 1, 26, ox + 43, 29, MAROON0)
    cv.rect(ox + 1, 29, ox + 43, 30, INK)
    # placa branca saindo da parede, com o gato preto
    cv.shape([(x, y) for y in range(3, 20) for x in range(ox + 28, ox + 63)], (238, 236, 244, 255))
    cv.rect(ox + 61, 3, ox + 63, 20, (60, 60, 70, 255))
    # gato preto sentado de perfil: orelhas, cabeça, corpo e o rabo enrolado
    cat_rows = ['1.1...', '111...', '111...', '.11...', '.111..', '.1111.', '.1111.', '11111.', '111111', '.....1']
    for dy, line in enumerate(cat_rows):
        for dx, bit in enumerate(line):
            if bit == '1':
                cv.put(ox + 30 + dx, 6 + dy, INK)
    cv.put(ox + 31, 7, CAT_EYE)
    draw_text(cv, ox + 37, 6, 'GATUS', INK)
    draw_text(cv, ox + 37, 12, 'ROCK', INK)


def noel(cv, ox):
    """Bar do Noel: parede laranja gasta, sacada de ferro, portas escuras, placa redonda e o mural."""
    wall(cv, ox, 64, 48, ORANGE1, ORANGE0, ORANGE2, 3)
    # sacada de ferro com arabescos
    cv.rect(ox, 6, ox + 64, 7, INK)
    for x in range(ox, ox + 64, 4):
        cv.rect(x, 0, x + 1, 7, INK)
        cv.put(x + 2, 2, INK)
        cv.put(x + 2, 4, INK)
    cv.rect(ox, 7, ox + 64, 9, (90, 60, 50, 255))
    # duas portas escuras com luminária e um quadro
    for dx in (4, 20):
        cv.shape([(x, y) for y in range(20, 47) for x in range(ox + dx, ox + dx + 12)], (36, 26, 24, 255))
        cv.rect(ox + dx + 4, 15, ox + dx + 8, 18, WARM)
    cv.shape([(x, y) for y in range(26, 33) for x in range(ox + 23, ox + 29)], (200, 200, 190, 255))
    # placa redonda laranja com o nome e canecas de chope
    for y in range(8, 34):
        for x in range(ox + 32, ox + 64):
            d = ((x - ox - 48) / 15.5) ** 2 + ((y - 21) / 12.5) ** 2
            if d <= 1:
                cv.put(x, y, INK if d > 0.84 else (240, 150, 40, 255))
    centered(cv, ox + 48, 14, 'BAR DO', INK)
    centered(cv, ox + 48, 21, 'NOEL', INK)
    cv.rect(ox + 52, 27, ox + 55, 30, GOLD)
    cv.rect(ox + 56, 27, ox + 59, 30, GOLD)
    # mural do sambista de chapéu, no pé da parede
    cv.shape(ellipse(ox + 50, 41, 5, 6), (236, 232, 222, 255))
    cv.rect(ox + 44, 34, ox + 57, 36, INK)  # chapéu
    cv.rect(ox + 46, 32, ox + 55, 34, INK)
    cv.put(ox + 48, 40, INK)
    cv.put(ox + 52, 40, INK)
    cv.rect(ox + 49, 47, ox + 51, 48, (200, 40, 40, 255))
    for k in range(3):
        cv.rect(ox + 36, 38 + k * 3, ox + 42, 39 + k * 3, (236, 232, 222, 255))  # frase pintada


NEON_CYAN = (71, 193, 206, 255)
NEON_PINK = (255, 90, 170, 255)
WIRE = (20, 22, 28, 255)


def cyber_touches(cv, ox, wires, sticker, screen):
    """Toque cyberpunk leve: fios pendurados, adesivo do olho da Floria e um painel holográfico."""
    # fios caindo em curva só pela parede livre, sem cruzar as placas
    wires_y, spans = wires
    for k, (x0, x1) in enumerate((ox + a, ox + b) for a, b in spans):
        for x in range(x0, x1):
            t = (x - x0) / (x1 - x0)
            cv.put(x, wires_y + k * 2 + int(5 * 4 * t * (1 - t)), WIRE)
    # adesivo da Floria: olho ciano com a pupila rosa
    sx, sy = sticker
    cv.rect(sx, sy, sx + 7, sy + 5, (14, 16, 22, 255))
    cv.rect(sx + 1, sy + 2, sx + 6, sy + 3, NEON_CYAN)
    cv.put(sx + 3, sy + 2, NEON_PINK)
    cv.put(sx + 3, sy + 1, NEON_CYAN)
    cv.put(sx + 3, sy + 3, NEON_CYAN)
    # painel holográfico com linhas de cardápio
    px, py, pw, ph = screen
    cv.rect(px, py, px + pw, py + ph, (8, 24, 30, 255))
    cv.rect(px, py, px + pw, py + 1, NEON_CYAN)
    for k in range(2, ph - 1, 2):
        cv.rect(px + 1, py + k, px + pw - 1 - (k % 3), py + k + 1, (60, 170, 190, 255))


def led_strip(cv, x0, x1, y):
    for x in range(x0, x1, 2):
        cv.put(x, y, NEON_PINK if (x // 2) % 2 else NEON_CYAN)


def build_popular_bars():
    """Bares conhecidos do Centro (Gatus Rock Bar e Bar do Noel), 64x48 cada, com toque cyberpunk."""
    cv = Canvas(128, 48)
    gatus(cv, 0)
    # Gatus: tubo de neon em volta da placa, LED sob o toldo, fios, adesivo e cardápio holográfico
    for x in range(27, 64):
        cv.put(x, 2, NEON_CYAN)
        cv.put(x, 20, NEON_CYAN)
    for y in range(2, 21):
        cv.put(27, y, NEON_CYAN)
    led_strip(cv, 2, 43, 30)
    cyber_touches(cv, 0, (1, ((2, 26), (8, 25))), sticker=(48, 24), screen=(44, 34, 14, 11))
    noel(cv, 64)
    # Noel: anel de neon em volta da placa redonda, LED na sacada, fios, adesivo e telinha
    for y in range(6, 36):
        for x in range(64 + 30, 128):
            d = ((x - 64 - 48) / 17) ** 2 + ((y - 21) / 14) ** 2
            if 0.93 <= d <= 1.05:
                cv.put(x, y, NEON_CYAN)
    led_strip(cv, 64, 128, 7)
    cyber_touches(cv, 64, (9, ((0, 28), (10, 30))), sticker=(64 + 6, 36), screen=(64 + 22, 25, 8, 9))
    return cv.img


PAGODE_SHIRTS = [(214, 104, 44, 255), (240, 240, 236, 255), (60, 100, 160, 255), (200, 60, 60, 255)]


def pagode_person(cv, ox, oy, shirt, skin, hair, frame):
    """Busto de frente atrás da mesa (16x16): pandeiro, cavaquinho ou copo, dois quadros cada."""
    kind, step = frame // 2, frame % 2
    cv.rect(ox + 4, oy + 9, ox + 12, oy + 16, shirt)
    cv.rect(ox + 5, oy + 2, ox + 11, oy + 8, skin)
    cv.rect(ox + 5, oy + 1, ox + 11, oy + 3, hair)
    cv.put(ox + 7, oy + 5, INK)
    cv.put(ox + 9, oy + 5, INK)
    if kind == 0:
        # pandeiro erguido, batendo
        cv.shape(ellipse(ox + 12, oy + 8 - step, 3, 3), (220, 200, 160, 255))
        for k in range(4):
            cv.put(ox + 10 + k, oy + 5 - step + (k % 2) * 6, GOLD)
        cv.rect(ox + 2, oy + 9 + step, ox + 5, oy + 12 + step, skin)
    elif kind == 1:
        # cavaquinho atravessado no peito
        for k in range(10):
            cv.put(ox + 2 + k, oy + 13 - k // 2, (120, 70, 40, 255))
        cv.shape(ellipse(ox + 5, oy + 13, 2.5, 2), (170, 110, 60, 255))
        cv.rect(ox + 4 + step, oy + 11, ox + 6 + step, oy + 13, skin)
    else:
        # copo de chope levantado
        cv.rect(ox + 11, oy + 7 + step * 3, ox + 14, oy + 11 + step * 3, GOLD)
        cv.rect(ox + 11, oy + 7 + step * 3, ox + 14, oy + 8 + step * 3, (250, 250, 240, 255))


def build_pagode():
    cv = Canvas(96, 64)
    for row, shirt in enumerate(PAGODE_SHIRTS):
        skin = SKINS[row % len(SKINS)]
        hair = ((30, 26, 30, 255), (90, 60, 40, 255), (20, 18, 24, 255), (60, 50, 40, 255))[row]
        for frame in range(6):
            pagode_person(cv, frame * 16, row * 16, shirt, skin, hair, frame)
            outline(cv, frame * 16, row * 16, 16, 16)
    return cv.img


def build_pagode_table():
    """Mesa vermelha comprida com garrafas de cerveja e copos."""
    cv = Canvas(64, 16)
    cv.shape([(x, y) for y in range(2, 8) for x in range(0, 64)], (191, 4, 4, 255))
    cv.rect(0, 2, 64, 3, (230, 60, 50, 255))
    for lx in (3, 58):
        cv.rect(lx, 8, lx + 3, 16, (90, 60, 40, 255))
    for k, bx in enumerate(range(8, 58, 9)):
        cv.rect(bx, 0, bx + 2, 3, (120, 70, 20, 255))
        cv.rect(bx + 4, 1, bx + 6, 3, GOLD)
    return cv.img


if __name__ == '__main__':
    build_people().save(os.path.join(ROOT, 'npcs', 'fila-tchay.png'))
    build_sign().save(os.path.join(ROOT, 'props', 'tchay-letreiro.png'))
    build_popular_bars().save(os.path.join(ROOT, 'props', 'bares-populares.png'))
    build_pagode().save(os.path.join(ROOT, 'npcs', 'pagode.png'))
    build_pagode_table().save(os.path.join(ROOT, 'props', 'pagode-mesa.png'))
    print('ok')
