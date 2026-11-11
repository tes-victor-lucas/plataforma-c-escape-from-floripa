"""Mercado Público de Florianópolis: fachada, piso e itens da Sala IV.

Pixel art desenhada por código, na paleta da catedral da Praça XV (contorno #1A1A1A,
ocre, molduras brancas). Tudo em múltiplos de 16 px para virar tileset do Tiled.

uso (da raiz do repositório): python3 assets/mercado-publico/gen_mercado_assets.py
"""
import math
import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'tilesets')

T = (0, 0, 0, 0)
OL = (26, 26, 26, 255)
# paredes ocres (mesmos tons da catedral)
O0 = (110, 80, 36, 255)
O1 = (198, 142, 66, 255)
O2 = (230, 178, 94, 255)
O3 = (250, 196, 110, 255)
O4 = (246, 206, 132, 255)
# molduras
W0 = (150, 156, 160, 255)
W1 = (184, 190, 192, 255)
W2 = (228, 232, 228, 255)
W3 = (252, 252, 246, 255)
# pedra e calçamento
S0 = (52, 52, 56, 255)
S1 = (92, 92, 94, 255)
S2 = (124, 122, 118, 255)
S3 = (156, 152, 146, 255)
S4 = (186, 182, 174, 255)
# telha de barro
R0 = (70, 22, 18, 255)
R1 = (122, 44, 30, 255)
R2 = (164, 72, 44, 255)
R3 = (204, 112, 70, 255)
# vidro e interior
G0 = (18, 20, 28, 255)
G1 = (30, 46, 96, 255)
G2 = (64, 96, 160, 255)
G3 = (120, 150, 200, 255)
L0 = (66, 40, 28, 255)
L1 = (150, 90, 40, 255)
L2 = (232, 160, 70, 255)
L3 = (255, 214, 130, 255)
# portas verdes
D0 = (10, 40, 30, 255)
D1 = (14, 70, 62, 255)
D2 = (22, 108, 78, 255)
D3 = (52, 150, 92, 255)
# neon
NP = (240, 86, 197, 255)
NC = (92, 229, 241, 255)
# madeira e lona
K0 = (52, 34, 26, 255)
K1 = (104, 70, 48, 255)
K2 = (146, 108, 74, 255)
K3 = (186, 146, 100, 255)
RED = (196, 40, 46, 255)
RED0 = (130, 24, 32, 255)
TEAL = (20, 130, 140, 255)
TEAL0 = (12, 84, 94, 255)
ICE0 = (150, 196, 214, 255)
ICE1 = (214, 238, 244, 255)
FISH0 = (70, 90, 110, 255)
FISH1 = (140, 164, 180, 255)
FISH2 = (210, 222, 228, 255)

rng = random.Random(1899)


class Canvas:
    def __init__(self, w, h):
        self.img = Image.new('RGBA', (w, h), T)
        self.px = self.img.load()
        self.w, self.h = w, h

    def put(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = c

    def get(self, x, y):
        return self.px[x, y] if 0 <= x < self.w and 0 <= y < self.h else T

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1):
            for x in range(x0, x1):
                self.put(x, y, c)

    def shape(self, pts, fill, outline=OL):
        """Preenche um conjunto de pixels e contorna a borda externa com 1 px."""
        pts = set(pts)
        for x, y in pts:
            self.put(x, y, fill(x, y) if callable(fill) else fill)
        if outline:
            for x, y in pts:
                if any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    self.put(x, y, outline)
        return pts


def box(x0, y0, x1, y1):
    return [(x, y) for y in range(y0, y1) for x in range(x0, x1)]


def arch(x0, y0, w, h):
    """Abertura em arco pleno: retângulo com meia-circunferência no topo."""
    r = w / 2
    pts = []
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            dy = y - y0
            if dy < r:
                cx = x0 + r - 0.5
                if (x - cx) ** 2 + (r - dy - 0.5) ** 2 > r * r:
                    continue
            pts.append((x, y))
    return pts


def ellipse(cx, cy, rx, ry):
    return [(x, y) for y in range(int(cy - ry), int(cy + ry) + 1) for x in range(int(cx - rx), int(cx + rx) + 1)
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1]


# Fonte 3x5 (M e N com 5 colunas) para o letreiro.
FONT = {
    'M': ['10001', '11011', '10101', '10001', '10001'],
    'E': ['111', '100', '110', '100', '111'],
    'R': ['110', '101', '110', '101', '101'],
    'C': ['011', '100', '100', '100', '011'],
    'A': ['010', '101', '111', '101', '101'],
    'D': ['110', '101', '101', '101', '110'],
    'O': ['010', '101', '101', '101', '010'],
    'P': ['110', '101', '110', '100', '100'],
    'U': ['101', '101', '101', '101', '111'],
    'B': ['110', '101', '110', '101', '110'],
    'L': ['100', '100', '100', '100', '111'],
    'I': ['111', '010', '010', '010', '111'],
    'X': ['101', '101', '010', '101', '101'],
    'F': ['111', '100', '110', '100', '100'],
    'S': ['011', '100', '010', '001', '110'],
    '1': ['010', '110', '010', '010', '111'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    ' ': ['0', '0', '0', '0', '0'],
}


def text_width(text):
    return sum(len(FONT[ch][0]) + 1 for ch in text) - 1


def draw_text(cv, x, y, text, color):
    for ch in text:
        glyph = FONT[ch]
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == '1':
                    cv.put(x + gx, y + gy, color)
        x += len(glyph[0]) + 1


# ---------------------------------------------------------------- fachada

FW, FH = 704, 224          # 44 x 14 tiles
CORNER_W = 64              # torres de canto: 4 tiles
CENTER_X0, CENTER_X1 = 288, 416  # torre central: 8 tiles
ROOF_Y, CORNICE_Y, UPPER_Y, BAND_Y, LOWER_Y, PLINTH_Y = 52, 68, 76, 132, 138, 212


def wall_fill(x, y):
    # Ocre com manchas de umidade mais escuras perto do chão.
    n = rng.random()
    if y > PLINTH_Y - 18 and n < (y - (PLINTH_Y - 18)) / 60:
        return O1
    if n < 0.025:
        return O3
    return O2


def draw_roof(cv, x0, x1, y0, y1):
    """Telhado de barro visto de frente: fileiras de telhas capa-e-canal."""
    for y in range(y0, y1):
        row = (y - y0) // 4
        for x in range(x0, x1):
            k = (x + (row % 2) * 3) % 6
            c = R2 if k < 3 else R1
            if (y - y0) % 4 == 3:
                c = R0
            elif k == 0:
                c = R3
            cv.put(x, y, c)
    cv.rect(x0, y0, x1, y0 + 1, OL)


def draw_cornice(cv, x0, x1, y0, h=8):
    cv.rect(x0, y0, x1, y0 + h, W2)
    cv.rect(x0, y0, x1, y0 + 1, OL)
    cv.rect(x0, y0 + 1, x1, y0 + 2, W3)
    # dentículos
    for x in range(x0 + 1, x1 - 1, 4):
        cv.rect(x, y0 + 4, x + 2, y0 + h - 2, W1)
    cv.rect(x0, y0 + h - 1, x1, y0 + h, W0)
    cv.rect(x0, y0 + h, x1, y0 + h + 1, O1)  # sombra na parede


def draw_window(cv, x, y, w=14, h=30):
    """Janela em arco com moldura branca e vidro escuro refletindo o neon."""
    cv.shape(arch(x - 2, y - 2, w + 4, h + 3), W2)
    cv.shape(arch(x, y, w, h), lambda px, py: G1 if (px - x) + (py - y) // 3 < 5 else G0)
    # caixilho em cruz
    for py in range(y + w // 2, y + h - 1):
        cv.put(x + w // 2, py, W1)
    cv.rect(x + 1, y + w // 2 + 6, x + w - 1, y + w // 2 + 7, W1)
    cv.put(x + 3, y + w // 2 - 2, G3)
    cv.put(x + 3, y + w // 2 - 1, G2)
    # peitoril
    cv.shape(box(x - 3, y + h, x + w + 3, y + h + 3), W3)


def draw_door(cv, x, y, w, h, kind):
    """Porta em arco: 'aberta' mostra o interior iluminado, 'fechada' tem folhas verdes."""
    cv.shape(arch(x - 3, y - 3, w + 6, h + 3), W2)
    # pedra-chave
    cv.shape(box(x + w // 2 - 2, y - 4, x + w // 2 + 2, y + 1), W3)
    if kind == 'aberta':
        def inside(px, py):
            depth = (py - y) / h
            if py > y + h - 5:
                return L1 if (px + py) % 3 else L0
            return L3 if depth < 0.35 else L2 if depth < 0.7 else L1
        cv.shape(arch(x, y, w, h), inside)
        # mercadorias penduradas e balcão contra a luz
        for k in range(x + 3, x + w - 3, 4):
            for py in range(y + w // 2 + 2, y + w // 2 + 4 + (k * 7) % 5):
                cv.put(k, py, L0)
        cv.rect(x + 2, y + h - 12, x + w - 2, y + h - 9, L0)
        cv.rect(x + 2, y + h - 9, x + w - 2, y + h - 1, L1)
        cv.rect(x + 1, y + h - 1, x + w - 1, y + h, OL)
    else:
        def leaf(px, py):
            if (px - x) in (w // 2 - 1, w // 2):
                return D0
            return D3 if (px - x) % 4 == 1 else D2 if (px - x) % 4 == 2 else D1
        cv.shape(arch(x, y, w, h), leaf)
        # bandeira (vidro em leque) acima das folhas
        fan = [(px, py) for px, py in arch(x + 1, y + 1, w - 2, w // 2 + 1) if py < y + w // 2]
        cv.shape(fan, G0, outline=None)
        cx = x + w / 2 - 0.5
        for a in range(5):
            ang = math.pi * (a + 1) / 6
            for r in range(1, w // 2):
                cv.put(round(cx - math.cos(ang) * r), round(y + w // 2 - math.sin(ang) * r), W2)
        cv.rect(x, y + w // 2, x + w, y + w // 2 + 1, W2)
        # maçanetas
        cv.put(x + w // 2 - 2, y + h - 14, L3)
        cv.put(x + w // 2 + 1, y + h - 14, L3)


def draw_pilaster(cv, x, y0, y1, w=4):
    cv.shape(box(x, y0, x + w, y1), lambda px, py: W3 if px == x + 1 else W2)


def draw_plinth(cv, x0, x1):
    for y in range(PLINTH_Y, FH):
        for x in range(x0, x1):
            c = S2 if ((x // 8) + (y // 4)) % 2 else S3
            if (y - PLINTH_Y) % 4 == 0 or x % 8 == 0:
                c = S1
            cv.put(x, y, c)
    cv.rect(x0, PLINTH_Y, x1, PLINTH_Y + 1, OL)
    cv.rect(x0, FH - 1, x1, FH, OL)


def draw_wing(cv, x0, x1, doors):
    draw_roof(cv, x0, x1, ROOF_Y, CORNICE_Y)
    cv.shape(box(x0, CORNICE_Y, x1, PLINTH_Y), wall_fill, outline=None)
    draw_cornice(cv, x0, x1, CORNICE_Y)
    # faixa entre os andares
    cv.rect(x0, BAND_Y, x1, BAND_Y + 6, W2)
    cv.rect(x0, BAND_Y, x1, BAND_Y + 1, OL)
    cv.rect(x0, BAND_Y + 5, x1, BAND_Y + 6, W0)
    cv.rect(x0, BAND_Y + 6, x1, BAND_Y + 7, O1)
    bays = (x1 - x0) // 32
    for b in range(bays):
        bx = x0 + b * 32
        draw_pilaster(cv, bx, UPPER_Y + 2, BAND_Y)
        draw_pilaster(cv, bx, LOWER_Y + 1, PLINTH_Y)
        draw_window(cv, bx + 11, UPPER_Y + 14)
        draw_door(cv, bx + 9, LOWER_Y + 18, 18, PLINTH_Y - (LOWER_Y + 18), doors[b % len(doors)])
    draw_pilaster(cv, x1 - 4, UPPER_Y + 2, BAND_Y)
    draw_pilaster(cv, x1 - 4, LOWER_Y + 1, PLINTH_Y)
    draw_plinth(cv, x0, x1)


def draw_corner_tower(cv, x0):
    x1 = x0 + CORNER_W
    top = 28
    # telhado em pirâmide
    roof = [(x, y) for y in range(top - 20, top + 6) for x in range(x0 - 2, x1 + 2)
            if abs(x - (x0 + x1) / 2 + 0.5) <= (y - (top - 20)) * 1.4 + 2]
    cv.shape(roof, lambda x, y: R3 if x < (x0 + x1) / 2 - 6 else R2 if x < (x0 + x1) / 2 + 8 else R1)
    cv.shape(box((x0 + x1) // 2 - 1, top - 26, (x0 + x1) // 2 + 1, top - 19), W1)
    cv.shape(box(x0, top + 6, x1, PLINTH_Y), wall_fill, outline=OL)
    draw_cornice(cv, x0 - 2, x1 + 2, top + 6, 9)
    # cunhais brancos nas quinas
    for y in range(top + 16, PLINTH_Y, 8):
        for qx, qw in ((x0, 7), (x1 - 7, 7)):
            cv.shape(box(qx, y, qx + qw, y + 7), W2)
    # óculo, janela alta e porta
    cx = (x0 + x1) // 2
    cv.shape(ellipse(cx - 0.5, top + 30, 8, 8), W2)
    cv.shape(ellipse(cx - 0.5, top + 30, 5, 5), G0)
    cv.put(cx - 3, top + 28, G2)
    cv.rect(x0, BAND_Y, x1, BAND_Y + 6, W2)
    cv.rect(x0, BAND_Y, x1, BAND_Y + 1, OL)
    cv.rect(x0, BAND_Y + 5, x1, BAND_Y + 6, W0)
    draw_window(cv, cx - 8, UPPER_Y + 10, 16, 34)
    draw_door(cv, cx - 11, LOWER_Y + 16, 22, PLINTH_Y - (LOWER_Y + 16), 'fechada')
    draw_plinth(cv, x0, x1)


def draw_center_tower(cv):
    x0, x1 = CENTER_X0, CENTER_X1
    cx = (x0 + x1) // 2
    top = 22
    # frontão triangular
    ped = [(x, y) for y in range(top, top + 26) for x in range(x0 - 4, x1 + 4)
           if abs(x - cx + 0.5) <= (y - top) * 2.6 + 4]
    cv.shape(ped, W2)
    inner = [(x, y) for y in range(top + 6, top + 24) for x in range(x0 + 6, x1 - 6)
             if abs(x - cx + 0.5) <= (y - top - 6) * 2.6]
    cv.shape(inner, O2, outline=None)
    draw_text(cv, cx - text_width('1899') // 2, top + 15, '1899', O0)
    cv.shape(box(cx - 1, top - 10, cx + 1, top + 1), W1)
    cv.shape(ellipse(cx - 0.5, top - 11, 2.5, 2.5), L3)
    cv.shape(box(x0, top + 26, x1, PLINTH_Y), wall_fill)
    draw_cornice(cv, x0 - 4, x1 + 4, top + 26, 9)
    # pilastras dobradas nas laterais
    for px in (x0 + 2, x0 + 8, x1 - 12, x1 - 6):
        draw_pilaster(cv, px, top + 36, PLINTH_Y)
    # letreiro
    label = 'MERCADO PUBLICO'
    lw = text_width(label)
    cv.shape(box(cx - lw // 2 - 4, UPPER_Y + 4, cx + lw // 2 + 5, UPPER_Y + 15), W3)
    draw_text(cv, cx - lw // 2, UPPER_Y + 7, label, OL)
    cv.put(cx - lw // 2 + text_width('MERCADO P') + 2, UPPER_Y + 5, OL)  # acento do Ú
    # janelas trigêmeas
    for wx in (cx - 30, cx - 7, cx + 16):
        draw_window(cv, wx, UPPER_Y + 26, 14, 26)
    cv.rect(x0, BAND_Y, x1, BAND_Y + 6, W2)
    cv.rect(x0, BAND_Y, x1, BAND_Y + 1, OL)
    cv.rect(x0, BAND_Y + 5, x1, BAND_Y + 6, W0)
    # portal principal aberto com grade de ferro recolhida nas laterais
    pw, ph = 52, PLINTH_Y - (LOWER_Y + 10)
    draw_door(cv, cx - pw // 2, LOWER_Y + 10, pw, ph, 'aberta')
    for gx in (cx - pw // 2 + 1, cx - pw // 2 + 4, cx + pw // 2 - 5, cx + pw // 2 - 2):
        for gy in range(LOWER_Y + 10 + pw // 2, PLINTH_Y - 1):
            cv.put(gx, gy, S0)
    # neon de peixe sobre o portal
    fish = [(x, y) for x, y in ellipse(cx - 3, BAND_Y + 14, 7, 3)] + \
           [(x, y) for y in range(BAND_Y + 11, BAND_Y + 18) for x in range(cx + 4, cx + 8) if abs(y - BAND_Y - 14) <= x - cx - 3]
    cv.shape(fish, T, outline=NC)
    cv.put(cx - 7, BAND_Y + 13, NP)
    draw_plinth(cv, x0, x1)


def build_facade():
    cv = Canvas(FW, FH)
    draw_wing(cv, CORNER_W, CENTER_X0, ['aberta', 'fechada', 'fechada', 'aberta', 'fechada', 'aberta', 'fechada'])
    draw_wing(cv, CENTER_X1, FW - CORNER_W, ['fechada', 'aberta', 'fechada', 'fechada', 'aberta', 'fechada', 'aberta'])
    draw_corner_tower(cv, 0)
    draw_corner_tower(cv, FW - CORNER_W)
    draw_center_tower(cv)
    # letreiros de neon nas alas: o mercado à noite no Floripa cyberpunk
    for nx, word, color in ((CORNER_W + 34, 'PEIXE', NP), (FW - CORNER_W - 66, 'BAR', NC)):
        w = text_width(word)
        cv.shape(box(nx - 3, BAND_Y + 9, nx + w + 3, BAND_Y + 18), (24, 18, 30, 255))
        draw_text(cv, nx, BAND_Y + 11, word, color)
    return cv.img


# ---------------------------------------------------------------- piso
# 8 x 3 tiles: paralelepípedo (4), laje da calçada (2), céu (2) / meio-fio (2), céu estrelado (2)

def cobble(cv, ox, oy, seed):
    r = random.Random(seed)
    # Pedras grandes e de pouco contraste: o chão não pode disputar atenção com os drones.
    cv.rect(ox, oy, ox + 16, oy + 16, S1)
    for row in range(3):
        shift = 4 if row % 2 else 0
        for col in range(-1, 3):
            x0 = ox + col * 8 + shift
            y0 = oy + row * 5 + (1 if row == 2 else 0)
            tone = r.choice((S2, S2, (132, 128, 122, 255)))
            for y in range(y0, y0 + 4):
                for x in range(x0, x0 + 7):
                    if ox <= x < ox + 16 and y < oy + 16:
                        cv.put(x, y, S3 if y == y0 and x > x0 else tone)
    # musgo e poças ocasionais
    for _ in range(2):
        cv.put(ox + r.randint(0, 15), oy + r.randint(0, 15), (60, 80, 58, 255))


def slab(cv, ox, oy, seed):
    r = random.Random(seed)
    for y in range(16):
        for x in range(16):
            c = S4 if r.random() > 0.08 else S3
            if x == 0 or y == 0:
                c = S3
            if x == 15 or y == 15:
                c = S2
            cv.put(ox + x, oy + y, c)


def curb(cv, ox, oy, top):
    """Meio-fio: calçada em cima e sarjeta em baixo (top) ou o inverso."""
    for y in range(16):
        for x in range(16):
            if top:
                c = S4 if y < 9 else W1 if y < 12 else S1 if y < 14 else S0
            else:
                c = S0 if y < 2 else S1 if y < 4 else W1 if y < 7 else S2
            if x % 8 == 7 and ((top and 9 <= y < 12) or (not top and 4 <= y < 7)):
                c = S2
            cv.put(ox + x, oy + y, c)


def sky(cv, ox, oy, seed):
    r = random.Random(seed)
    for y in range(16):
        for x in range(16):
            cv.put(ox + x, oy + y, (8, 10, 22, 255))
    for _ in range(2):
        cv.put(ox + r.randint(1, 14), oy + r.randint(1, 14), r.choice(((90, 110, 150, 255), (200, 210, 240, 255))))


def build_floor():
    cv = Canvas(128, 48)
    for i in range(4):
        cobble(cv, i * 16, 0, 10 + i)
    slab(cv, 64, 0, 1)
    slab(cv, 80, 0, 2)
    sky(cv, 96, 0, 3)
    sky(cv, 112, 0, 4)
    curb(cv, 0, 16, True)
    curb(cv, 16, 16, False)
    # bueiro na calçada
    slab(cv, 32, 16, 5)
    cv.shape(box(36, 20, 44, 28), S1)
    for x in range(37, 43, 2):
        cv.rect(x, 21, x + 1, 27, S0)
    # faixa de pedestre sobre o asfalto da Sala III
    for i, x0 in enumerate((48, 64)):
        cv.rect(x0, 16, x0 + 16, 32, (36, 40, 50, 255))
        cv.rect(x0 + 2, 18, x0 + 14, 30, W2)
        cv.rect(x0 + 2, 29, x0 + 14, 30, W1)
    # sombra do prédio sobre a calçada
    slab(cv, 80, 16, 6)
    for y in range(16, 22):
        for x in range(80, 96):
            p = cv.get(x, y)
            cv.put(x, y, tuple(int(v * 0.72) for v in p[:3]) + (255,))
    for i in range(2):
        cobble(cv, 96 + i * 16, 16, 30 + i)
    return cv.img


# ---------------------------------------------------------------- itens
# 10 x 6 tiles

def awning(cv, x0, y0, w, c_a, c_b):
    pts = [(x, y) for y in range(y0, y0 + 14) for x in range(x0, x0 + w)
           if y < y0 + 11 or (x - x0) % 6 not in (0, 5)]
    cv.shape(pts, lambda x, y: (c_a if ((x - x0) // 6) % 2 == 0 else c_b) if y > y0 + 1 else W3)
    cv.rect(x0 + 1, y0 + 2, x0 + w - 1, y0 + 3, W2)


def stall(cv, ox, oy, goods):
    """Banca 3x3: toldo listrado, postes e balcão com mercadoria."""
    awning(cv, ox + 1, oy + 1, 46, RED if goods == 'peixe' else D2, W3)
    for px in (ox + 3, ox + 42):
        cv.shape(box(px, oy + 14, px + 3, oy + 34), K1)
    cv.shape(box(ox + 1, oy + 31, ox + 47, oy + 46), lambda x, y: K2 if (y - oy) % 4 else K1)
    cv.rect(ox + 2, oy + 45, ox + 46, oy + 47, (0, 0, 0, 90))
    if goods == 'peixe':
        cv.shape(box(ox + 2, oy + 27, ox + 46, oy + 33), lambda x, y: ICE1 if (x + y) % 5 else ICE0)
        for i, fx in enumerate((ox + 5, ox + 18, ox + 31)):
            fish(cv, fx, oy + 21 + (i % 2) * 4, flip=i % 2 == 1)
    else:
        colors = [(214, 60, 50, 255), (240, 170, 40, 255), (120, 180, 60, 255), (250, 220, 80, 255)]
        for i, fx in enumerate(range(ox + 4, ox + 44, 5)):
            for j in range(2):
                cv.shape(ellipse(fx + 2, oy + 28 + j * 3, 2.4, 1.8), colors[(i + j) % 4])
        # balança de feira no canto do balcão
        cv.shape(box(ox + 33, oy + 22, ox + 41, oy + 27), W2)
        cv.shape(box(ox + 35, oy + 23, ox + 39, oy + 25), G0, outline=None)
        cv.put(ox + 36, oy + 24, (120, 255, 140, 255))


def fish(cv, x, y, flip=False):
    """Peixe de 11x7 deitado no gelo: dorso azulado, barriga prateada, rabo em V."""
    pts = ellipse(x + 4, y + 3, 4.8, 2.7) + [(x + 9 + d, y + 3 + s) for d in (0, 1, 2) for s in range(-d, d + 1)]
    if flip:
        pts = [(2 * x + 11 - px, py) for px, py in pts]
    cv.shape(pts, lambda px, py: FISH0 if py <= y + 2 else FISH1 if py == y + 3 else FISH2)
    cv.put(x + 10 if flip else x + 1, y + 2, W3)


def table_umbrella(cv, ox, oy, c_a, c_b):
    """Mesa de bar 3x3: guarda-sol em cima, mesa e cadeiras embaixo."""
    cx = ox + 24
    cv.shape(ellipse(cx, oy + 42, 16, 4), (0, 0, 0, 70), outline=None)
    canopy = [(x, y) for x, y in ellipse(cx - 0.5, oy + 16, 22, 14) if y <= oy + 16]
    canopy += [(x, oy + 17) for x in range(cx - 21, cx + 21) if (x - cx) % 7 not in (3,)]
    cv.shape(canopy, lambda x, y: c_a if int(math.atan2(y - oy - 17, x - cx + 0.5) * 4) % 2 else c_b)
    cv.shape(box(cx - 1, oy + 1, cx + 1, oy + 4), W1)
    cv.shape(box(cx - 1, oy + 18, cx + 1, oy + 34), S1)
    cv.shape(ellipse(cx - 0.5, oy + 33, 10, 3), W3)
    for lx in (cx - 7, cx + 6):
        cv.shape(box(lx, oy + 35, lx + 2, oy + 42), S2)
    for sx in (ox + 1, ox + 39):
        cv.shape(box(sx, oy + 30, sx + 8, oy + 34), RED)
        cv.shape(box(sx + (0 if sx < cx else 6), oy + 24, sx + (2 if sx < cx else 8), oy + 34), RED0)
        for lx in (sx + 1, sx + 6):
            cv.rect(lx, oy + 34, lx + 1, oy + 41, RED0)
    # copo de chope e porção
    cv.shape(box(cx - 6, oy + 28, cx - 3, oy + 32), L3)
    cv.shape(ellipse(cx + 4, oy + 31, 3, 1.4), L2)


def crate(cv, ox, oy, goods):
    cv.shape(box(ox + 1, oy + 5, ox + 15, oy + 15), lambda x, y: K2 if (y - oy) % 4 else K1)
    for sx in (ox + 1, ox + 14):
        cv.rect(sx, oy + 5, sx + 1, oy + 15, OL)
    if goods == 'peixe':
        cv.shape(box(ox + 2, oy + 3, ox + 14, oy + 6), ICE1)
        cv.shape(ellipse(ox + 7, oy + 4, 4, 1.5), FISH1)
    else:
        for i, x in enumerate(range(ox + 3, ox + 13, 3)):
            cv.shape(ellipse(x + 1, oy + 4, 1.8, 1.8), ((214, 60, 50, 255), (240, 170, 40, 255))[i % 2])


def crate_stack(cv, ox, oy):
    crate(cv, ox, oy + 16, 'vazio')
    crate(cv, ox, oy + 6, 'vazio')
    cv.shape(box(ox + 2, oy + 2, ox + 14, oy + 9), lambda x, y: K2 if (y - oy) % 3 else K1)


def barrel(cv, ox, oy):
    body = [(x, y) for y in range(oy + 2, oy + 16) for x in range(ox + 2, ox + 14)
            if abs(x - ox - 7.5) <= 5.5 + (1 if 5 < y - oy < 13 else 0)]
    cv.shape(body, lambda x, y: (TEAL if x < ox + 9 else TEAL0) if (y - oy) not in (5, 12) else S1)
    cv.shape(ellipse(ox + 7.5, oy + 3, 5, 1.5), S2)


def build_items():
    cv = Canvas(160, 96)
    stall(cv, 0, 0, 'peixe')
    table_umbrella(cv, 48, 0, TEAL, W3)
    crate(cv, 96, 0, 'peixe')
    crate(cv, 96, 16, 'fruta')
    crate_stack(cv, 112, 0)
    barrel(cv, 128, 0)
    stall(cv, 0, 48, 'fruta')
    table_umbrella(cv, 48, 48, RED, W3)
    return cv.img


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, img in (('mercado_fachada', build_facade()), ('mercado_piso', build_floor()), ('mercado_itens', build_items())):
        assert img.width % 16 == 0 and img.height % 16 == 0, name
        img.save(os.path.join(OUT, name + '.png'))
        print(name, img.size)


if __name__ == '__main__':
    main()
