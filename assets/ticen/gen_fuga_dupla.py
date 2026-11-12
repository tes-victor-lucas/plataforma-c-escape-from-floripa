"""Arte do fim da fuga em dupla no TICEN (multiplayer).

motorista.png  motorista do 763.2 de frente, com a farda da Estrela: quepe verde-água com a estrela amarela,
               bigode, camisa verde-água e calça escura. Dois quadros: parado e com o braço levantado.
bau.png        baú dos especiais da disputa: fechado e aberto, com o brilho saindo.

uso: python3 assets/ticen/gen_fuga_dupla.py
"""
import os

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'props')
T = (0, 0, 0, 0)
OUTLINE = (12, 14, 20, 255)
SKIN = (226, 176, 140, 255)
SKIN_D = (180, 128, 96, 255)
TEAL0 = (22, 112, 106, 255)
TEAL1 = (40, 156, 146, 255)
YELLOW = (240, 200, 40, 255)
PANTS = (40, 44, 60, 255)
SHOES = (20, 18, 22, 255)
MUSTACHE = (70, 44, 30, 255)
WOOD0 = (92, 52, 28, 255)
WOOD1 = (140, 84, 40, 255)
WOOD2 = (176, 112, 56, 255)
GOLD = (250, 210, 80, 255)
GLOW = (255, 240, 170, 255)


def outline(img):
    px = img.load()
    w, h = img.size
    solid = {(x, y) for y in range(h) for x in range(w) if px[x, y][3]}
    for x, y in solid:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n not in solid and 0 <= n[0] < w and 0 <= n[1] < h:
                px[n] = OUTLINE


def driver(raised_arm):
    """20x32, de frente para a câmera."""
    img = Image.new('RGBA', (20, 32), T)
    d = ImageDraw.Draw(img)
    d.rectangle((6, 25, 8, 30), fill=PANTS)                      # pernas
    d.rectangle((11, 25, 13, 30), fill=PANTS)
    d.rectangle((5, 30, 8, 31), fill=SHOES)
    d.rectangle((11, 30, 14, 31), fill=SHOES)
    d.rectangle((5, 14, 14, 25), fill=TEAL1)                     # camisa
    d.line((5, 24, 14, 24), fill=TEAL0)
    d.line((9, 15, 10, 15), fill=YELLOW)                         # crachá
    d.rectangle((3, 15, 4, 22), fill=TEAL1)                      # braço esquerdo
    d.rectangle((3, 23, 4, 24), fill=SKIN)
    if raised_arm:
        d.rectangle((15, 6, 16, 14), fill=TEAL1)                 # braço erguido avisando
        d.rectangle((15, 4, 16, 5), fill=SKIN)
    else:
        d.rectangle((15, 15, 16, 22), fill=TEAL1)
        d.rectangle((15, 23, 16, 24), fill=SKIN)
    d.rectangle((6, 6, 13, 13), fill=SKIN)                       # rosto
    d.point((8, 9), fill=OUTLINE)                                # olhos
    d.point((11, 9), fill=OUTLINE)
    d.line((7, 11, 12, 11), fill=MUSTACHE)                       # bigode
    d.line((8, 12, 11, 12), fill=SKIN_D)
    d.rectangle((5, 3, 14, 6), fill=TEAL0)                       # quepe
    d.rectangle((4, 6, 15, 6), fill=OUTLINE)                     # aba
    d.point((9, 4), fill=YELLOW)                                 # estrela
    d.point((10, 4), fill=YELLOW)
    outline(img)
    return img


def chest(opened):
    """18x16: madeira com cintas douradas; aberto, sai o brilho do especial."""
    img = Image.new('RGBA', (18, 16), T)
    d = ImageDraw.Draw(img)
    d.rectangle((2, 8, 15, 15), fill=WOOD1)
    d.line((2, 12, 15, 12), fill=WOOD0)
    if opened:
        d.rectangle((2, 3, 15, 5), fill=WOOD2)                   # tampa levantada
        d.rectangle((4, 6, 13, 8), fill=GLOW)                    # brilho de dentro
        d.point((8, 1), fill=GLOW)
        d.point((5, 2), fill=GOLD)
        d.point((12, 2), fill=GOLD)
    else:
        d.rectangle((2, 5, 15, 8), fill=WOOD2)                   # tampa fechada
        d.line((2, 8, 15, 8), fill=WOOD0)
    for x in (4, 13):
        d.line((x, 5 if not opened else 8, x, 15), fill=GOLD)   # cintas
    d.rectangle((8, 9, 9, 11), fill=GOLD)                        # fechadura
    outline(img)
    return img


def strip(frames):
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), T)
    for i, frame in enumerate(frames):
        out.alpha_composite(frame, (i * w, 0))
    return out


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    strip([driver(False), driver(True)]).save(os.path.join(OUT, 'motorista.png'))
    strip([chest(False), chest(True)]).save(os.path.join(OUT, 'bau.png'))
    print('ok')
