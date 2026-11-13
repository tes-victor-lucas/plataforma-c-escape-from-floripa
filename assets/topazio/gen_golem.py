"""Chefe final: o Golem de Topázio, corrompido pela Floria.

Corpo de topázio imperial em blocos facetados, cristais de topázio azul, implantes da Floria
(viseira vermelha, soquete no peito, braçadeira, trilhas de circuito) e glitch de scanline.
Quanto menos vida, mais rachaduras ciano e mais glitch.

topazio-golem.png   quadros de 96x96, 4 colunas:
    linhas 0-2   estágio 0 (vida cheia): parado, andando, pancada
    linhas 3-5   estágio 1               linhas 6-8   estágio 2
    linhas 9-11  estágio 3 (quase morto)
    linha 12     dano: piscando (1)      linha 13     estilhaçando na morte (4)
    linha 14     giro de frente, braços abertos (coluna = estágio)
    linha 15     giro de costas (coluna = estágio)
    linha do quadro = estágio * 3 + animação

uso: python3 assets/topazio/gen_golem.py
"""
import math
import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'enemies', 'topazio')
F = 96
T = (0, 0, 0, 0)
LIGHT = -3 * math.pi / 4  # luz do alto à esquerda
STAGES = 4

# rampas: contorno, 5 tons do escuro ao claro, reflexo
BODY = ((44, 14, 6), (98, 32, 10), (160, 60, 14), (218, 108, 26), (246, 156, 54), (255, 208, 124), (255, 246, 220))
CRYSTAL = ((8, 14, 34), (10, 34, 82), (16, 72, 150), (28, 118, 196), (64, 168, 232), (140, 214, 248), (226, 248, 255))
METAL = ((6, 10, 18), (16, 24, 38), (28, 40, 58), (44, 60, 82), (70, 90, 112), (110, 132, 150), (170, 190, 200))
GLOW = (110, 226, 255)
CRACK = (200, 250, 255)
LED = (255, 48, 72)
LED_DIM = (150, 20, 44)
MAGENTA = (255, 60, 200)


def rgba(c, a=255):
    return c[:3] + (a,)


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def inside_poly(x, y, poly):
    inside = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def in_tri(p, a, b, c):
    def s(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1, d2, d3 = s(p, a, b), s(p, b, c), s(p, c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def move(poly, dx, dy):
    return [(x + dx, y + dy) for x, y in poly]


def mirror(poly):
    return [(F - x, y) for x, y in poly]


class Canvas:
    def __init__(self):
        self.img = Image.new('RGBA', (F, F), T)
        self.px = self.img.load()
        self.part = {}  # pixel -> id do bloco, para riscar as junções

    def put(self, x, y, color):
        if 0 <= x < F and 0 <= y < F:
            self.px[x, y] = rgba(color)

    def chunk(self, poly, ramp, seed, stripes=True):
        """Bloco facetado: triângulos de um ápice deslocado para a luz até cada aresta."""
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        apex = (cx - w * 0.15, cy - h * 0.2)
        top = [(apex[0] + (x - apex[0]) * 0.42, apex[1] + (y - apex[1]) * 0.42) for x, y in poly]
        rng = random.Random(seed)
        jitter = [rng.uniform(-0.6, 0.6) for _ in poly]
        cells = set()
        for y in range(max(0, int(min(ys))), min(F, int(max(ys)) + 1)):
            for x in range(max(0, int(min(xs))), min(F, int(max(xs)) + 1)):
                p = (x + 0.5, y + 0.5)
                if not inside_poly(*p, poly):
                    continue
                if inside_poly(*p, top):
                    v = 3.2 + jitter[0] * 0.5
                else:
                    v = 2
                    for i in range(len(poly)):
                        a, b = poly[i], poly[(i + 1) % len(poly)]
                        if in_tri(p, apex, a, b):
                            phi = math.atan2((a[1] + b[1]) / 2 - apex[1], (a[0] + b[0]) / 2 - apex[0])
                            v = 2 + 1.6 * math.cos(phi - LIGHT) + jitter[i]
                            break
                if stripes and (x + seed) % 6 == 0 and (y // 3 + x) % 4:
                    v += 0.7  # estrias verticais do topázio bruto
                self.px[x, y] = rgba(ramp[1 + max(0, min(4, round(v)))])
                self.part[(x, y)] = seed
                cells.add((x, y))
        # junção escura onde o bloco encosta em outro
        for x, y in cells:
            for dx, dy in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                if (x + dx, y + dy) not in cells and self.part.get((x + dx, y + dy)) not in (None, seed):
                    self.px[x, y] = rgba(ramp[1])

    def crystal(self, base, angle, length, width, ramp, seed):
        """Prisma de cristal: face clara virada para a luz, face escura do outro lado, ponta facetada."""
        ux, uy = math.cos(angle), math.sin(angle)
        nx, ny = -uy, ux
        hw = width / 2
        bx, by = base
        tip_start = length * 0.7
        poly = [(bx + nx * hw, by + ny * hw),
                (bx + ux * tip_start + nx * hw, by + uy * tip_start + ny * hw),
                (bx + ux * length, by + uy * length),
                (bx + ux * tip_start - nx * hw, by + uy * tip_start - ny * hw),
                (bx - nx * hw, by - ny * hw)]
        lit_side = 1 if math.cos(math.atan2(ny, nx) - LIGHT) > 0 else -1
        xs, ys = [p[0] for p in poly], [p[1] for p in poly]
        for y in range(max(0, int(min(ys))), min(F, int(max(ys)) + 1)):
            for x in range(max(0, int(min(xs))), min(F, int(max(xs)) + 1)):
                p = (x + 0.5, y + 0.5)
                if not inside_poly(*p, poly):
                    continue
                u = (p[0] - bx) * ux + (p[1] - by) * uy
                v = ((p[0] - bx) * nx + (p[1] - by) * ny) * lit_side
                level = 4 if v > hw * 0.25 else 3 if v > -hw * 0.3 else 1
                if u > tip_start:
                    level += 1
                if abs(v - hw * 0.5) < 0.7 and 2 < u < tip_start:
                    level = 5  # aresta brilhante
                self.px[x, y] = rgba(ramp[1 + max(0, min(5, level))] if level < 5 else ramp[6])
                self.part[(x, y)] = seed

    def outline(self, color):
        solid = {(x, y) for y in range(F) for x in range(F) if self.px[x, y][3] == 255}
        for x, y in solid:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in solid and 0 <= n[0] < F and 0 <= n[1] < F:
                    self.px[n] = rgba(color)

    def halo(self, color, strength):
        solid = {(x, y) for y in range(F) for x in range(F) if self.px[x, y][3] > 0}
        for radius, alpha in ((1, 80), (2, 44), (3, 20))[:strength]:
            ring = set()
            for x, y in solid:
                for dx in range(-radius, radius + 1):
                    for dy in range(-radius, radius + 1):
                        n = (x + dx, y + dy)
                        if abs(dx) + abs(dy) <= radius and n not in solid and 0 <= n[0] < F and 0 <= n[1] < F:
                            ring.add(n)
            for n in ring:
                if self.px[n][3] == 0:
                    self.px[n] = rgba(color, alpha)
            solid |= ring


# ---------------------------------------------------------------- corpo

LEG = [(31, 66), (45, 64), (47, 79), (47, 91), (29, 91), (28, 79)]
PELVIS = [(34, 57), (62, 57), (65, 69), (57, 76), (39, 76), (31, 69)]
CHEST = [(31, 30), (65, 30), (69, 44), (62, 59), (48, 63), (34, 59), (27, 44)]
HEAD = [(41, 19), (55, 19), (59, 27), (56, 36), (40, 36), (37, 27)]
SHOULDER = [(13, 28), (22, 18), (36, 19), (41, 28), (37, 41), (24, 46), (13, 41)]
UPPER_ARM = [(8, 40), (21, 42), (22, 56), (16, 62), (6, 58), (4, 48)]
FIST = [(3, 58), (18, 56), (24, 66), (22, 80), (14, 87), (4, 83), (1, 71)]
# braçadeira da Floria presa no braço direito (assimétrica de propósito)
BRACE = [(74, 44), (90, 46), (91, 51), (75, 50)]
# cristais: (base, ângulo em graus, comprimento, largura); o lado direito é espelhado
SHOULDER_CRYSTALS = [((24, 23), -105, 19, 7), ((31, 22), -78, 13, 6), ((16, 29), -140, 13, 6)]
BACK_CRYSTALS = [((48, 24), -90, 20, 8), ((41, 27), -115, 14, 6), ((55, 27), -65, 14, 6)]
FIST_CRYSTALS = [((7, 62), -125, 9, 4)]
CORE = (48, 45)
# trilhas de circuito no ombro esquerdo e no peito: pontos ligados em ângulo reto
TRACES = [('shoulder0', [(18, 36), (24, 36), (24, 31), (30, 31)]),
          ('chest', [(56, 40), (60, 40), (60, 50), (57, 53)]),
          ('fist0', [(8, 72), (13, 72), (13, 78)])]

# rachaduras: (parte, início, ângulo, comprimento); cada estágio soma as do anterior
CRACKS = [
    ('chest', CORE, -150, 10), ('chest', CORE, -35, 9), ('chest', CORE, 115, 9), ('chest', CORE, 60, 8),
    ('chest', CORE, -95, 14), ('chest', CORE, 175, 14), ('chest', CORE, 5, 13),
    ('shoulder0', (27, 30), 115, 11), ('shoulder1', (69, 30), 65, 11),
    ('fist0', (14, 64), 85, 13), ('fist1', (82, 64), 95, 13), ('leg0', (38, 68), 90, 14), ('leg1', (58, 68), 90, 14),
    ('head', (46, 21), 80, 7), ('arm0', (14, 45), 75, 9), ('arm1', (82, 45), 105, 9), ('pelvis', (44, 60), 100, 9),
]
CRACKS_PER_STAGE = (0, 4, 9, len(CRACKS))


def crack_points(seed, start, angle, length):
    """Fenda em zigue-zague saindo de um ponto, com galhos curtos."""
    rng = random.Random(seed)
    points = []
    branches = [(start, math.radians(angle), length)]
    while branches:
        (x, y), a, n = branches.pop()
        for _ in range(n):
            a += rng.uniform(-0.45, 0.45)
            x += math.cos(a)
            y += math.sin(a)
            points.append((round(x), round(y)))
            if n > 5 and rng.random() < 0.12:
                branches.append(((x, y), a + rng.choice((-0.8, 0.8)), n // 2))
    return points


CRACK_POINTS = [(part, crack_points(i * 13 + 1, start, angle, length)) for i, (part, start, angle, length) in enumerate(CRACKS)]


def mirror_crystal(c):
    (x, y), a, length, w = c
    return ((F - x, y), 180 - a, length, w)


def golem(stage=0, bob=0, legs=(0, 0), arms=((0, 0), (0, 0)), raise_arms=0, glow=1, flash=False, glitch_seed=0, back=False):
    """`back` desenha as costas, para o giro: sem rosto nem implantes, com os cristais das costas na frente."""
    c = Canvas()
    ub = bob  # tronco, cabeça e braços acompanham a respiração
    offset = {'chest': (0, ub), 'head': (0, ub + 1), 'pelvis': (0, ub // 2),
              'leg0': (0, legs[0]), 'leg1': (0, legs[1])}
    c.chunk(move(LEG, 0, legs[0]), BODY, 1)
    c.chunk(move(mirror(LEG), 0, legs[1]), BODY, 2)
    c.chunk(move(PELVIS, 0, ub // 2), BODY, 3)
    if not back:
        for i, ((x, y), a, length, w) in enumerate(BACK_CRYSTALS):
            c.crystal((x, y + ub), math.radians(a), length, w, CRYSTAL, 40 + i)
    c.chunk(move(CHEST, 0, ub), BODY, 4)
    c.chunk(move(HEAD, 0, ub + 1), BODY, 5)
    if back:
        for i, ((x, y), a, length, w) in enumerate(BACK_CRYSTALS):
            c.crystal((x, y + ub + 10), math.radians(a), length + 6, w, CRYSTAL, 40 + i)
    for side, mir in enumerate((lambda p: p, mirror)):
        sign = 1 if side == 0 else -1
        ax, ay = arms[side]
        # braços erguidos sobem por cima do ombro e chegam perto da cabeça
        lx, ly = sign * raise_arms * 0.45, -raise_arms
        offset[f'shoulder{side}'] = (0, ub)
        offset[f'arm{side}'] = (round(ax + lx * 0.5), round(ub + ay + ly * 0.5))
        offset[f'fist{side}'] = (round(ax + lx), round(ub + ay + ly))
        c.chunk(move(mir(SHOULDER), 0, ub), BODY, 10 + side)
        c.chunk(move(mir(UPPER_ARM), *offset[f'arm{side}']), BODY, 12 + side)
        if side == 1 and not back:
            c.chunk(move(BRACE, *offset['arm1']), METAL, 30, stripes=False)
            bx, by = offset['arm1']
            for k in range(3):
                c.put(78 + k * 4 + bx, 48 + by, GLOW)
        c.chunk(move(mir(FIST), *offset[f'fist{side}']), BODY, 14 + side)
        for i, cr in enumerate(SHOULDER_CRYSTALS):
            (x, y), a, length, w = cr if side == 0 else mirror_crystal(cr)
            c.crystal((x, y + ub), math.radians(a), length, w, CRYSTAL, 50 + side * 10 + i)
        for i, cr in enumerate(FIST_CRYSTALS):
            (x, y), a, length, w = cr if side == 0 else mirror_crystal(cr)
            fx, fy = offset[f'fist{side}']
            c.crystal((x + fx, y + fy), math.radians(a), length, w, CRYSTAL, 70 + side * 10 + i)
    if not back:
        # trilhas de circuito: linha escura com o fio aceso e nós nas pontas
        for part, pts in TRACES:
            dx, dy = offset[part]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                for k in range(max(abs(x1 - x0), abs(y1 - y0)) + 1):
                    x = x0 + dx + (k if x1 > x0 else -k if x1 < x0 else 0)
                    y = y0 + dy + (k if y1 > y0 else -k if y1 < y0 else 0)
                    c.put(x, y, GLOW if (k + glitch_seed) % 5 else CRACK)
            for x, y in (pts[0], pts[-1]):
                for ddx, ddy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                    c.put(x + dx + ddx, y + dy + ddy, METAL[2])
                c.put(x + dx, y + dy, GLOW)
    # rachaduras: fenda clara com borda ciano misturada ao topázio
    for part, pts in CRACK_POINTS[:CRACKS_PER_STAGE[stage]]:
        dx, dy = offset[part]
        cells = [(x + dx, y + dy) for x, y in pts if 0 <= x + dx < F and 0 <= y + dy < F and c.px[x + dx, y + dy][3]]
        for x, y in cells:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < F and 0 <= ny < F and c.px[nx, ny][3] and c.px[nx, ny][:3] != CRACK:
                    c.px[nx, ny] = mix(c.px[nx, ny], GLOW, 0.55)
        for x, y in cells:
            c.px[x, y] = rgba(CRACK)
    if not back:
        # soquete de metal no peito com o núcleo da Floria dentro
        cx, cy = CORE[0], CORE[1] + ub
        core_r = 1.5 + glow * 0.5 + stage * 0.4
        for y in range(cy - 6, cy + 7):
            for x in range(cx - 6, cx + 7):
                d = max(abs(x - cx), abs(y - cy)) * 0.75 + min(abs(x - cx), abs(y - cy)) * 0.45  # octógono
                if d <= core_r:
                    c.put(x, y, (255, 255, 245) if d <= core_r - 1.5 else GLOW)
                elif d <= core_r + 2.2:
                    c.put(x, y, METAL[4] if y < cy and x < cx else METAL[2])
        for bx, by in ((-5, -5), (5, -5), (-5, 5), (5, 5)):
            c.put(cx + bx, cy + by, METAL[5])
        # viseira de metal com a fenda vermelha da Floria no lugar dos olhos
        ey = 29 + ub
        for x in range(39, 58):
            c.put(x, ey - 2, METAL[4])
            c.put(x, ey - 1, METAL[2])
            c.put(x, ey, METAL[1])
            c.put(x, ey + 1, METAL[2])
        for x in range(42, 55):
            c.put(x, ey, LED if x in (44, 45, 51, 52) else LED_DIM)
        if stage:  # LED falhando conforme corrompe
            c.put(42 + (glitch_seed * 5) % 13, ey, (255, 210, 220))
    if flash:
        for y in range(F):
            for x in range(F):
                if c.px[x, y][3]:
                    c.px[x, y] = (255, 255, 255, 255)
    c.outline(BODY[0])
    c.halo(GLOW, glow)
    if not flash:
        glitch(c.img, stage, glitch_seed)
    return c.img


def glitch(img, stage, seed):
    """Fatias da imagem deslocadas na horizontal com a borda em ciano e magenta."""
    rng = random.Random(stage * 101 + seed * 7)
    slices = (1, 2, 3, 4)[stage] if rng.random() < 0.35 + stage * 0.2 else 0
    px = img.load()
    for _ in range(slices):
        y0, h, dx = rng.randint(18, 80), rng.randint(1, 1 + stage), rng.choice((-1, 1)) * rng.randint(1, 1 + stage)
        for y in range(y0, min(F, y0 + h)):
            row = [px[x, y] for x in range(F)]
            for x in range(F):
                sx = x - dx
                px[x, y] = row[sx] if 0 <= sx < F else T
            solid = [x for x in range(F) if px[x, y][3] == 255]
            if solid:
                px[solid[0], y] = rgba(GLOW)
                px[solid[-1], y] = rgba(MAGENTA)


def shatter(base, step, steps):
    """Quebra a imagem em lascas (células em volta de pontos sorteados) que voam e caem."""
    src = base.load()
    img = Image.new('RGBA', (F, F), T)
    px = img.load()
    rng = random.Random(5)
    seeds = [(rng.uniform(8, 88), rng.uniform(16, 92)) for _ in range(26)]
    fade = 1 - step / (steps + 0.5)
    for y in range(F):
        for x in range(F):
            p = src[x, y]
            if p[3] < 255:
                continue
            sx, sy = min(seeds, key=lambda s: (s[0] - x) ** 2 + (s[1] - y) ** 2)
            dx, dy = sx - 48, sy - 52
            norm = math.hypot(dx, dy) or 1
            push = step * (2 + norm / 12)
            nx = round(x + dx / norm * push)
            ny = round(y + dy / norm * push + step * step * 1.1)
            if 0 <= nx < F and 0 <= ny < F:
                px[nx, ny] = p[:3] + (int(255 * fade),)
    return img


def build_sheet():
    sheet = Image.new('RGBA', (F * 4, F * (STAGES * 3 + 4)), T)
    put = lambda img, col, row: sheet.alpha_composite(img, (col * F, row * F))
    walk = [((0, -3), ((0, 2), (0, -2)), 0), ((0, 0), ((0, 0), (0, 0)), 1),
            ((-3, 0), ((0, -2), (0, 2)), 0), ((0, 0), ((0, 0), (0, 0)), 1)]
    slam = [dict(bob=1, raise_arms=10, glow=2), dict(bob=-1, raise_arms=24, glow=3),
            dict(bob=3, arms=((4, 4), (-4, 4)), glow=3), dict(bob=2, arms=((3, 3), (-3, 3)), glow=2)]
    for s in range(STAGES):
        for i, b in enumerate((0, 1, 2, 1)):
            put(golem(s, bob=b, arms=((0, b), (0, b)), glitch_seed=i), i, s * 3)
        for i, (legs, arms, b) in enumerate(walk):
            put(golem(s, bob=b, legs=legs, arms=arms, glitch_seed=i + 4), i, s * 3 + 1)
        for i, kw in enumerate(slam):
            put(golem(s, glitch_seed=i + 8, **kw), i, s * 3 + 2)
    put(golem(flash=True), 0, STAGES * 3)
    # Giro: o jogo alterna frente e costas e achata na horizontal, como um pião.
    spin_arms = ((1, -20), (-1, -20))
    for s in range(STAGES):
        put(golem(s, arms=spin_arms, glow=2, glitch_seed=12), s, STAGES * 3 + 2)
        put(golem(s, arms=spin_arms, glow=2, glitch_seed=13, back=True), s, STAGES * 3 + 3)
    base = golem(STAGES - 1)
    for i in range(4):
        put(shatter(base, i + 1, 4), i, STAGES * 3 + 1)
    return sheet


def build_gem():
    """Topázio que cai no chão quando o golem explode: gota lapidada laranja com reflexo."""
    size = 12
    img = Image.new('RGBA', (size, size), T)
    px = img.load()
    for y in range(1, 11):
        half = (y - 1) * 0.9 if y < 5 else (10 - y) * 0.75 + 0.5
        for x in range(size):
            if abs(x - 5.5) <= half:
                left = x < 5.5
                px[x, y] = rgba(BODY[5] if y < 4 and left else BODY[4] if left else BODY[3] if y < 6 else BODY[2])
    px[4, 3] = px[4, 4] = rgba(BODY[6])
    solid = {(x, y) for y in range(size) for x in range(size) if px[x, y][3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in solid and 0 <= n[0] < size and 0 <= n[1] < size:
                px[n] = rgba(BODY[0])
    return img


if __name__ == '__main__':
    assert CRACKS_PER_STAGE == tuple(sorted(CRACKS_PER_STAGE)) and len(CRACKS_PER_STAGE) == STAGES
    os.makedirs(OUT, exist_ok=True)
    build_sheet().save(os.path.join(OUT, 'topazio-golem.png'))
    build_gem().save(os.path.join(OUT, 'topazio-gema.png'))
    print('ok')
