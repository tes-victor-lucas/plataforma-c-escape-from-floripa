"""Interior do Mercado Público: corredor curto que leva ao fliperama.

Gera o tileset mercado_interior.png (512x256) e o mapa mercado-interior.json (32x18 tiles).
Rodar de novo sobrescreve edições feitas no Tiled.

uso: python3 assets/mercado-publico/gen_mercado_interior.py
"""
import json
import os

from gen_mercado_assets import (
    D0, D1, D2, D3, FONT, G0, G1, G2, K0, K1, K2, L0, L1, L2, L3, NC, NP, O0, O1, O2, OL,
    S0, S1, S2, S3, W0, W1, W2, W3, Canvas, arch, box, draw_text, ellipse, text_width,
)

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets')
FONT.setdefault('T', ['111', '010', '010', '010', '010'])

W, H = 32, 18
BACK_ROWS, FLOOR_TOP, FLOOR_BOTTOM, FRONT_TOP = 7, 7, 14, 14
# No tileset: parede do fundo (linhas 0-6), frente (7-10) e peças soltas a partir da linha 11.
CABINET = (0, 11)      # 2x4
FLOOR_TILES = (2, 11)  # 2 ladrilhos lado a lado
DOOR = (4, 11)         # 1x5
# Sujeira cyberpunk no chão: drone caído (2x1), peças de drone, bicicleta elétrica tombada (2x1) e óleo.
DRONE_WRECK = (6, 11)
DRONE_PARTS = (8, 11)
EBIKE = (9, 11)
OIL = (11, 11)
CEILING = (40, 30, 28, 255)
BEAM = (70, 52, 40, 255)
IRON = (60, 62, 72, 255)
TILE_CREAM = (226, 210, 176, 255)
TILE_RED = (196, 132, 104, 255)
TILE_DARK = (124, 106, 100, 255)
CAB = (42, 22, 62, 255)
CAB1 = (70, 40, 100, 255)
METAL0 = (38, 40, 50, 255)
METAL1 = (70, 74, 88, 255)
METAL2 = (120, 126, 142, 255)
LED_RED = (236, 54, 66, 255)
NEON_CYAN = (92, 229, 241, 255)
NEON_PINK = (240, 86, 197, 255)
OIL_DARK = (26, 20, 34, 255)
SPARK = (255, 224, 120, 255)


def back_wall(cv):
    """Parede interna do mercado: forro de madeira, janelas em arco e os boxes das lojas."""
    w = 512
    cv.rect(0, 0, w, 20, CEILING)
    for x in range(0, w, 32):
        cv.rect(x, 0, x + 4, 20, BEAM)
    for x in range(0, w, 64):
        for i in range(16):
            cv.put(x + 32 + i, 4 + i // 2, IRON)
            cv.put(x + 32 - i, 4 + i // 2, IRON)
    cv.rect(0, 20, w, 28, W2)
    cv.rect(0, 20, w, 21, OL)
    cv.rect(0, 27, w, 28, W0)
    cv.rect(0, 28, w, 104, O2)
    signs = ['PEIXE', 'CAFE', 'BAR', 'DOCES']
    for bay, x in enumerate(range(0, w, 64)):
        cv.shape(box(x, 28, x + 4, 104), W2)
        cv.shape(arch(x + 22, 32, 20, 28), lambda px, py: G1 if px - py < 0 else G0)
        cv.rect(x + 31, 46, x + 33, 60, W1)
        # box da loja: metade com a porta de enrolar baixada, metade aberta e iluminada
        sx0, sx1 = x + 10, x + 54
        if bay % 2 == 0:
            cv.shape(box(sx0, 70, sx1, 104), lambda px, py: D1 if py % 3 else D2)
        else:
            cv.shape(box(sx0, 70, sx1, 104), lambda px, py: L2 if py < 84 else L1)
            for shelf in (80, 92):
                cv.rect(sx0 + 2, shelf, sx1 - 2, shelf + 1, L0)
                for k in range(sx0 + 4, sx1 - 4, 5):
                    cv.rect(k, shelf - 4, k + 3, shelf, (G2, NP, L3, D3)[(k // 5) % 4])
        word = signs[bay % len(signs)]
        tw = text_width(word)
        cv.shape(box(x + 32 - tw // 2 - 3, 62, x + 32 + tw // 2 + 4, 70), (24, 18, 30, 255))
        draw_text(cv, x + 32 - tw // 2, 63, word, NC if bay % 2 else NP)
    # rodapé de pedra
    cv.rect(0, 104, w, 112, S2)
    cv.rect(0, 104, w, 105, OL)
    for x in range(0, w, 16):
        cv.rect(x, 105, x + 1, 112, S1)


def front_wall(cv, oy):
    """Balcões dos boxes do outro lado do corredor, vistos de trás."""
    w = 512
    cv.rect(0, oy, w, oy + 6, W2)
    cv.rect(0, oy, w, oy + 1, OL)
    cv.rect(0, oy + 5, w, oy + 6, W0)
    for y in range(oy + 6, oy + 44):
        for x in range(w):
            cv.put(x, y, K2 if (y - oy) % 6 else K1)
    for x in range(0, w, 64):
        cv.shape(box(x, oy + 6, x + 4, oy + 44), K0)
        cv.shape(box(x + 26, oy + 16, x + 38, oy + 24), W3)
    cv.rect(0, oy + 44, w, oy + 64, S0)
    cv.rect(0, oy + 44, w, oy + 45, OL)


def floor_tile(cv, ox, oy, variant):
    """Ladrilho hidráulico: quartos de círculo nos cantos e losango no meio."""
    cv.rect(ox, oy, ox + 16, oy + 16, TILE_CREAM)
    accent = TILE_RED if variant == 0 else TILE_DARK
    for cx, cy in ((0, 0), (16, 0), (0, 16), (16, 16)):
        for y in range(16):
            for x in range(16):
                if (x - cx) ** 2 + (y - cy) ** 2 <= 30:
                    cv.put(ox + x, oy + y, accent)
    for y in range(16):
        for x in range(16):
            if abs(x - 7.5) + abs(y - 7.5) <= 3.5:
                cv.put(ox + x, oy + y, TILE_DARK if variant == 0 else TILE_RED)
    cv.rect(ox, oy + 15, ox + 16, oy + 16, (196, 180, 150, 255))
    cv.rect(ox + 15, oy, ox + 16, oy + 16, (196, 180, 150, 255))


def door(cv, ox, oy):
    """Porta de volta para a rua: luz quente do Largo entrando pelo vão."""
    cv.rect(ox, oy, ox + 16, oy + 80, W2)
    cv.shape(box(ox + 3, oy + 4, ox + 16, oy + 80), lambda x, y: L3 if x < ox + 9 else L2)
    cv.rect(ox, oy, ox + 1, oy + 80, OL)


def cabinet(cv, ox, oy):
    """Fliperama de 2x4 tiles, com tela acesa e letreiro."""
    cv.shape(box(ox + 3, oy + 2, ox + 29, oy + 64), lambda x, y: CAB1 if x < ox + 6 or x > ox + 25 else CAB)
    # letreiro
    cv.shape(box(ox + 4, oy + 3, ox + 28, oy + 13), (20, 12, 30, 255))
    label = 'FLIPER'
    draw_text(cv, ox + 16 - text_width(label) // 2, oy + 6, label, NP)
    # tela com blocos caindo
    cv.shape(box(ox + 6, oy + 16, ox + 26, oy + 34), (10, 40, 50, 255))
    for i, (bx, by, color) in enumerate(((9, 28, NC), (13, 28, NP), (17, 28, L3), (17, 24, NC), (13, 20, D3))):
        cv.rect(ox + bx, oy + by, ox + bx + 4, oy + by + 4, color)
    cv.rect(ox + 6, oy + 16, ox + 26, oy + 17, NC)
    # painel de controle
    cv.shape(box(ox + 2, oy + 36, ox + 30, oy + 42), (90, 60, 120, 255))
    cv.shape(ellipse(ox + 10, oy + 37, 2, 2), (214, 40, 50, 255))
    cv.rect(ox + 10, oy + 38, ox + 11, oy + 41, OL)
    for bx in (18, 22):
        cv.shape(ellipse(ox + bx, oy + 39, 1.5, 1.5), NC)
    # moedeiro e base
    cv.shape(box(ox + 13, oy + 48, ox + 19, oy + 54), S2)
    cv.rect(ox + 15, oy + 50, ox + 17, oy + 52, OL)
    cv.rect(ox + 3, oy + 62, ox + 29, oy + 64, OL)


def oil(cv, cx, cy, rx, ry):
    """Poça de óleo com reflexo de neon."""
    cv.shape(ellipse(cx, cy, rx, ry), OIL_DARK, outline=None)
    cv.rect(cx - rx // 2, cy - 1, cx, cy, NEON_PINK)
    cv.rect(cx + 1, cy + 1, cx + rx // 2, cy + 2, NEON_CYAN)


def drone_wreck(cv, ox, oy):
    """Drone abatido: carcaça rachada, um braço torto, hélice solta e faíscas."""
    oil(cv, ox + 16, oy + 12, 12, 3)
    cv.shape(box(ox + 9, oy + 4, ox + 21, oy + 11), lambda x, y: METAL1 if y < oy + 7 else METAL0)
    cv.rect(ox + 14, oy + 6, ox + 16, oy + 7, LED_RED)
    for i in range(5):  # rachadura
        cv.put(ox + 17 + i // 2, oy + 5 + i, OL)
    cv.rect(ox + 3, oy + 5, ox + 9, oy + 6, METAL2)   # braço inteiro
    cv.rect(ox + 1, oy + 3, ox + 6, oy + 4, METAL0)   # hélice
    for i in range(6):  # braço torto
        cv.put(ox + 21 + i, oy + 9 + i // 2, METAL2)
    cv.rect(ox + 26, oy + 2, ox + 31, oy + 3, METAL0)  # hélice solta
    for x, y in ((ox + 23, oy + 4), (ox + 25, oy + 6), (ox + 7, oy + 10)):
        cv.put(x, y, SPARK)


def drone_parts(cv, ox, oy):
    """Peças soltas: hélice partida, parafusos e um LED ainda aceso."""
    cv.rect(ox + 2, oy + 4, ox + 9, oy + 5, METAL0)
    cv.rect(ox + 5, oy + 3, ox + 6, oy + 6, METAL2)
    for x, y in ((ox + 11, oy + 3), (ox + 4, oy + 11), (ox + 13, oy + 9), (ox + 9, oy + 13)):
        cv.rect(x, y, x + 1, y + 1, METAL2)
    cv.shape(box(ox + 9, oy + 8, ox + 12, oy + 10), METAL1)
    cv.put(ox + 10, oy + 9, NEON_CYAN)


def ebike(cv, ox, oy):
    """Bicicleta elétrica tombada no chão, com a bateria vazando luz."""
    for cx in (ox + 7, ox + 25):
        cv.shape(ellipse(cx, oy + 9, 5, 5), (24, 24, 28, 255))
        cv.shape(ellipse(cx, oy + 9, 3, 3), OIL_DARK, outline=None)
        cv.put(cx, oy + 9, METAL2)
    for i in range(14):  # quadro
        cv.put(ox + 9 + i, oy + 6 + i // 5, NEON_PINK)
        cv.put(ox + 9 + i, oy + 7 + i // 5, (150, 40, 110, 255))
    cv.shape(box(ox + 13, oy + 8, ox + 19, oy + 11), METAL0)  # bateria
    cv.rect(ox + 14, oy + 9, ox + 16, oy + 10, (90, 255, 140, 255))
    cv.rect(ox + 22, oy + 2, ox + 24, oy + 6, METAL1)  # guidão
    cv.rect(ox + 20, oy + 2, ox + 27, oy + 3, METAL2)
    cv.rect(ox + 8, oy + 3, ox + 12, oy + 4, OL)  # selim
    cv.put(ox + 17, oy + 13, SPARK)


def build_tileset():
    cv = Canvas(512, 256)
    back_wall(cv)
    front_wall(cv, BACK_ROWS * 16)
    cabinet(cv, CABINET[0] * 16, CABINET[1] * 16)
    floor_tile(cv, FLOOR_TILES[0] * 16, FLOOR_TILES[1] * 16, 0)
    floor_tile(cv, (FLOOR_TILES[0] + 1) * 16, FLOOR_TILES[1] * 16, 1)
    door(cv, DOOR[0] * 16, DOOR[1] * 16)
    drone_wreck(cv, DRONE_WRECK[0] * 16, DRONE_WRECK[1] * 16)
    drone_parts(cv, DRONE_PARTS[0] * 16, DRONE_PARTS[1] * 16)
    ebike(cv, EBIKE[0] * 16, EBIKE[1] * 16)
    oil(cv, OIL[0] * 16 + 8, OIL[1] * 16 + 9, 6, 3)
    return cv.img


def build_map(img):
    sets = [('mercado_interior', 512, 256), ('mercado_itens', 160, 96)]
    firstgid, tilesets, first = 1, [], {}
    for name, iw, ih in sets:
        cols = iw // 16
        first[name] = (firstgid, cols)
        tilesets.append({
            'columns': cols, 'firstgid': firstgid, 'image': f'../tilesets/{name}.png', 'imageheight': ih,
            'imagewidth': iw, 'margin': 0, 'name': name, 'spacing': 0, 'tilecount': cols * (ih // 16),
            'tileheight': 16, 'tilewidth': 16,
        })
        firstgid += cols * (ih // 16)

    def gid(name, col, row):
        start, cols = first[name]
        return start + row * cols + col

    def empty(col, row):
        return img.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16)).getbbox() is None

    layers = {name: [0] * (W * H) for name in ('floor', 'sujeira', 'parede', 'frente', 'porta', 'itens-base', 'fliperama')}

    def put(layer, col, row, value):
        layers[layer][row * W + col] = value

    for row in range(BACK_ROWS):
        for col in range(W):
            put('parede', col, row, gid('mercado_interior', col, row))
    for row in range(FRONT_TOP, H):
        for col in range(W):
            if not empty(col, BACK_ROWS + row - FRONT_TOP):
                put('frente', col, row, gid('mercado_interior', col, BACK_ROWS + row - FRONT_TOP))
    for row in range(FLOOR_TOP, FLOOR_BOTTOM):
        for col in range(W):
            put('floor', col, row, gid('mercado_interior', FLOOR_TILES[0] + (col + row) % 2, FLOOR_TILES[1]))
    for i in range(5):
        put('porta', 0, 8 + i, gid('mercado_interior', DOOR[0], DOOR[1] + i))
    # Fliperama no fim do corredor, encostado na parede: ~3 s andando desde a porta.
    for dy in range(4):
        for dx in range(2):
            put('fliperama', 26 + dx, 4 + dy, gid('mercado_interior', CABINET[0] + dx, CABINET[1] + dy))
    for (sx, sy), (col, row) in (
        ((6, 0), (7, 7)), ((8, 0), (8, 7)), ((6, 1), (14, 13)), ((8, 0), (19, 7)), ((6, 0), (21, 13)),
    ):
        put('itens-base', col, row, gid('mercado_itens', sx, sy))

    # Destroços nas bordas do corredor, sem colisão: não fecham o caminho até o fliperama.
    for (sx, width), (col, row) in (
        ((DRONE_WRECK, 2), (3, 13)), ((EBIKE, 2), (10, 7)), ((DRONE_PARTS, 1), (16, 8)), ((OIL, 1), (17, 13)),
        ((EBIKE, 2), (23, 13)), ((DRONE_WRECK, 2), (29, 8)), ((DRONE_PARTS, 1), (12, 12)), ((OIL, 1), (5, 8)),
        ((DRONE_PARTS, 1), (24, 7)),
    ):
        for dx in range(width):
            put('sujeira', col + dx, row, gid('mercado_interior', sx[0] + dx, sx[1]))

    collider = {'parede', 'frente', 'itens-base', 'fliperama'}
    order = ['floor', 'sujeira', 'porta', 'parede', 'frente', 'itens-base', 'fliperama']
    return {
        'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
        'nextlayerid': len(order) + 1, 'nextobjectid': 1, 'orientation': 'orthogonal',
        'renderorder': 'right-down', 'tiledversion': '1.10.2', 'tileheight': 16, 'tilewidth': 16,
        'type': 'map', 'version': '1.10', 'tilesets': tilesets,
        'layers': [
            {
                'data': layers[name], 'height': H, 'id': i + 1, 'name': name, 'opacity': 1, 'type': 'tilelayer',
                'visible': True, 'width': W, 'x': 0, 'y': 0,
                **({'properties': [{'name': 'collider', 'type': 'bool', 'value': True}]} if name in collider else {}),
            }
            for i, name in enumerate(order)
        ],
    }


if __name__ == '__main__':
    img = build_tileset()
    img.save(os.path.join(ROOT, 'tilesets', 'mercado_interior.png'))
    with open(os.path.join(ROOT, 'maps', 'mercado-interior.json'), 'w') as f:
        json.dump(build_map(img), f, separators=(',', ':'))
    print('ok')
