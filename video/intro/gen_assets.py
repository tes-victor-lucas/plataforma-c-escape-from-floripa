"""Sprites do filme que o jogo não tem: arma em primeira pessoa, clarão, explosão, silhueta e recortes de folhas.

Tudo em pixel art no tamanho do jogo; o filme amplia sem suavizar. Rodar de novo sobrescreve assets/sprites.

uso: python3 gen_assets.py
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', '..', 'game', 'public', 'assets')
OUT = os.path.join(HERE, 'assets', 'sprites')
os.makedirs(OUT, exist_ok=True)

INK = (8, 10, 16, 255)
STEEL0 = (28, 32, 42, 255)
STEEL1 = (52, 58, 74, 255)
STEEL2 = (96, 104, 124, 255)
CYAN = (92, 229, 241, 255)
RED = (233, 9, 49, 255)
SKIN0 = (120, 72, 52, 255)
SKIN1 = (168, 108, 78, 255)
SLEEVE = (22, 24, 34, 255)


def gun():
    """Pistola segura com as duas mãos, vista por trás e apontando para o centro do quadro (64x48)."""
    im = Image.new('RGBA', (64, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Antebraços entrando pelos cantos de baixo, de jaqueta escura.
    d.polygon([(0, 48), (0, 38), (20, 26), (28, 32), (12, 48)], fill=SLEEVE, outline=INK)
    d.polygon([(64, 48), (64, 34), (42, 24), (34, 32), (50, 48)], fill=SLEEVE, outline=INK)
    # Ferrolho estreito de pé, com a traseira da mira, a mira acesa e a faixa vermelha de energia.
    d.rectangle((27, 4, 37, 24), fill=STEEL1, outline=INK)
    d.rectangle((28, 5, 36, 6), fill=STEEL2)
    d.rectangle((28, 2, 30, 4), fill=STEEL0, outline=INK)
    d.rectangle((34, 2, 36, 4), fill=STEEL0, outline=INK)
    d.rectangle((31, 8, 33, 9), fill=CYAN)
    d.rectangle((29, 16, 35, 17), fill=RED)
    # Mãos fechadas na empunhadura: a direita por trás, a esquerda apoiando por baixo.
    d.polygon([(20, 24), (44, 24), (46, 33), (40, 38), (24, 38), (18, 32)], fill=SKIN0, outline=INK)
    d.rectangle((22, 25, 42, 27), fill=SKIN1)
    for x in (25, 30, 35, 40):
        d.line((x, 29, x, 34), fill=INK)
    d.polygon([(18, 32), (26, 36), (24, 42), (14, 40)], fill=SKIN1, outline=INK)
    return im


def muzzle(frame):
    """Clarão do tiro em dois quadros (24x24)."""
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = 11 if frame == 0 else 7
    c = 12
    d.polygon([(c, c - r), (c + 3, c - 3), (c + r, c), (c + 3, c + 3), (c, c + r), (c - 3, c + 3), (c - r, c), (c - 3, c - 3)],
              fill=(255, 196, 64, 255))
    d.polygon([(c, c - r + 4), (c + 2, c), (c, c + r - 4), (c - 2, c)], fill=(255, 255, 230, 255))
    d.rectangle((c - 2, c - 2, c + 2, c + 2), fill=(255, 255, 255, 255))
    return im


def flame(cx, cy, r, seed, spikes=14):
    """Contorno de chama: raio irregular por semente, com pontas mais altas para cima."""
    import math
    pts, s = [], seed
    for k in range(spikes):
        s = (s * 1103515245 + 12345) % 2147483648
        a = 2 * math.pi * k / spikes
        up = 1.35 if math.sin(a) < -0.3 else 1.0
        rr = r * (0.7 + (s % 100) / 220) * up
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    return pts


def explosion(frame):
    """Explosão de 4 quadros (32x32): núcleo branco, chama irregular vermelha e laranja, fumaça."""
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    radii = [7, 12, 14, 15]
    r = radii[frame]
    if frame < 3:
        d.polygon(flame(16, 17, r, 7 + frame), fill=RED)
        d.polygon(flame(16, 18, r * 0.72, 31 + frame), fill=(255, 150, 40, 255))
        if frame < 2:
            d.polygon(flame(16, 19, r * 0.42, 53 + frame, 10), fill=(255, 245, 210, 255))
    else:
        for dx, dy in ((-6, -4), (5, -6), (-3, 6), (7, 4), (0, 0)):
            d.ellipse((16 + dx - 6, 16 + dy - 6, 16 + dx + 6, 16 + dy + 6), fill=(46, 44, 52, 220))
    return im


def sheet_frame(path, cols, size, index):
    sheet = Image.open(path).convert('RGBA')
    return sheet.crop(((index % cols) * size, (index // cols) * size, (index % cols + 1) * size, (index // cols + 1) * size))


def strip(frames):
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


def silhouette(frame, rim=RED):
    """Personagem de costas no escuro: quase preto, com o contorno da direita aceso (vermelho ou fogo)."""
    px = frame.load()
    out = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    po = out.load()
    w, h = frame.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            lum = (r + g + b) / 3
            po[x, y] = (int(10 + lum * 0.10), int(12 + lum * 0.08), int(20 + lum * 0.12), 255)
            if x + 1 >= w or px[x + 1, y][3] < 128:
                po[x, y] = rim
    return out


CHARACTER = os.path.join(GAME, 'character.png')
COLS = 12  # 493 px / 38 px por quadro, como o Phaser conta

gun().save(os.path.join(OUT, 'gun.png'))
strip([muzzle(0), muzzle(1)]).save(os.path.join(OUT, 'muzzle.png'))
strip([explosion(f) for f in range(4)]).save(os.path.join(OUT, 'explosion.png'))
strip([sheet_frame(CHARACTER, COLS, 38, f) for f in range(132, 141)]).save(os.path.join(OUT, 'player-right.png'))
silhouette(sheet_frame(CHARACTER, COLS, 38, 96)).save(os.path.join(OUT, 'player-back-dark.png'))
# Multidão fugindo pela rua em chamas: corredores de costas, escuros, com o contorno aceso pelo fogo.
strip([silhouette(sheet_frame(CHARACTER, COLS, 38, f), (255, 150, 40, 255)) for f in range(96, 105)]).save(
    os.path.join(OUT, 'runner-dark.png'))
strip([sheet_frame(CHARACTER, COLS, 38, f) for f in range(96, 105)]).save(os.path.join(OUT, 'player-up.png'))
# Guarda cyber de frente (linha de baixo): andando 0-3, aviso 4, investida 5, dano 6, destruído 7.
guard = os.path.join(GAME, 'enemies', 'guarda-municipal-cyber', 'guarda-municipal-cyber.png')
strip([sheet_frame(guard, 8, 32, f) for f in range(8)]).save(os.path.join(OUT, 'guard.png'))
sheet_frame(os.path.join(GAME, 'enemies', 'drone-robot_nyknck', 'drone-robot_nyknck.png'), 7, 32, 0).save(
    os.path.join(OUT, 'drone.png'))
print('ok', sorted(os.listdir(OUT)))
