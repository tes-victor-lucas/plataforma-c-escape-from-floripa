"""TICEN (Terminal de Integração do Centro): assets da Sala V, a sala final.

Referências: cobertura metálica escura sobre pilares cilíndricos com base de chapa perfurada,
placas verdes penduradas com número e destino da linha, plataformas A-D, ônibus brancos com
faixa azul do Sistema Integrado e calçada de bloquinhos vermelhos da Av. Paulo Fontes.

uso: python3 assets/ticen/gen_ticen_assets.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'mercado-publico'))
from room_palette import to_room_palette  # noqa: E402
from gen_mercado_assets import (  # noqa: E402
    FONT, G0, G1, G2, L1, L2, L3, NC, NP, OL, S0, S1, S2, S3, S4, T, W0, W1, W2, W3, Canvas, box, ellipse,
)

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'tilesets')

# Letras que faltavam na fonte 3x5 para os letreiros do terminal.
FONT.update({
    'G': ['011', '100', '101', '101', '011'],
    'H': ['101', '101', '111', '101', '101'],
    'K': ['101', '110', '100', '110', '101'],
    'N': ['1001', '1101', '1011', '1001', '1001'],
    'T': ['111', '010', '010', '010', '010'],
    'V': ['101', '101', '101', '101', '010'],
    'Y': ['101', '101', '010', '010', '010'],
    'J': ['001', '001', '001', '101', '010'],
    '0': ['111', '101', '101', '101', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '011', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '001', '010', '010'],
    '.': ['0', '0', '0', '0', '1'],
    '-': ['000', '000', '111', '000', '000'],
    '>': ['100', '010', '001', '010', '100'],
})

CEIL0 = (40, 42, 48, 255)
CEIL1 = (60, 63, 70, 255)
CONC0 = (120, 122, 126, 255)
CONC1 = (150, 152, 156, 255)
CONC2 = (176, 178, 180, 255)
BLUE0 = (20, 60, 120, 255)
BLUE1 = (32, 92, 168, 255)
BLUE2 = (90, 160, 220, 255)
GREEN0 = (12, 70, 46, 255)
GREEN1 = (20, 110, 70, 255)
YELLOW = (240, 200, 40, 255)
ASPH0 = (40, 42, 50, 255)
ASPH1 = (52, 54, 62, 255)
BRICK0 = (120, 50, 40, 255)
BRICK1 = (160, 70, 52, 255)
BRICK2 = (184, 92, 66, 255)
LED = (255, 150, 30, 255)
LED_BG = (16, 12, 10, 255)
RED = (200, 40, 46, 255)
BUS_WHITE = (236, 238, 240, 255)
BUS_SHADE = (196, 200, 206, 255)
# Pinturas de verdade: Estrela (São José) em verde-água e Jotur (Palhoça) branca com saia verde.
TEAL0 = (22, 112, 106, 255)
TEAL1 = (40, 156, 146, 255)
JOTUR_GREEN = (18, 120, 62, 255)


def text_width(text, scale=1):
    return (sum(len(FONT[ch][0]) + 1 for ch in text) - 1) * scale


def draw_text(cv, x, y, text, color, scale=1):
    for ch in text:
        glyph = FONT[ch]
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == '1':
                    cv.rect(x + gx * scale, y + gy * scale, x + (gx + 1) * scale, y + (gy + 1) * scale, color)
        x += (len(glyph[0]) + 1) * scale


def centered(cv, cx, y, text, color, scale=1):
    draw_text(cv, cx - text_width(text, scale) // 2, y, text, color, scale)


# ---------------------------------------------------------------- fachada (48 x 6 tiles)

STORES = [
    ('PASSE RAPIDO', BLUE1, 'loja'),
    ('LOTERICA', GREEN1, 'loja'),
    ('LANCHES', (200, 110, 30, 255), 'loja'),
    ('FARMACIA', RED, 'farmacia'),
    ('PADARIA', (150, 90, 50, 255), 'loja'),
    ('BANHEIROS', (90, 96, 104, 255), 'banheiro'),
    ('BILHETERIA', BLUE1, 'loja'),
    ('CAIXA 24H', (200, 110, 30, 255), 'caixa'),
]


def facade():
    w, h = 768, 96
    cv = Canvas(w, h)
    # forro da cobertura: placas metálicas escuras vistas de baixo
    for y in range(0, 14):
        for x in range(w):
            cv.put(x, y, CEIL1 if (y + x // 48) % 3 else CEIL0)
    cv.rect(0, 14, w, 16, W1)
    cv.rect(0, 16, w, 17, OL)
    # faixa azul do letreiro
    cv.rect(0, 17, w, 31, BLUE1)
    cv.rect(0, 30, w, 31, BLUE0)
    label = 'TICEN - TERMINAL DE INTEGRACAO DO CENTRO'
    centered(cv, w // 2, 19, 'TICEN', W3, 2)
    for side in (-1, 1):
        cx = w // 2 + side * 220
        centered(cv, cx, 21, label.split(' - ')[1], W2)
    # parede de concreto com as lojas da área de serviço
    cv.rect(0, 31, w, 88, CONC1)
    for i, (name, color, kind) in enumerate(STORES):
        x0 = i * 96
        cv.shape(box(x0, 31, x0 + 4, 88), CONC0)
        cv.shape(box(x0 + 12, 36, x0 + 84, 46), color)
        centered(cv, x0 + 48, 39, name, W3)
        # vitrine
        def glass(px, py, kind=kind):
            if kind == 'banheiro':
                return CONC2
            return L2 if py < 62 else L1
        cv.shape(box(x0 + 10, 50, x0 + 86, 86), glass)
        if kind == 'farmacia':
            cv.rect(x0 + 45, 56, x0 + 51, 72, RED)
            cv.rect(x0 + 40, 61, x0 + 56, 67, RED)
        elif kind == 'banheiro':
            for k, sx in enumerate((x0 + 32, x0 + 58)):
                cv.shape(ellipse(sx, 60, 3, 3), BLUE1 if k == 0 else RED)
                cv.shape(box(sx - 4, 65, sx + 5, 80), BLUE1 if k == 0 else RED)
        elif kind == 'caixa':
            for sx in (x0 + 24, x0 + 54):
                cv.shape(box(sx, 56, sx + 18, 84), S1)
                cv.rect(sx + 3, 59, sx + 15, 67, NC)
        else:
            for shelf in (62, 74):
                cv.rect(x0 + 12, shelf, x0 + 84, shelf + 1, L1)
                for k in range(x0 + 14, x0 + 82, 6):
                    cv.rect(k, shelf - 5, k + 4, shelf, (G2, NP, L3, BLUE2)[(k // 6) % 4])
        # caixilhos
        for mx in range(x0 + 10, x0 + 87, 19):
            cv.rect(mx, 50, mx + 1, 86, W1)
    cv.shape(box(0, 88, w, 96), S1)
    cv.rect(0, 88, w, 89, OL)
    return cv.img


# ---------------------------------------------------------------- piso (8 x 4 tiles)

def floor():
    cv = Canvas(128, 64)

    def asphalt(ox, oy, seed):
        for y in range(16):
            for x in range(16):
                cv.put(ox + x, oy + y, ASPH1 if (x * 7 + y * 13 + seed) % 11 else ASPH0)

    def concrete(ox, oy, seed):
        for y in range(16):
            for x in range(16):
                c = CONC2 if (x * 5 + y * 3 + seed) % 13 else CONC1
                if x == 15 or y == 15:
                    c = CONC1
                cv.put(ox + x, oy + y, c)

    def bricks(ox, oy):
        for y in range(16):
            for x in range(16):
                row = y // 4
                c = BRICK1 if ((x + (row % 2) * 4) // 8 + row) % 2 else BRICK2
                if y % 4 == 3 or (x + (row % 2) * 4) % 8 == 7:
                    c = BRICK0
                cv.put(ox + x, oy + y, c)

    asphalt(0, 0, 0)
    asphalt(16, 0, 5)
    concrete(32, 0, 0)
    concrete(48, 0, 7)
    bricks(64, 0)
    # faixa amarela tracejada no meio da pista
    asphalt(80, 0, 2)
    cv.rect(80, 7, 90, 9, YELLOW)
    # borda de baixo da plataforma: piso tátil amarelo e meio-fio
    concrete(0, 16, 3)
    cv.rect(0, 26, 16, 29, YELLOW)
    for x in range(1, 16, 3):
        cv.put(x, 27, (200, 160, 20, 255))
    cv.rect(0, 29, 16, 32, S2)
    cv.rect(0, 31, 16, 32, OL)
    # borda de cima da plataforma
    concrete(16, 16, 4)
    cv.rect(16, 16, 32, 17, OL)
    cv.rect(16, 17, 32, 19, S3)
    cv.rect(16, 19, 32, 22, YELLOW)
    # sombra da plataforma sobre o asfalto
    asphalt(32, 16, 1)
    for y in range(16, 22):
        for x in range(32, 48):
            p = cv.get(x, y)
            cv.put(x, y, tuple(int(v * 0.65) for v in p[:3]) + (255,))
    # bloquinho com faixa de pedestre
    asphalt(48, 16, 3)
    cv.rect(50, 16, 62, 32, W2)
    return cv.img


# ---------------------------------------------------------------- ônibus (7 x 3 tiles cada)

# (letreiro, empresa); o 763.2 via Kobrasol é o ônibus da fuga.
ROUTES = [('151 CENTRO ADM', 'floria'), ('330 LAGOA', 'floria'), ('185 UFSC', 'floria'),
          ('763.2 KOBRASOL', 'estrela'), ('IFSC', 'jotur')]
BODY = {
    'floria': lambda oy, y: BUS_SHADE if y > oy + 34 else BUS_WHITE,
    'estrela': lambda oy, y: TEAL0 if y > oy + 34 else TEAL1,
    'jotur': lambda oy, y: JOTUR_GREEN if y > oy + 29 else BUS_WHITE,
}


def bus(cv, oy, route, livery='floria', goal=False):
    w = 112
    # carroceria com cantos arredondados, frente para a direita
    body = [(x, y) for y in range(oy + 2, oy + 42) for x in range(1, w - 1)
            if not ((x < 3 or x > w - 4) and (y < oy + 4 or y > oy + 39))]
    cv.shape(body, lambda x, y: BODY[livery](oy, y))
    cv.shape(box(40, oy, 64, oy + 3), S2)  # ar-condicionado
    # janelas
    cv.shape(box(6, oy + 10, w - 16, oy + 24), lambda x, y: G1 if (x - y) % 18 < 3 else (30, 40, 56, 255))
    for mx in range(6, w - 16, 14):
        cv.rect(mx, oy + 10, mx + 2, oy + 24, BODY[livery](oy, oy + 10))
    # para-brisa
    cv.shape(box(w - 14, oy + 8, w - 3, oy + 30), lambda x, y: G1 if x - y % 6 > w - 10 else (30, 40, 56, 255))
    # letreiro de LED lateral, perto da porta da frente
    tw = text_width(route)
    cv.shape(box(w - 20 - tw - 6, oy + 3, w - 16, oy + 10), LED_BG)
    draw_text(cv, w - 18 - tw - 4, oy + 4, route, LED)
    if livery == 'floria':
        # faixa azul do Sistema Integrado
        cv.rect(2, oy + 26, w - 2, oy + 31, BLUE1)
        cv.rect(2, oy + 31, w - 2, oy + 32, BLUE2)
        draw_text(cv, 8, oy + 27 - 1 + 1, 'FLORIA', W3)
    elif livery == 'estrela':
        # estrela amarela ao lado do nome, como no logo
        for dx, dy in ((2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 2), (2, 2), (3, 2), (1, 3), (3, 3)):
            cv.put(8 + dx, oy + 27 + dy, YELLOW)
        draw_text(cv, 15, oy + 27, 'ESTRELA', YELLOW)
    else:
        draw_text(cv, 8, oy + 25, 'JOTUR', JOTUR_GREEN)
    # portas
    for dx in (w - 30, 46):
        cv.shape(box(dx, oy + 12, dx + 10, oy + 40), (40, 52, 70, 255))
        cv.rect(dx + 4, oy + 12, dx + 5, oy + 40, W1)
    # rodas
    for wx in (22, 88):
        cv.shape(ellipse(wx, oy + 41, 6, 6), (24, 24, 28, 255))
        cv.shape(ellipse(wx, oy + 41, 2.5, 2.5), S2, outline=None)
    cv.rect(w - 6, oy + 34, w - 2, oy + 37, L3)  # farol
    if goal:
        # o ônibus da fuga tem o letreiro piscando de verde: é o 763.2 via Kobrasol
        cv.rect(w - 20 - tw - 6, oy + 2, w - 16, oy + 3, (90, 255, 140, 255))


def buses():
    cv = Canvas(112, 48 * len(ROUTES))
    for i, (route, livery) in enumerate(ROUTES):
        bus(cv, i * 48, route, livery, goal=route.startswith('763.2'))
    return cv.img


# ---------------------------------------------------------------- itens (10 x 7 tiles)

def pillar(cv, ox, oy):
    """Pilar cilíndrico da cobertura (1x3): câmera no alto e chapa perfurada na base."""
    cv.shape(box(ox + 3, oy, ox + 13, oy + 32), lambda x, y: (84, 88, 96, 255) if x < ox + 6 else (60, 64, 70, 255) if x < ox + 11 else (44, 46, 52, 255))
    cv.shape(box(ox + 1, oy + 30, ox + 15, oy + 48), lambda x, y: (44, 46, 52, 255) if (x + y) % 3 else (90, 94, 100, 255))
    cv.rect(ox + 2, oy + 30, ox + 14, oy + 32, W1)
    cv.shape(box(ox + 10, oy + 4, ox + 15, oy + 8), W2)  # câmera


def line_sign(cv, ox, oy, route, highlight=False, width=48):
    """Placa verde pendurada com número e destino da linha, presa por um cabo."""
    cv.shape(box(ox + 1, oy + 3, ox + width - 1, oy + 15), GREEN0 if not highlight else (20, 80, 40, 255))
    cv.rect(ox + 2, oy + 4, ox + width - 2, oy + 14, GREEN1 if not highlight else (40, 150, 70, 255))
    number, _, destination = route.partition(' ')
    nw = text_width(number)
    cv.rect(ox + 3, oy + 5, ox + 6 + nw, oy + 12, W3)
    draw_text(cv, ox + 5, oy + 6, number, GREEN0)
    draw_text(cv, ox + 8 + nw, oy + 6, destination, W3)
    cv.rect(ox + width // 2 - 1, oy, ox + width // 2, oy + 3, S1)  # cabo
    if highlight:
        cv.rect(ox + 1, oy + 15, ox + width - 1, oy + 16, YELLOW)


def totem(cv, ox, oy, letter, goal=False):
    """Totem azul (2x2) com a letra da plataforma; o da C brilha: é o destino final."""
    cv.shape(box(ox + 2, oy + 1, ox + 30, oy + 26), BLUE0 if not goal else YELLOW)
    cv.rect(ox + 4, oy + 3, ox + 28, oy + 24, BLUE1 if not goal else (255, 220, 80, 255))
    centered(cv, ox + 16, oy + 6, letter, W3 if not goal else OL, 3)
    cv.shape(box(ox + 14, oy + 26, ox + 18, oy + 32), S1)


def bench(cv, ox, oy):
    cv.shape(box(ox + 1, oy + 4, ox + 31, oy + 9), S3)
    cv.shape(box(ox + 1, oy + 9, ox + 31, oy + 12), S2)
    for lx in (ox + 4, ox + 26):
        cv.rect(lx, oy + 12, lx + 2, oy + 16, S0)


def turnstile(cv, ox, oy):
    """Catraca com validador do cartão e luz verde."""
    cv.shape(box(ox + 3, oy + 2, ox + 9, oy + 16), S2)
    cv.rect(ox + 4, oy + 4, ox + 8, oy + 7, (90, 255, 140, 255))
    for i in range(3):
        cv.rect(ox + 9, oy + 8 + i * 2, ox + 15, oy + 9 + i * 2, W1)


def barrier(cv, ox, oy):
    """Grade baixa entre as catracas."""
    cv.rect(ox, oy + 6, ox + 16, oy + 8, W1)
    cv.rect(ox, oy + 11, ox + 16, oy + 12, W0)
    for x in (ox + 1, ox + 14):
        cv.rect(x, oy + 6, x + 1, oy + 16, S1)


def palm(cv, ox, oy):
    """Palmeira da Paulo Fontes (2x3): tronco anelado e folhas caindo em arco."""
    cv.shape(box(ox + 14, oy + 14, ox + 18, oy + 48), lambda x, y: (120, 96, 64, 255) if y % 4 else (90, 70, 46, 255))
    fronds = []
    for direction, lift, length in ((-1, 0.9, 15), (1, 0.9, 15), (-1, 0.35, 14), (1, 0.35, 14), (-1, -0.2, 11), (1, -0.2, 11), (0, 1.6, 6)):
        pts = set()
        for t in range(length):
            x = ox + 16 + (direction * t if direction else 0)
            y = oy + 14 - int(lift * t) + int(0.07 * t * t)
            for k in (0, 1, 2):
                pts.add((x, y + k))
            if t % 2 == 0 and t > 2:
                pts.add((x, y + 3))
        fronds.append((pts, direction))
    for pts, direction in fronds:
        cv.shape(pts, (52, 150, 92, 255) if direction <= 0 else (22, 108, 78, 255))
    cv.shape(ellipse(ox + 16, oy + 14, 2.5, 2), (90, 70, 46, 255))


def items():
    cv = Canvas(160, 112)
    pillar(cv, 0, 0)
    line_sign(cv, 16, 0, '151 CENTRO')
    line_sign(cv, 64, 0, '330 LAGOA')
    line_sign(cv, 16, 16, '185 UFSC')
    line_sign(cv, 64, 16, '763.2 KOBRASOL', highlight=True, width=64)
    for i, letter in enumerate('ABCD'):
        totem(cv, i * 32, 48, letter, goal=letter == 'C')
    bench(cv, 0, 80)
    turnstile(cv, 32, 80)
    barrier(cv, 48, 80)
    palm(cv, 128, 0)
    return cv.img


# ---------------------------------------------------------------- quiosques (8 x 4 tiles)

ICE_BLUE = (40, 120, 200, 255)
CONE = (214, 160, 90, 255)
ORANGE0 = (210, 110, 20, 255)
ORANGE1 = (250, 170, 40, 255)
LEAF = (60, 170, 70, 255)
FRUITS = [(214, 60, 50, 255), (250, 200, 50, 255), (120, 190, 60, 255), (240, 130, 40, 255), (150, 60, 150, 255)]


def kiosk_body(cv, ox, color, trim):
    """Corpo do quiosque com balcão aberto, prateleiras e geladeira de vidro."""
    cv.shape(box(ox + 2, 14, ox + 62, 62), color)
    cv.rect(ox + 2, 14, ox + 62, 16, trim)
    # vão do balcão: prateleiras com produtos e a geladeira
    cv.shape(box(ox + 6, 20, ox + 58, 40), (60, 44, 36, 255))
    for shelf in (27, 34):
        cv.rect(ox + 7, shelf, ox + 38, shelf + 1, (120, 90, 60, 255))
        for k in range(ox + 8, ox + 37, 4):
            cv.rect(k, shelf - 3, k + 2, shelf, FRUITS[(k // 4) % len(FRUITS)])
    cv.shape(box(ox + 40, 21, ox + 56, 39), (150, 200, 220, 255))
    for k in range(ox + 42, ox + 55, 3):
        for y in (25, 31, 36):
            cv.rect(k, y, k + 2, y + 3, FRUITS[(k + y) % len(FRUITS)])
    # tampo do balcão
    cv.rect(ox + 4, 40, ox + 60, 43, W2)
    cv.rect(ox + 4, 43, ox + 60, 44, OL)


def cafe_kiosk(cv, ox):
    """Café colonial do TICEN: quiosque vermelho com milk shake e painel de sorvete."""
    kiosk_body(cv, ox, RED, W3)
    # coroa: faixa vermelha com o nome e o banner branco do milk shake
    cv.shape(box(ox + 1, 0, ox + 63, 14), RED)
    centered(cv, ox + 32, 1, 'CAFE COLONIAL', W3)
    cv.shape(box(ox + 8, 7, ox + 56, 16), W3)
    centered(cv, ox + 32, 9, 'MILK SHAKE', OL)
    # tabela de preços amarela
    cv.shape(box(ox + 5, 16, ox + 27, 22), YELLOW)
    cv.rect(ox + 8, 18, ox + 24, 20, RED)
    # painel de sorvete na frente do balcão
    cv.shape(box(ox + 8, 45, ox + 56, 61), ICE_BLUE)
    for cx, scoop in ((ox + 13, (240, 120, 160, 255)), (ox + 51, (150, 90, 60, 255))):
        cv.shape([(cx + dx, 54 + dy) for dy in range(6) for dx in range(-3 + dy // 2, 4 - dy // 2)], CONE)
        cv.shape(ellipse(cx, 51, 4, 3), scoop)
    centered(cv, ox + 32, 50, 'SORVETE', W3)


def juice_kiosk(cv, ox):
    """Quiosque de sucos: letreiro laranja, frutas no balcão e salada de frutas."""
    kiosk_body(cv, ox, ORANGE0, ORANGE1)
    cv.shape(box(ox + 1, 0, ox + 63, 14), ORANGE1)
    cv.shape(ellipse(ox + 9, 6, 4, 4), LEAF)
    cv.shape(ellipse(ox + 9, 9, 3, 3), (220, 60, 60, 255))
    draw_text(cv, ox + 17, 2, 'SUCOS', OL)
    draw_text(cv, ox + 17, 8, 'VITAMINAS', (120, 40, 10, 255))
    # frutas expostas no balcão
    for k, fx in enumerate(range(ox + 8, ox + 58, 6)):
        cv.shape(ellipse(fx, 38, 2.4, 2.2), FRUITS[k % len(FRUITS)])
    # painel escuro com a salada de frutas
    cv.shape(box(ox + 8, 45, ox + 56, 61), (30, 40, 70, 255))
    cv.shape(ellipse(ox + 18, 54, 7, 4), W2)
    for k in range(6):
        cv.put(ox + 14 + k * 2, 52 + k % 2, FRUITS[k % len(FRUITS)])
    draw_text(cv, ox + 29, 48, 'SALADA', W3)
    draw_text(cv, ox + 29, 54, 'FRUTAS', YELLOW)


def kiosks():
    cv = Canvas(128, 64)
    cafe_kiosk(cv, 0)
    juice_kiosk(cv, 64)
    return cv.img


# ---------------------------------------------------------------- posto de recarga (13 x 4 tiles)

def recharge_station():
    """Posto de recarga do cartão (13x4) e, embaixo, as peças da pracinha de espera:
    pilar e viga da pérgola, banco de cubo de concreto e lixeira azul."""
    w, h = 208, 64
    cv = Canvas(w, h + 48)
    # bloco principal claro
    cv.shape(box(40, 6, w - 2, 60), lambda x, y: W2 if y < 22 else (200, 204, 208, 255))
    cv.rect(40, 22, w - 2, 23, S2)
    # onda verde e azul na faixa branca, à direita
    for x in range(150, 204):
        y = int(12 + 3 * __import__('math').sin((x - 150) / 7))
        cv.rect(x, y, x + 1, y + 2, LEAF)
        cv.rect(x, y + 4, x + 1, y + 5, BLUE1)
    # vidraças laterais escuras
    for x0, x1 in ((44, 70), (150, 204)):
        cv.shape(box(x0, 26, x1, 56), lambda x, y: (40, 52, 70, 255) if (x - y) % 16 > 2 else (70, 90, 110, 255))
    # pórtico cinza com "RECARGA" em letras na vertical
    for px0 in (72, 134):
        cv.shape(box(px0, 0, px0 + 14, 60), (150, 154, 160, 255))
        for i, ch in enumerate('RECARGA'):
            draw_text(cv, px0 + 5, 15 + i * 6, ch, BLUE1)
    cv.shape(box(72, 0, 148, 12), (150, 154, 160, 255))
    # selos coloridos das empresas no lintel (genéricos)
    for k, (cx, color) in enumerate(((92, RED), (104, LEAF), (116, BLUE1), (128, YELLOW))):
        cv.shape(box(cx - 4, 3, cx + 5, 9), color)
    # porta de vidro com os postes de fila amarelos e pretos
    cv.shape(box(88, 16, 132, 58), (60, 76, 96, 255))
    cv.rect(110, 16, 111, 58, W1)
    for k, px in enumerate((94, 102, 118, 126)):
        for y in range(44, 58):
            cv.put(px, y, YELLOW if (y // 2) % 2 else OL)
    cv.rect(94, 46, 127, 47, YELLOW)
    # degrau redondo na entrada
    cv.shape([(x, y) for y in range(58, 64) for x in range(80, 140) if ((x - 110) / 30) ** 2 + ((y - 58) / 6) ** 2 <= 1], (214, 206, 196, 255))
    # torre azul com a ponte e um ônibus desenhados em branco
    cv.shape(box(2, 0, 40, 62), lambda x, y: BLUE1 if x < 30 else BLUE0)
    cv.rect(2, 0, 40, 3, BLUE2)
    for tx in (10, 26):
        cv.rect(tx, 10, tx + 1, 32, W3)
    for x in range(5, 34):
        y = 12 + int(10 * (1 - ((x - 18) / 8) ** 2)) if 10 <= x <= 26 else 12 + abs(x - (10 if x < 10 else 26)) * 2
        cv.put(x, min(31, y), W3)
    cv.rect(4, 32, 36, 33, W3)
    cv.shape(box(8, 40, 32, 52), BLUE1)
    cv.rect(8, 40, 32, 41, W3)
    cv.rect(10, 43, 30, 46, W3)
    for wx in (12, 28):
        cv.shape(ellipse(wx, 52, 2, 2), W3)
    pergola_and_benches(cv, 64)
    return cv.img


def pergola_and_benches(cv, oy):
    concrete = (196, 192, 184, 255)
    concrete_dark = (150, 146, 140, 255)
    # pilar quadrado da pérgola (1x3)
    cv.shape(box(4, oy + 2, 12, oy + 48), lambda x, y: concrete if x < 9 else concrete_dark)
    # viga (1x1, repete na horizontal)
    cv.rect(16, oy + 4, 32, oy + 10, (110, 104, 98, 255))
    cv.rect(16, oy + 4, 32, oy + 5, concrete)
    cv.rect(16, oy + 10, 32, oy + 11, OL)
    # banco: cubo de concreto
    cv.shape(box(34, oy + 4, 46, oy + 15), lambda x, y: (214, 210, 202, 255) if y < oy + 7 else concrete_dark)
    # lixeira azul
    cv.shape(box(52, oy + 3, 60, oy + 15), lambda x, y: BLUE1 if x < 57 else BLUE0)
    cv.rect(51, oy + 3, 61, oy + 5, BLUE2)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, img in (('ticen_fachada', facade()), ('ticen_piso', floor()), ('ticen_onibus', buses()), ('ticen_itens', items()), ('ticen_quiosques', kiosks()), ('ticen_recarga', recharge_station())):
        assert img.width % 16 == 0 and img.height % 16 == 0, name
        # Mesma paleta noturna das Salas I e II; --original guarda as cores de antes (backup em ?room=51).
        if '--original' in sys.argv:
            img.save(os.path.join(OUT, name + '_original.png'))
        else:
            to_room_palette(img).save(os.path.join(OUT, name + '.png'))
        print(name, img.size)
