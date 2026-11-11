"""Carteira, cartão Grande Floripa e a catraca do TICEN.

carteira.png        208x112: carteira aberta (pixel art), com o cartão no bolso da direita
cartao-grande.png   128x80: o cartão em zoom, mostrado ao lado do saldo
catraca-ticen.png   quadros de 32x32: fechada, cartão lido, girando, liberada

uso: python3 assets/ticen/gen_carteira.py
"""
import os

from gen_ticen_assets import BLUE0, BLUE1, BLUE2, YELLOW, centered, draw_text, text_width  # noqa: F401
from room_palette import to_room_palette
from gen_mercado_assets import OL, S0, S1, S2, S3, T, W1, W2, W3, Canvas, box, ellipse

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets')

LEATHER0 = (70, 34, 22, 255)
LEATHER1 = (110, 58, 36, 255)
LEATHER2 = (140, 78, 48, 255)
LEATHER3 = (170, 104, 66, 255)
STITCH = (214, 170, 110, 255)
MONEY0 = (30, 110, 60, 255)
MONEY1 = (60, 160, 90, 255)
TEAL = (20, 150, 160, 255)
GOLD0 = (170, 130, 40, 255)
GOLD1 = (230, 196, 90, 255)
SKIN = (236, 196, 170, 255)
HAIR = (40, 30, 26, 255)
RED = (220, 50, 50, 255)
GREEN = (90, 255, 140, 255)


def stitches(cv, x0, y0, x1, y1):
    for x in range(x0, x1, 4):
        cv.rect(x, y0, x + 2, y0 + 1, STITCH)
        cv.rect(x, y1 - 1, x + 2, y1, STITCH)
    for y in range(y0, y1, 4):
        cv.rect(x0, y, x0 + 1, y + 2, STITCH)
        cv.rect(x1 - 1, y, x1, y + 2, STITCH)


def card_face(cv, ox, oy, w, h):
    """Cartão de transporte: degradê azul-turquesa, ponte, chip e o nome do cartão."""
    def fill(x, y):
        t = (x - ox) / w
        base = tuple(int(BLUE0[i] * (1 - t) + TEAL[i] * t) for i in range(3)) + (255,)
        if (x - ox + (y - oy)) % 14 < 2:
            return tuple(min(255, c + 18) for c in base[:3]) + (255,)
        return base
    pts = [(x, y) for y in range(oy, oy + h) for x in range(ox, ox + w)
           if not ((x - ox < 2 or x - ox > w - 3) and (y - oy < 2 or y - oy > h - 3))]
    cv.shape(pts, fill)
    return pts


def big_card():
    w, h = 128, 80
    cv = Canvas(w, h)
    card_face(cv, 0, 0, w, h)
    draw_text(cv, 8, 7, 'GRANDE FLORIPA', W3, 1)
    # "+ INTEGRADO": a fonte não tem o sinal de mais, então ele é desenhado
    cv.rect(9, 17, 14, 18, YELLOW)
    cv.rect(11, 15, 12, 20, YELLOW)
    draw_text(cv, 17, 15, 'INTEGRADO', YELLOW)
    # ponte pênsil no canto: torres e cabos
    for tx in (86, 110):
        cv.rect(tx, 10, tx + 2, 34, W2)
    for x in range(66, 127):
        if x < 87:
            y = 29 - (x - 66) * 19 / 21          # sobe da cabeceira até a torre
        elif x <= 110:
            y = 10 + 12 * (1 - ((x - 98.5) / 11.5) ** 2)  # curva do cabo entre as torres
        else:
            y = 10 + (x - 110) * 19 / 16          # desce até a outra cabeceira
        cv.rect(x, int(y), x + 1, int(y) + 1, W1)
        if 87 < x < 110 and x % 3 == 0:
            cv.rect(x, int(y) + 1, x + 1, 30, (180, 220, 230, 255))  # pendurais
    cv.rect(66, 30, 127, 32, W2)
    # chip dourado e símbolo de aproximação
    cv.shape(box(10, 32, 26, 44), GOLD1)
    cv.rect(10, 37, 26, 38, GOLD0)
    cv.rect(17, 32, 18, 44, GOLD0)
    for k, r in enumerate((3, 6, 9)):
        for a in range(-40, 41, 8):
            import math
            x = 34 + int(r * math.cos(math.radians(a)))
            y = 38 + int(r * math.sin(math.radians(a)))
            cv.put(x, y, W2 if k < 2 else W1)
    draw_text(cv, 8, 56, '0763 2067 0001', W3)
    draw_text(cv, 8, 66, 'PASSAGEIRO', W2)
    # ônibus pequeno no canto de baixo
    cv.shape(box(98, 58, 120, 70), W3)
    cv.rect(100, 60, 118, 64, BLUE1)
    for wx in (102, 115):
        cv.shape(ellipse(wx, 70, 2, 2), OL)
    return cv.img


def wallet():
    w, h = 208, 112
    cv = Canvas(w, h)
    # nota verde saindo do bolso de cima, como na referência
    cv.shape(box(14, 2, 92, 22), lambda x, y: MONEY1 if (x + y) % 9 else MONEY0)
    cv.shape(ellipse(52, 11, 6, 6), MONEY0)
    # couro da carteira aberta
    cv.shape(box(2, 12, w - 10, h - 2), lambda x, y: LEATHER2 if y > 15 else LEATHER3)
    cv.rect(103, 14, 105, h - 4, LEATHER0)  # dobra no meio
    stitches(cv, 6, 16, 100, h - 6)
    stitches(cv, 108, 16, w - 14, h - 6)
    # lado esquerdo: janela da identidade com o retrato
    cv.shape(box(14, 24, 92, 92), LEATHER1)
    cv.shape(box(18, 28, 88, 88), (196, 222, 236, 255))
    cv.shape(box(24, 36, 48, 66), (170, 196, 214, 255))
    cv.shape(ellipse(36, 48, 7, 8), SKIN)
    cv.rect(29, 40, 44, 44, HAIR)
    cv.shape(box(28, 56, 45, 66), (60, 90, 140, 255))
    for k, y in enumerate((40, 48, 56)):
        cv.rect(54, y, 84 - k * 8, y + 2, (120, 140, 160, 255))
    draw_text(cv, 24, 72, 'PASSAGEIRO', LEATHER0)
    # lado direito: bolsos de cartão, o de cima com o cartão Grande Floripa
    card_face(cv, 116, 22, 64, 40)
    draw_text(cv, 120, 26, 'GRANDE', W3)
    draw_text(cv, 120, 33, 'FLORIPA', W3)
    cv.shape(box(168, 26, 176, 32), GOLD1)
    for k, y in enumerate((44, 62, 80)):
        cv.shape(box(112, y, w - 18, y + 18), LEATHER1 if k == 0 else LEATHER2)
        cv.rect(112, y, w - 18, y + 2, LEATHER3)
        stitches(cv, 114, y + 3, w - 20, y + 17)
    # outro cartão e uma moeda nos bolsos de baixo
    cv.shape(box(120, 58, 160, 64), (200, 70, 60, 255))
    cv.shape(ellipse(176, 74, 5, 5), GOLD1)
    # fecho
    cv.shape(box(w - 18, 46, w - 2, 66), LEATHER1)
    cv.shape(ellipse(w - 9, 56, 3, 3), GOLD1)
    return cv.img


def turnstile_frame(cv, ox, light, arm):
    """Validador azul num poste e a catraca de três braços ao lado."""
    # catraca (corpo de aço)
    cv.shape(box(ox + 14, 12, ox + 28, 32), lambda x, y: S3 if x < ox + 18 else S2)
    cv.rect(ox + 14, 12, ox + 28, 13, W2)
    # braço: 0 fechado (horizontal), 1 girando, 2 liberado (para baixo)
    if arm == 0:
        cv.shape(box(ox + 1, 18, ox + 15, 21), W1)
    elif arm == 1:
        cv.shape([(ox + 14 - k, 19 + k // 2 + d) for k in range(12) for d in (0, 1, 2)], W1)
    else:
        cv.shape(box(ox + 11, 20, ox + 14, 32), W1)
    # validador azul no poste
    cv.shape(box(ox + 18, 22, ox + 20, 32), S1)
    cv.shape(box(ox + 15, 2, ox + 28, 14), BLUE1)
    cv.rect(ox + 15, 2, ox + 28, 3, BLUE2)
    cv.shape(box(ox + 17, 4, ox + 26, 9), (12, 18, 30, 255))
    cv.rect(ox + 18, 5, ox + 25, 8, light)
    cv.rect(ox + 18, 11, ox + 25, 12, OL)  # fenda do cartão


def turnstile():
    cv = Canvas(128, 32)
    for i, (light, arm) in enumerate(((RED, 0), (GREEN, 0), (GREEN, 1), (GREEN, 2))):
        turnstile_frame(cv, i * 32, light, arm)
    return cv.img


if __name__ == '__main__':
    os.makedirs(os.path.join(ROOT, 'ui'), exist_ok=True)
    wallet().save(os.path.join(ROOT, 'ui', 'carteira.png'))
    big_card().save(os.path.join(ROOT, 'ui', 'cartao-grande-floripa.png'))
    # A catraca fica no mapa: entra na paleta das salas; carteira e cartão são interface.
    if '--original' in __import__('sys').argv:
        turnstile().save(os.path.join(ROOT, 'props', 'catraca-ticen_original.png'))
    else:
        to_room_palette(turnstile()).save(os.path.join(ROOT, 'props', 'catraca-ticen.png'))
    print('ok')
