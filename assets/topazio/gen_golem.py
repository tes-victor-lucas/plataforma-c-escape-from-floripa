"""Chefe final: o Golem de Topázio, versões de cor para escolher.

Corpo de blocos facetados, cristais nos ombros e nas costas, rachaduras e olhos brilhando.
Cada versão troca só as paletas (corpo, cristais, brilho).

golem-<versao>.png   quadros de 96x96, uma linha por animação:
    0 parado (4)   1 andando (4)   2 pancada no chão (4)
    3 dano: piscando, rachado, muito rachado, enfurecido   4 estilhaçando na morte (4)
preview.png          primeiro quadro de cada versão, lado a lado e ampliado

uso: python3 assets/topazio/gen_golem.py
"""
import math
import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), 'versoes')
F = 96
T = (0, 0, 0, 0)
LIGHT = -3 * math.pi / 4  # luz do alto à esquerda

# rampas: contorno, 5 tons do escuro ao claro, reflexo
IMPERIAL = ((44, 14, 6), (98, 32, 10), (160, 60, 14), (218, 108, 26), (246, 156, 54), (255, 208, 124), (255, 246, 220))
ROSA = ((48, 8, 26), (106, 22, 56), (170, 42, 92), (222, 86, 132), (246, 144, 174), (255, 204, 218), (255, 242, 246))
AZUL = ((8, 14, 34), (10, 34, 82), (16, 72, 150), (28, 118, 196), (64, 168, 232), (140, 214, 248), (226, 248, 255))
ROCHA = ((10, 8, 10), (30, 26, 28), (50, 44, 44), (74, 66, 62), (102, 92, 84), (134, 122, 110), (170, 160, 148))
CHAMPANHE = ((52, 26, 10), (120, 66, 22), (186, 116, 40), (230, 168, 76), (250, 210, 128), (255, 236, 186), (255, 252, 236))

VARIANTS = {
    # nome: (corpo, cristais, brilho de rachaduras/olhos, rachaduras visíveis, estrias no corpo)
    'imperial': (IMPERIAL, IMPERIAL, (255, 214, 92), False, True),
    'imperial-azul': (IMPERIAL, AZUL, (110, 226, 255), True, True),
    'imperial-rosa': (IMPERIAL, ROSA, (255, 120, 170), True, True),
    'rocha-topazio': (ROCHA, IMPERIAL, (255, 150, 30), True, False),
    'degrade-rosa': (IMPERIAL, ROSA, (255, 190, 80), False, True),  # pernas laranja subindo para o rosa
}


def rgba(c, a=255):
    return c[:3] + (a,)


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

    def chunk(self, poly, ramp, seed, stripes=False):
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
        # junção escura onde o bloco encosta em outro ou na borda
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
                if v > hw * 0.25:
                    level = 4
                elif v > -hw * 0.3:
                    level = 3
                else:
                    level = 1
                if u > tip_start:
                    level += 1
                if abs(v - hw * 0.5) < 0.7 and u < tip_start and u > 2:
                    level = 5  # aresta brilhante
                self.px[x, y] = rgba(ramp[1 + max(0, min(5, level))] if level < 5 else ramp[6])
                self.part[(x, y)] = seed

    def glow_line(self, points, color):
        for x, y in points:
            if self.px[x, y][3]:
                self.px[x, y] = rgba(color)

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
# cristais: (base, ângulo em graus, comprimento, largura); o lado direito é espelhado
SHOULDER_CRYSTALS = [((24, 23), -105, 19, 7), ((31, 22), -78, 13, 6), ((16, 29), -140, 13, 6)]
BACK_CRYSTALS = [((48, 24), -90, 20, 8), ((41, 27), -115, 14, 6), ((55, 27), -65, 14, 6)]
FIST_CRYSTALS = [((7, 62), -125, 9, 4)]


def mirror_crystal(c):
    (x, y), a, length, w = c
    return ((F - x, y), 180 - a, length, w)


def body_ramp(variant, part):
    body, crystals, *_ = VARIANTS[variant]
    if variant == 'degrade-rosa':
        return {'leg': IMPERIAL, 'pelvis': IMPERIAL, 'fist': IMPERIAL, 'arm': IMPERIAL,
                'chest': IMPERIAL, 'shoulder': ROSA, 'head': ROSA}[part]
    return body


def crack_paths(seed, region, count):
    rng = random.Random(seed)
    x0, y0, x1, y1 = region
    paths = []
    for _ in range(count):
        x, y = rng.randint(x0, x1), rng.randint(y0, y1)
        path = []
        for _ in range(rng.randint(7, 13)):
            path.append((x, y))
            x += rng.choice((-1, 0, 0, 1))
            y += 1
            if rng.random() < 0.25:
                path.append((x, y))
                x += rng.choice((-1, 1))
        paths.append(path)
    return paths


def golem(variant, bob=0, legs=(0, 0), arms=((0, 0), (0, 0)), raise_arms=0, cracks=0, glow=1,
          flash=False):
    body, crystals, glow_color, show_cracks, stripes = VARIANTS[variant]
    c = Canvas()
    ub = bob  # tronco, cabeça e braços acompanham a respiração
    # pernas atrás do tronco
    c.chunk(move(LEG, 0, legs[0]), body_ramp(variant, 'leg'), 1, stripes)
    c.chunk(move(mirror(LEG), 0, legs[1]), body_ramp(variant, 'leg'), 2, stripes)
    c.chunk(move(PELVIS, 0, ub // 2), body_ramp(variant, 'pelvis'), 3, stripes)
    for i, cr in enumerate(BACK_CRYSTALS):
        (x, y), a, length, w = cr
        c.crystal((x, y + ub), math.radians(a), length, w, crystals, 40 + i)
    c.chunk(move(CHEST, 0, ub), body_ramp(variant, 'chest'), 4, stripes)
    c.chunk(move(HEAD, 0, ub + 1), body_ramp(variant, 'head'), 5, stripes)
    for side, mir in enumerate((lambda p: p, mirror)):
        sign = 1 if side == 0 else -1
        ax, ay = arms[side]
        # braços erguidos sobem por cima do ombro e chegam perto da cabeça
        lift = (sign * raise_arms * 0.45, -raise_arms)
        c.chunk(move(mir(SHOULDER), 0, ub), body_ramp(variant, 'shoulder'), 10 + side, stripes)
        c.chunk(move(mir(UPPER_ARM), ax + lift[0] * 0.5, ub + ay + lift[1] * 0.5), body_ramp(variant, 'arm'), 12 + side, stripes)
        c.chunk(move(mir(FIST), ax + lift[0], ub + ay + lift[1]), body_ramp(variant, 'fist'), 14 + side, stripes)
        for i, cr in enumerate(SHOULDER_CRYSTALS):
            (x, y), a, length, w = cr if side == 0 else mirror_crystal(cr)
            c.crystal((x, y + ub), math.radians(a), length, w, crystals, 50 + side * 10 + i)
        for i, cr in enumerate(FIST_CRYSTALS):
            (x, y), a, length, w = cr if side == 0 else mirror_crystal(cr)
            c.crystal((x + ax + lift[0], y + ub + ay + lift[1]), math.radians(a), length, w, crystals, 70 + side * 10 + i)
    # rachaduras brilhando no peito e nos ombros
    n_cracks = (3 if show_cracks else 0) + cracks * 3
    for path in crack_paths(9, (32, 36 + ub, 64, 52 + ub), n_cracks):
        c.glow_line([(x, y) for x, y in path if 0 <= x < F and 0 <= y < F], glow_color)
    # veio de luz no centro do peito: o núcleo da Floria
    core = (48, 45 + ub)
    for y in range(core[1] - 3, core[1] + 4):
        for x in range(core[0] - 3, core[0] + 4):
            d = math.hypot(x - core[0], y - core[1])
            if d <= 1.5 + glow * 0.6:
                c.px[x, y] = rgba((255, 255, 240) if d <= glow * 0.6 else glow_color)
    # sobrancelha funda e olhos em fenda
    ey = 28 + ub + 1
    head_ramp = body_ramp(variant, 'head')
    for x in range(40, 57):
        c.px[x, ey - 1] = rgba(head_ramp[1])
        c.px[x, ey] = rgba(head_ramp[2])
    for ex in (43, 51):
        for k in range(3):
            c.px[ex + k, ey] = rgba((255, 255, 236) if k == 1 else glow_color)
    if flash:
        for y in range(F):
            for x in range(F):
                if c.px[x, y][3]:
                    c.px[x, y] = (255, 255, 255, 255)
    c.outline(body[0])
    c.halo(glow_color, glow)
    return c.img


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


def build_sheet(variant):
    sheet = Image.new('RGBA', (F * 4, F * 5), T)
    put = lambda img, col, row: sheet.alpha_composite(img, (col * F, row * F))
    for i, b in enumerate((0, 1, 2, 1)):
        put(golem(variant, bob=b, arms=((0, b), (0, b))), i, 0)
    walk = [((0, -3), ((0, 2), (0, -2)), 0), ((0, 0), ((0, 0), (0, 0)), 1),
            ((-3, 0), ((0, -2), (0, 2)), 0), ((0, 0), ((0, 0), (0, 0)), 1)]
    for i, (legs, arms, b) in enumerate(walk):
        put(golem(variant, bob=b, legs=legs, arms=arms), i, 1)
    slam = [dict(bob=1, raise_arms=10, glow=2), dict(bob=-1, raise_arms=24, glow=3),
            dict(bob=3, arms=((4, 4), (-4, 4)), glow=3), dict(bob=2, arms=((3, 3), (-3, 3)), glow=2)]  # a onda de choque fica com playShockwave
    for i, kw in enumerate(slam):
        put(golem(variant, **kw), i, 2)
    put(golem(variant, flash=True), 0, 3)
    put(golem(variant, cracks=1), 1, 3)
    put(golem(variant, cracks=3), 2, 3)
    put(golem(variant, cracks=3, glow=3, bob=1), 3, 3)
    base = golem(variant, cracks=2)
    for i in range(4):
        put(shatter(base, i + 1, 4), i, 4)
    return sheet


def build_preview(sheets, scale=3):
    bg = (34, 30, 40, 255)
    pad = 8
    img = Image.new('RGBA', (len(sheets) * (F + pad) + pad, F + 2 * pad), bg)
    for i, sheet in enumerate(sheets):
        img.alpha_composite(sheet.crop((0, 0, F, F)), (pad + i * (F + pad), pad))
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    sheets = []
    for name in VARIANTS:
        sheet = build_sheet(name)
        sheet.save(os.path.join(OUT, f'golem-{name}.png'))
        sheets.append(sheet)
    build_preview(sheets).save(os.path.join(OUT, 'preview.png'))
    print('ok')
