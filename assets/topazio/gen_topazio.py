"""Chefe final: o Topázio, uma gema viva criada pela Floria.

Fase 1: topázio bruto (prisma estriado), que serve de casca.
Fase 2: topázio lapidado em gota, revelado quando a casca quebra.

topazio-chefe.png    quadros de 64x64, uma linha por animação:
    0 bruto parado (4)      1 lapidado parado (4)     2 carregando ataque (4)
    3 dano: bruto, lapidado, casca rachando, casca estourando
    4 estilhaçando na morte (4)
topazio-projeteis.png  quadros de 16x16: estilhaço girando (4) e brilho do impacto (2)

uso: python3 assets/topazio/gen_topazio.py
"""
import math
import os
import random

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'enemies', 'topazio')
F = 64

T = (0, 0, 0, 0)
OL = (8, 14, 34, 255)
B0 = (10, 34, 82, 255)     # fundo das facetas
B1 = (16, 72, 150, 255)
B2 = (28, 118, 196, 255)
B3 = (64, 168, 232, 255)
B4 = (140, 214, 248, 255)
B5 = (226, 248, 255, 255)  # reflexo
RAW0 = (14, 26, 60, 255)
RAW1 = (26, 50, 104, 255)
RAW2 = (44, 82, 150, 255)
RAW3 = (110, 140, 190, 255)
CORE = (180, 250, 255, 255)
GLOW = (90, 220, 255)


def blank():
    return Image.new('RGBA', (F, F), T)


def outline(img):
    px = img.load()
    solid = {(x, y) for y in range(F) for x in range(F) if px[x, y][3] > 0}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in solid and 0 <= n[0] < F and 0 <= n[1] < F:
                px[n] = OL


def aura(img, strength):
    """Halo ciano em volta da gema; mais forte enquanto carrega o ataque."""
    px = img.load()
    solid = {(x, y) for y in range(F) for x in range(F) if px[x, y][3] > 0}
    for radius, alpha in ((1, 90), (2, 50), (3, 24))[:strength]:
        ring = set()
        for x, y in solid:
            for dx in range(-radius, radius + 1):
                for dy in range(-radius, radius + 1):
                    n = (x + dx, y + dy)
                    if n not in solid and 0 <= n[0] < F and 0 <= n[1] < F and abs(dx) + abs(dy) <= radius:
                        ring.add(n)
        for n in ring:
            if px[n][3] == 0:
                px[n] = GLOW + (alpha,)
        solid |= ring


# ---------------------------------------------------------------- lapidado (gota)

def pear_mask(cx, cy, r, top):
    """Gota com a ponta para cima: círculo embaixo e laterais afinando até a ponta."""
    def inside(x, y):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
            return True
        if top <= y < cy:
            t = (y - top) / (cy - top)
            half = r * math.sin(t * math.pi / 2) ** 0.8
            return abs(x - cx + 0.5) <= half
        return False
    return inside


def _in_triangle(p, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))


def _in_polygon(p, poly):
    inside = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % len(poly)]
        if (y1 > p[1]) != (y2 > p[1]) and p[0] < (x2 - x1) * (p[1] - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def cut_gem(bob=0, glint=0, charge=0, flash=False):
    """Lapidação em gota: mesa, facetas estrela e da cintura; o brilho troca de faceta a cada quadro."""
    img = blank()
    px = img.load()
    cx, cy, r, top = 32, 38 + bob, 19, 8 + bob
    inside = pear_mask(cx, cy, r, top)
    center = (cx, cy - 5)

    def girdle(theta):
        d = 0.0
        while inside(round(center[0] + math.cos(theta) * (d + 1)), round(center[1] + math.sin(theta) * (d + 1))):
            d += 0.5
        return (center[0] + math.cos(theta) * d, center[1] + math.sin(theta) * d)

    g = [girdle(i * 2 * math.pi / 16 - math.pi / 2) for i in range(16)]
    tb = [(center[0] + (g[(2 * j + 1) % 16][0] - center[0]) * 0.45,
           center[1] + (g[(2 * j + 1) % 16][1] - center[1]) * 0.45) for j in range(8)]
    facets = []
    for j in range(8):
        facets.append(((tb[j], g[2 * j], g[2 * j + 1]), 1.0))
        facets.append(((tb[j], g[2 * j + 1], g[(2 * j + 2) % 16]), 1.0))
        facets.append(((tb[j], tb[(j + 1) % 8], g[(2 * j + 2) % 16]), 0.6))
    rng = random.Random(11)
    jitter = [rng.uniform(-0.7, 0.7) for _ in facets]
    light = -3 * math.pi / 4  # luz do alto à esquerda
    palette = (B0, B1, B2, B3, B4)
    for y in range(F):
        for x in range(F):
            if not inside(x, y):
                continue
            p = (x + 0.5, y + 0.5)
            if _in_polygon(p, tb):
                # mesa: clara, com o "laço" escuro atravessando a gota
                bow = abs(p[1] - center[1]) < 2.2 + abs(p[0] - center[0]) * 0.25 and abs(p[0] - center[0]) > 2
                px[x, y] = B1 if bow else B3
                continue
            color = B1
            for k, (tri, tilt) in enumerate(facets):
                if _in_triangle(p, *tri):
                    mx = sum(v[0] for v in tri) / 3 - center[0]
                    my = sum(v[1] for v in tri) / 3 - center[1]
                    phi = math.atan2(my, mx)
                    value = 2 + 1.6 * tilt * math.cos(phi - light) + jitter[k]
                    value += 0.9 * math.sin(glint * 1.6 + k * 1.3)  # cintilar
                    color = palette[max(0, min(4, round(value)))]
                    break
            px[x, y] = color
    # núcleo: o "olho" da unidade da Floria, mais forte ao carregar
    core_r = 2.5 + charge
    for y in range(F):
        for x in range(F):
            d = math.hypot(x - center[0] + 0.5, y - center[1] + 0.5)
            if d <= core_r and px[x, y][3]:
                px[x, y] = CORE if d <= core_r - 1.2 else B4
    # reflexo de luz no alto à esquerda
    for k in range(4):
        sx, sy = round(cx - 9 + k), round(top + 13 + k)
        if px[sx, sy][3]:
            px[sx, sy] = B5
    if flash:
        for y in range(F):
            for x in range(F):
                if px[x, y][3]:
                    px[x, y] = (255, 255, 255, 255)
    outline(img)
    aura(img, 1 + charge)
    return img


# ---------------------------------------------------------------- bruto (prisma estriado)

def raw_mask(cx, bottom, width, height, bob):
    """Prisma de topo em cunha, levemente inclinado como na rocha."""
    top = bottom - height + bob

    def inside(x, y):
        y0 = y - bob
        if y < top or y0 > bottom:
            return False
        lean = (bottom - y0) * 0.12
        left, right = cx - width / 2 + lean, cx + width / 2 + lean
        if y < top + 10:
            t = (y - top) / 10
            left += (1 - t) * width * 0.25
            right -= (1 - t) * width * 0.45
        return left <= x < right
    return inside, top


def raw_gem(bob=0, glint=0, flash=False, cracks=0):
    img = blank()
    px = img.load()
    cx, bottom, width, height = 30, 58, 30, 50
    inside, top = raw_mask(cx, bottom, width, height, bob)
    for y in range(F):
        for x in range(F):
            if not inside(x, y):
                continue
            # estrias verticais e as faces do prisma
            face = (x - 14) // 7
            stripe = (x + (y // 9)) % 4 == 0
            color = (RAW1, RAW2, RAW1, RAW0, RAW0)[min(4, max(0, face))]
            if stripe:
                color = RAW2 if color != RAW2 else RAW3
            if y < top + 10:
                color = RAW3 if x < cx else RAW2
            px[x, y] = color
    # brilho azul por dentro, como o centro translúcido da pedra
    for y in range(F):
        for x in range(F):
            lean = (bottom - (y - bob)) * 0.12
            band = abs(x - 31 - lean)
            if px[x, y][3] and y > top + 12 and band < 4 - abs(y - 38 - bob) / 10:
                px[x, y] = B3 if band < 1.5 else B2
    core_y = 36 + bob
    for y in range(core_y - 2, core_y + 3):
        for x in range(31, 36):
            if px[x, y][3] and math.hypot(x - 33, y - core_y) <= 2.2:
                px[x, y] = CORE
    gx = 20 + (glint * 4) % 16
    for k in range(3):
        if px[gx + k, top + 12 + k * 6][3]:
            px[gx + k, top + 12 + k * 6] = B5
    if cracks:
        rng = random.Random(3)
        for _ in range(cracks * 3):
            x, y = rng.randint(18, 42), rng.randint(top + 6, bottom - 4)
            for _ in range(8):
                if 0 <= x < F and 0 <= y < F and px[x, y][3]:
                    px[x, y] = B5
                x += rng.choice((-1, 0, 1))
                y += 1
    if flash:
        for y in range(F):
            for x in range(F):
                if px[x, y][3]:
                    px[x, y] = (255, 255, 255, 255)
    outline(img)
    aura(img, 1)
    return img


# ---------------------------------------------------------------- quebras

def shatter(base, step, steps, center=(32, 34)):
    """Quebra a imagem em lascas irregulares (células em volta de pontos sorteados) e as espalha."""
    src = base.load()
    img = blank()
    px = img.load()
    rng = random.Random(5)
    seeds = [(rng.uniform(14, 50), rng.uniform(10, 58)) for _ in range(14)]
    cx, cy = center
    fade = 1 - step / (steps + 0.5)
    for y in range(F):
        for x in range(F):
            p = src[x, y]
            if p[3] == 0 or p[:3] == GLOW:
                continue
            sx, sy = min(seeds, key=lambda s: (s[0] - x) ** 2 + (s[1] - y) ** 2)
            dx, dy = sx - cx, sy - cy
            norm = math.hypot(dx, dy) or 1
            push = step * (1.5 + norm / 10)
            nx = round(x + dx / norm * push)
            ny = round(y + dy / norm * push + step * step * 0.7)
            if 0 <= nx < F and 0 <= ny < F:
                px[nx, ny] = p[:3] + (int(p[3] * fade),)
    return img


def shell_break(step):
    """Casca bruta estourando com a gema lapidada aparecendo por dentro."""
    img = cut_gem(bob=0, glint=step)
    shell = shatter(raw_gem(cracks=3), step + 1, 3)
    img.alpha_composite(shell)
    return img


def build_boss():
    sheet = Image.new('RGBA', (F * 4, F * 5), T)
    bobs = (0, -1, -2, -1)
    for i, b in enumerate(bobs):
        sheet.alpha_composite(raw_gem(bob=b, glint=i), (i * F, 0))
        sheet.alpha_composite(cut_gem(bob=b, glint=i), (i * F, F))
        sheet.alpha_composite(cut_gem(bob=0, glint=i, charge=min(3, i + 1) if i < 3 else 3), (i * F, 2 * F))
    sheet.alpha_composite(raw_gem(flash=True), (0, 3 * F))
    sheet.alpha_composite(cut_gem(flash=True), (F, 3 * F))
    sheet.alpha_composite(raw_gem(cracks=2), (2 * F, 3 * F))
    sheet.alpha_composite(shell_break(1), (3 * F, 3 * F))
    base = cut_gem()
    for i in range(4):
        sheet.alpha_composite(shatter(base, i + 1, 4), (i * F, 4 * F))
    return sheet


# ---------------------------------------------------------------- projéteis

def shard_frame(angle):
    img = Image.new('RGBA', (16, 16), T)
    px = img.load()
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            u = dx * math.cos(angle) + dy * math.sin(angle)
            v = -dx * math.sin(angle) + dy * math.cos(angle)
            # losango alongado: estilhaço de cristal
            if abs(u) / 6 + abs(v) / 2.4 <= 1:
                px[x, y] = B4 if v < 0 else B2
                if abs(u) < 1.5 and abs(v) < 1:
                    px[x, y] = B5
    solid = {(x, y) for y in range(16) for x in range(16) if px[x, y][3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in solid and 0 <= n[0] < 16 and 0 <= n[1] < 16:
                px[n] = OL
    return img


def sparkle(size):
    img = Image.new('RGBA', (16, 16), T)
    px = img.load()
    for k in range(-size, size + 1):
        for x, y in ((8 + k, 8), (8, 8 + k)):
            px[x, y] = B5 if abs(k) < size else B3
    for k in (-1, 1):
        px[8 + k * (size // 2 + 1), 8 + k * (size // 2 + 1)] = B4
        px[8 - k * (size // 2 + 1), 8 + k * (size // 2 + 1)] = B4
    return img


def build_projectiles():
    sheet = Image.new('RGBA', (16 * 6, 16), T)
    for i in range(4):
        sheet.alpha_composite(shard_frame(i * math.pi / 4), (i * 16, 0))
    sheet.alpha_composite(sparkle(4), (64, 0))
    sheet.alpha_composite(sparkle(6), (80, 0))
    return sheet


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    build_boss().save(os.path.join(OUT, 'topazio-chefe.png'))
    build_projectiles().save(os.path.join(OUT, 'topazio-projeteis.png'))
    print('ok')
