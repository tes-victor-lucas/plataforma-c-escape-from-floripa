"""Personagens do Mercado Público (Sala IV): skatistas emo, comerciantes e o casal da mesa.

skatistas-emo.png  96x96: uma linha por skatista, quadros 24x32;
                   0-1 de frente (descendo a tela), 2-3 de costas (subindo).
comerciantes.png   160x48: uma linha por comerciante, quadros 16x24 na ordem de MERCHANT_FRAMES:
                   andando de frente, de costas e de lado (virado para a direita),
                   arrumando a banca de costas e arrumando atrás do balcão.
casal.png          48x96: uma linha por pessoa (4), quadros 16x24, virados para a direita;
                   0 sentado, 1-2 correndo.

uso: python3 assets/mercado-publico/gen_npcs.py
"""
import os

from gen_mercado_assets import OL, Canvas, T

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'npcs')
FW, FH = 24, 32

SKIN = (236, 196, 170, 255)
SKIN0 = (196, 150, 128, 255)
HAIR = (20, 18, 26, 255)
HAIR1 = (48, 44, 60, 255)
BLACK = (30, 28, 36, 255)
JEANS = (38, 36, 52, 255)
JEANS1 = (60, 58, 80, 255)
WHITE = (240, 240, 236, 255)
STUD = (200, 204, 210, 255)
DECK = (46, 30, 40, 255)
WHEEL = (230, 220, 160, 255)
EYE = (12, 10, 14, 255)

# mecha do cabelo e listra da camiseta de cada skatista
VARIANTS = [
    ((240, 86, 197, 255), (240, 86, 197, 255)),   # rosa neon
    ((200, 30, 46, 255), (150, 24, 36, 255)),     # vermelho
    ((92, 229, 241, 255), (120, 70, 170, 255)),   # ciano com roxo
]


def outline_outside(cv, x0, y0):
    """Contorno de 1 px por fora da silhueta do quadro."""
    solid = {(x, y) for y in range(y0, y0 + FH) for x in range(x0, x0 + FW) if cv.get(x, y)[3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) not in solid and x0 <= nx < x0 + FW and y0 <= ny < y0 + FH:
                cv.put(nx, ny, OL)


def skater(cv, ox, oy, streak, stripe, back, frame):
    bob = frame  # o segundo quadro abaixa 1 px: a remada
    # skate visto de ponta, com as rodinhas dos lados
    cv.rect(ox + 8, oy + 27, ox + 16, oy + 30, DECK)
    cv.rect(ox + 8, oy + 27, ox + 16, oy + 28, streak)
    for wx in (ox + 7, ox + 16):
        cv.rect(wx, oy + 28, wx + 1, oy + 30, WHEEL)
    # tênis xadrez
    for sx in (ox + 9, ox + 13):
        for i in range(3):
            cv.put(sx + i, oy + 25, WHITE if i % 2 == 0 else BLACK)
            cv.put(sx + i, oy + 26, BLACK if i % 2 == 0 else WHITE)
    # calça skinny
    y_top = oy + 18 + bob
    for lx in (ox + 10, ox + 13):
        cv.rect(lx, y_top, lx + 2, oy + 25, JEANS)
        cv.put(lx, oy + 22, JEANS1)
    # tronco listrado e cinto de tachinhas
    cv.rect(ox + 8, oy + 10 + bob, ox + 16, oy + 18 + bob, BLACK)
    for y in range(oy + 11 + bob, oy + 18 + bob, 2):
        cv.rect(ox + 8, y, ox + 16, y + 1, stripe)
    cv.rect(ox + 8, oy + 18 + bob, ox + 16, oy + 19 + bob, BLACK)
    for x in range(ox + 9, ox + 16, 2):
        cv.put(x, oy + 18 + bob, STUD)
    # braços: um balança para equilibrar
    for ax, lift in ((ox + 6, frame), (ox + 16, 1 - frame)):
        cv.rect(ax, oy + 11 + bob, ax + 2, oy + 13 + bob, BLACK)
        cv.rect(ax, oy + 13 + bob, ax + 2, oy + 17 + bob - lift, SKIN0 if back else SKIN)
        cv.rect(ax, oy + 14 + bob, ax + 2, oy + 15 + bob, streak)  # munhequeira
    # cabeça
    hy = oy + 2 + bob
    cv.rect(ox + 9, hy + 2, ox + 15, hy + 8, SKIN)
    if back:
        cv.rect(ox + 8, hy, ox + 16, hy + 8, HAIR)
        cv.rect(ox + 10, hy + 1, ox + 14, hy + 2, HAIR1)
        cv.rect(ox + 13, hy + 2, ox + 14, hy + 6, streak)
    else:
        # franja de lado cobrindo o olho esquerdo
        cv.rect(ox + 8, hy, ox + 16, hy + 3, HAIR)
        cv.rect(ox + 8, hy + 3, ox + 12, hy + 7, HAIR)
        cv.rect(ox + 8, hy + 7, ox + 10, hy + 9, HAIR)
        cv.rect(ox + 9, hy + 1, ox + 11, hy + 6, streak)
        cv.rect(ox + 15, hy + 1, ox + 16, hy + 5, HAIR)
        cv.put(ox + 13, hy + 4, EYE)
        cv.put(ox + 14, hy + 4, EYE)  # delineador
        cv.put(ox + 13, hy + 6, SKIN0)
    # espetos atrás da cabeça
    for sx, sh in ((ox + 9, 2), (ox + 12, 3), (ox + 15, 2)):
        cv.rect(sx, hy - sh, sx + 1, hy, HAIR)
    outline_outside(cv, ox, oy)


def build_skaters():
    cv = Canvas(FW * 4, FH * len(VARIANTS))
    for row, (streak, stripe) in enumerate(VARIANTS):
        for col in range(4):
            skater(cv, col * FW, row * FH, streak, stripe, back=col >= 2, frame=col % 2)
    return cv.img


def outline_frame(cv, x0, y0, w, h):
    solid = {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w) if cv.get(x, y)[3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) not in solid and x0 <= nx < x0 + w and y0 <= ny < y0 + h:
                cv.put(nx, ny, OL)


FISH = (140, 164, 180, 255)
MERCHANTS = [
    # camisa, chapéu (None = boné branco), bigode
    ((30, 120, 140, 255), (200, 170, 90, 255), True),
    ((170, 40, 46, 255), None, False),
]


PANTS = (52, 50, 60, 255)
BOOT = (24, 22, 28, 255)
# quadros de 16x24 por comerciante (uma linha cada)
MERCHANT_FRAMES = ['frente-0', 'frente-1', 'costas-0', 'costas-1', 'lado-0', 'lado-1',
                   'arruma-costas-0', 'arruma-costas-1', 'arruma-frente-0', 'arruma-frente-1']


def merchant(cv, ox, oy, shirt, hat, mustache, name):
    pose, step = name.rsplit('-', 1)
    step = int(step)
    walking = pose in ('frente', 'costas', 'lado')
    back = pose in ('costas', 'arruma-costas')
    side = pose == 'lado'
    # pernas e botas: passada alternada ao andar
    if side:
        for lx, lift in ((ox + 6, step), (ox + 9, 1 - step)):
            cv.rect(lx, oy + 17, lx + 2, oy + 22 - lift, PANTS)
            cv.rect(lx, oy + 22 - lift, lx + 3, oy + 23 - lift, BOOT)
    else:
        for i, lx in enumerate((ox + 5, ox + 9)):
            lift = (step if i == 0 else 1 - step) if walking else 0
            cv.rect(lx, oy + 17, lx + 2, oy + 22 - lift, PANTS)
            cv.rect(lx, oy + 22 - lift, lx + 2, oy + 23 - lift, BOOT)
    # tronco: camisa e, de frente, o avental branco
    cv.rect(ox + 4, oy + 9, ox + 12, oy + 17, shirt)
    if not back:
        x0 = ox + 6 if not side else ox + 8
        cv.rect(x0, oy + 10, x0 + (4 if not side else 3), oy + 17, WHITE)
    else:
        cv.rect(ox + 7, oy + 9, ox + 9, oy + 13, WHITE)  # laço do avental nas costas
    # cabeça
    cv.rect(ox + 5, oy + 3, ox + 11, oy + 9, SKIN)
    if hat:
        cv.rect(ox + 3, oy + 3, ox + 13, oy + 4, hat)
        cv.rect(ox + 5, oy + 1, ox + 11, oy + 3, hat)
    else:
        cv.rect(ox + 5, oy + 1, ox + 11, oy + 4, WHITE)
        if not back:
            cv.rect(ox + 10 if side else ox + 6, oy + 3, ox + 13 if side else ox + 10, oy + 4, WHITE)
    if back:
        cv.rect(ox + 5, oy + 4, ox + 11, oy + 7, HAIR)
    elif side:
        cv.put(ox + 9, oy + 5, EYE)
        if mustache:
            cv.rect(ox + 9, oy + 7, ox + 11, oy + 8, HAIR)
    else:
        cv.put(ox + 7, oy + 5, EYE)
        cv.put(ox + 9, oy + 5, EYE)
        if mustache:
            cv.rect(ox + 6, oy + 7, ox + 10, oy + 8, HAIR)
    # braços
    if pose == 'arruma-costas':
        # de costas para a tela, mexendo na mercadoria da banca
        cv.rect(ox + 2, oy + 8 - 2 * step, ox + 4, oy + 13 - 2 * step, SKIN)
        cv.rect(ox + 12, oy + 6 + 2 * step, ox + 14, oy + 11 + 2 * step, SKIN)
    elif pose == 'arruma-frente':
        # atrás do balcão: mãos à frente, uma levanta o peixe
        cv.rect(ox + 3, oy + 11, ox + 6, oy + 14, SKIN)
        cv.rect(ox + 10, oy + 11 - 3 * step, ox + 13, oy + 14 - 3 * step, SKIN)
        if step:
            cv.rect(ox + 11, oy + 5, ox + 13, oy + 9, FISH)
    elif side:
        cv.rect(ox + 7 + step, oy + 10, ox + 9 + step, oy + 15, SKIN)
    else:
        swing = step if walking else 0
        cv.rect(ox + 2, oy + 10 + swing, ox + 4, oy + 15 + swing, SKIN)
        cv.rect(ox + 12, oy + 11 - swing, ox + 14, oy + 16 - swing, SKIN)
    outline_frame(cv, ox, oy, 16, 24)


def build_merchants():
    cv = Canvas(16 * len(MERCHANT_FRAMES), 24 * len(MERCHANTS))
    for row, (shirt, hat, mustache) in enumerate(MERCHANTS):
        for col, name in enumerate(MERCHANT_FRAMES):
            merchant(cv, col * 16, row * 24, shirt, hat, mustache, name)
    return cv.img


COUPLE = [
    # cabelo, cabelo comprido, camisa, calça
    ((110, 60, 36, 255), True, (230, 170, 60, 255), (40, 60, 110, 255)),
    (HAIR, False, (60, 140, 90, 255), (70, 64, 60, 255)),
    ((190, 70, 40, 255), True, (120, 70, 170, 255), (30, 30, 36, 255)),
    ((150, 150, 156, 255), False, (200, 60, 70, 255), (90, 80, 64, 255)),
]


def person(cv, ox, oy, hair, long_hair, shirt, pants, frame):
    # virado para a direita: rosto do lado direito da cabeça
    cv.rect(ox + 5, oy + 2, ox + 11, oy + 8, SKIN)
    cv.rect(ox + 4, oy + 1, ox + 11, oy + 3, hair)
    cv.rect(ox + 4, oy + 3, ox + 7, oy + 6, hair)
    if long_hair:
        cv.rect(ox + 4, oy + 6, ox + 7, oy + 11, hair)
    cv.put(ox + 9, oy + 4, EYE)
    cv.rect(ox + 5, oy + 8, ox + 11, oy + 15, shirt)
    if frame == 0:
        # sentado: coxas para a frente, canelas para baixo, braço na mesa
        cv.rect(ox + 5, oy + 14, ox + 13, oy + 17, pants)
        cv.rect(ox + 11, oy + 17, ox + 13, oy + 21, pants)
        cv.rect(ox + 11, oy + 21, ox + 14, oy + 22, BLACK)
        cv.rect(ox + 9, oy + 10, ox + 14, oy + 12, SKIN)
    else:
        # quadro 1 com a passada aberta, quadro 2 com as pernas se cruzando
        stride = 3 if frame == 1 else 1
        cv.rect(ox + 6, oy + 15, ox + 10, oy + 17, pants)
        for lx in (ox + 7 + stride, ox + 7 - stride):
            cv.rect(lx, oy + 17, lx + 2, oy + 22, pants)
            cv.rect(lx, oy + 22, lx + 3, oy + 23, BLACK)
        # braços balançando
        cv.rect(ox + 7 - stride // 2, oy + 9, ox + 9 - stride // 2, oy + 14, SKIN)
        # boca aberta de susto
        cv.put(ox + 10, oy + 6, EYE)
    outline_frame(cv, ox, oy, 16, 24)


def build_couple():
    cv = Canvas(48, 24 * len(COUPLE))
    for row, look in enumerate(COUPLE):
        for frame in range(3):
            person(cv, frame * 16, row * 24, *look, frame)
    return cv.img


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, img in (('skatistas-emo', build_skaters()), ('comerciantes', build_merchants()), ('casal', build_couple())):
        img.save(os.path.join(OUT, name + '.png'))
        print(name, img.size)
