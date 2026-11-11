"""Leva os assets do TICEN para a paleta noturna das Salas I e II (floor_and_buildings-01 e cia).

Mantém o desenho e troca só as cores: neutros escurecem para os azuis-marinho dos pisos,
vermelhos e laranjas viram os vermelhos e o dourado, azuis e verdes viram o azul-petróleo.
"""
import colorsys

from PIL import Image


def _rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


NEUTRAL = [_rgb(c) for c in ('#12151c', '#191d26', '#1b222c', '#2c363f', '#333d46', '#4d4d4d', '#999999', '#d7ded4')]
REDS = [_rgb(c) for c in ('#531516', '#661b1c', '#9b0016', '#bf0404')]
# Bordôs do piso da Sala II: o vermelho apagado (tijolo) só usa estes, sem saltar para o vermelho vivo.
MUTED_REDS = REDS[:2]
GOLD = _rgb('#f0be68')
TEALS = [_rgb(c) for c in ('#003036', '#016672', '#037f8c', '#47c1ce', '#8cd9b7')]


def _lum(rgb):
    r, g, b = (v / 255 for v in rgb)
    return 0.299 * r + 0.587 * g + 0.114 * b


def _closest_by_lum(ramp, target):
    return min(ramp, key=lambda c: abs(_lum(c) - target))


def to_room_color(rgb):
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in rgb))
    lum = _lum(rgb)
    hue = h * 360
    if s < 0.18 or l < 0.06:
        # Noite: o concreto claro vira o cinza-azulado dos pisos; o branco forte continua legível.
        target = 0.05 + 0.4 * lum ** 1.8 + 0.4 * max(0.0, lum - 0.85) / 0.15
        return _closest_by_lum(NEUTRAL, target)
    # Vermelho vivo (neon, quiosque) segue vivo; vermelho apagado (tijolo) vira bordô.
    reds = REDS if s > 0.6 else MUTED_REDS
    if 25 <= hue < 70:
        return GOLD if lum > 0.55 else _closest_by_lum(reds, lum * 0.75)
    if hue < 25 or hue >= 290:
        return _closest_by_lum(reds, lum * 0.75)
    return _closest_by_lum(TEALS, lum * 0.85)


def to_room_palette(img):
    img = img.convert('RGBA')
    px = img.load()
    cache = {}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = to_room_color(key)
            px[x, y] = cache[key] + (a,)
    return img
