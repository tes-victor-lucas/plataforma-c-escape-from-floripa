"""Primeira versão do mapa da Sala V (TICEN) no formato JSON do Tiled.

Gera game/public/assets/maps/room5.json a partir dos tilesets de gen_ticen_assets.py.
Depois de gerado, o mapa é editado no Tiled; rodar de novo sobrescreve essas edições.

uso: python3 assets/ticen/gen_room5_map.py
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets')
W, H = 48, 46

# Ordem igual a ROOM_DEFINITIONS.room5.tilesets: o jogo resolve os tilesets por posição.
TILESETS = ['ticen_piso', 'ticen_fachada', 'ticen_onibus', 'ticen_itens', 'ticen_quiosques', 'ticen_recarga', 'ticen_sujeira',
            # Reaproveitados das Salas I a III, com a paleta cyberpunk do jogo.
            'objects_and_items-01']

# Índices no ticen_piso (8 colunas).
ASPHALT, CONCRETE, BRICKS = (0, 1), (2, 3), 4
EDGE_BOTTOM, EDGE_TOP, LANE_SHADOW = 8, 9, 10

# Plataformas (linha de cima, linha de baixo) e as faixas de ônibus entre elas.
PLATFORMS = {'A': (6, 9), 'B': (15, 18), 'C': (24, 27), 'D': (33, 35)}
LANES = [(10, 14), (19, 23), (28, 32)]
TURNSTILE_ROW = 36
# Única passagem: a catraca com validador, liberada pelo cartão (ver config/ticen.ts).
GATE_COLS = (23, 24)
# Bancos de cubo da pracinha; as pessoas sentadas ficam em config/ticen.ts.
BENCH_ROW = 42
BENCH_COLS = (30, 31, 32, 36, 37, 38)


def load_tilesets():
    result, firstgid = {}, 1
    for name in TILESETS:
        img = Image.open(os.path.join(ROOT, 'tilesets', name + '.png')).convert('RGBA')
        cols, rows = img.width // 16, img.height // 16
        result[name] = {
            'firstgid': firstgid, 'cols': cols, 'img': img,
            'json': {
                'columns': cols, 'firstgid': firstgid, 'image': f'../tilesets/{name}.png',
                'imageheight': img.height, 'imagewidth': img.width, 'margin': 0, 'name': name,
                'spacing': 0, 'tilecount': cols * rows, 'tileheight': 16, 'tilewidth': 16,
            },
        }
        firstgid += cols * rows
    return result


def main():
    ts = load_tilesets()
    layers = {}
    order = []

    def layer(name, collider=False):
        if name not in layers:
            layers[name] = {'data': [0] * (W * H), 'collider': collider}
            order.append(name)
        return layers[name]['data']

    def gid(name, local):
        return ts[name]['firstgid'] + local

    def empty(name, local):
        t = ts[name]
        x, y = (local % t['cols']) * 16, (local // t['cols']) * 16
        return t['img'].crop((x, y, x + 16, y + 16)).getbbox() is None

    def put(name, col, row, value):
        if 0 <= col < W and 0 <= row < H:
            layer(name)[row * W + col] = value

    floor = layer('floor')
    street = layer('street')
    # Sujeira cyberpunk: decalques logo acima do chão, embaixo de tudo o que fica em pé.
    layer('sujeira')
    layer('fachada', collider=True)
    layer('fachada-neon')
    layer('onibus', collider=True)
    layer('itens-base', collider=True)
    layer('catracas', collider=True)
    # Bloqueio invisível na passagem; o jogo remove esta camada quando a catraca libera.
    layer('catraca-fechada', collider=True)
    layer('itens-topo')

    def piso(col, row, local, target='floor'):
        put(target, col, row, gid('ticen_piso', local))

    for row in range(H):
        for col in range(W):
            alt = (col * 7 + row * 3) % 2
            if row <= 5:
                continue
            if any(top <= row <= bottom for top, bottom in PLATFORMS.values()):
                letter = next(k for k, (top, bottom) in PLATFORMS.items() if top <= row <= bottom)
                top, bottom = PLATFORMS[letter]
                local = EDGE_BOTTOM if row == bottom else EDGE_TOP if row == top and letter != 'A' else CONCRETE[alt]
                piso(col, row, local)
            elif any(top <= row <= bottom for top, bottom in LANES):
                top = next(t for t, b in LANES if t <= row <= b)
                piso(col, row, LANE_SHADOW if row == top else ASPHALT[alt], 'street')
            else:
                piso(col, row, BRICKS)

    for fy in range(6):
        for fx in range(48):
            put('fachada', fx, fy, gid('ticen_fachada', fy * 48 + fx))

    def place(sheet, sx, sy, w, h, col, row, top_rows, base='itens-base'):
        """Objeto do tileset: as linhas de cima ficam na frente do jogador, a base colide."""
        cols = ts[sheet]['cols']
        for dy in range(h):
            for dx in range(w):
                local = (sy + dy) * cols + sx + dx
                if not empty(sheet, local):
                    put('itens-topo' if dy < top_rows else base, col + dx, row + dy, gid(sheet, local))

    # Ônibus parados nas baias (7x3); o 763.2 via Kobrasol (Estrela) espera na faixa da Plataforma C.
    for route, col, lane in ((0, 3, 0), (1, 25, 0), (2, 12, 1), (4, 34, 1), (3, 38, 2)):
        place('ticen_onibus', 0, route * 3, 7, 3, col, LANES[lane][0] + 1, 0, base='onibus')

    # Pilares da cobertura (1x3) nas plataformas A, B e C, com as placas das linhas penduradas.
    # Placas no ticen_itens: (coluna, linha, largura) e a coluna onde pendem no mapa.
    signs = {
        'A': [((1, 0, 3), 11)],
        'B': [((4, 0, 3), 11), ((1, 1, 3), 29)],
        'C': [((4, 1, 4), 39)],
    }
    for letter in 'ABC':
        bottom = PLATFORMS[letter][1]
        for col in (8, 20, 32, 44):
            place('ticen_itens', 0, 0, 1, 3, col, bottom - 3, 2)
        for (sx, sy, w), col in signs[letter]:
            place('ticen_itens', sx, sy, w, 1, col, bottom - 3, 1)
    # Totens com a letra de cada plataforma, na ponta esquerda.
    for i, letter in enumerate('ABCD'):
        top, bottom = PLATFORMS[letter]
        place('ticen_itens', i * 2, 3, 2, 2, 1, bottom - 2, 1)
    # Bancos nas plataformas.
    for letter, cols in (('A', (13, 27)), ('B', (14, 26, 38)), ('C', (11, 25)), ('D', (16, 30))):
        bottom = PLATFORMS[letter][1]
        for col in cols:
            place('ticen_itens', 0, 5, 2, 1, col, bottom - 1, 0)
    # Catracas da Av. Paulo Fontes, todas fechadas; a do meio é a que o cartão libera.
    blank_tile = next(local for local in range(ts['ticen_itens']['cols'] * 7) if empty('ticen_itens', local))
    for col in range(W):
        if col in GATE_COLS:
            put('catraca-fechada', col, TURNSTILE_ROW, gid('ticen_itens', blank_tile))
            continue
        place('ticen_itens', 2 if col % 6 == 3 else 3, 5, 1, 1, col, TURNSTILE_ROW, 0, base='catracas')
    # Quiosques das plataformas (4x4): café colonial na B e sucos na C; o letreiro fica na frente.
    for sx, col, letter in ((0, 33, 'B'), (4, 13, 'C')):
        place('ticen_quiosques', sx, 0, 4, 4, col, PLATFORMS[letter][1] - 4, 2)
    # Calçada da Paulo Fontes antes das catracas: posto de recarga do cartão à esquerda
    # e a pracinha de espera com pérgola e bancos de concreto à direita.
    place('ticen_recarga', 0, 0, 13, 4, 2, 37, 0)
    for col in (17, 44):
        place('ticen_itens', 8, 0, 2, 3, col, 37, 2)
    for col in (29, 35, 41):
        place('ticen_recarga', 0, 4, 1, 3, col, 40, 2)
    for col in range(29, 42):
        place('ticen_recarga', 1, 4, 1, 1, col, 40, 1)
    for col in BENCH_COLS:
        place('ticen_recarga', 2, 4, 1, 1, col, BENCH_ROW, 0)
    place('ticen_recarga', 3, 4, 1, 1, 42, BENCH_ROW, 0)

    # ---------------------------------------------------------- elementos das salas anteriores
    obj = 'objects_and_items-01'
    # carrinho de comida vermelho e azul-petróleo e um hidrante na calçada
    place(obj, 2, 2, 2, 2, 26, 41, 1)
    place(obj, 6, 9, 1, 1, 20, 44, 0)
    # postes de neon: vermelhos nas plataformas e na calçada, um ciano com o topo quebrado
    for col, row in ((4, 33), (40, 33), (26, 43), (46, 43), (6, 24)):
        place(obj, 7, 8, 1, 2, col, row, 1)
    place(obj, 8, 7, 1, 3, 46, 6, 2)
    # lixeiras azul-petróleo nas plataformas
    for col, row in ((10, 17), (42, 26), (26, 34), (17, 8)):
        place(obj, 4, 9, 1, 1, col, row, 0)
    # árvores vermelhas e floreira nos cantos da calçada
    place(obj, 0, 6, 1, 2, 1, 43, 1)
    place(obj, 1, 6, 1, 2, 22, 43, 1)
    place(obj, 0, 8, 1, 1, 0, 45, 0)

    # ---------------------------------------------------------- sujeira cyberpunk
    rng = random.Random(2067)
    dirt = lambda local: gid('ticen_sujeira', local)  # noqa: E731
    floor_decals = (0, 1, 2, 5, 6, 14)
    for row in range(6, H):
        for col in range(W):
            index = row * W + col
            roll = rng.random()
            if street[index]:
                if roll < 0.04:
                    put('sujeira', col, row, dirt(2))
                elif roll < 0.07:
                    put('sujeira', col, row, dirt(rng.choice((3, 4))))
                elif roll < 0.10:
                    put('sujeira', col, row, dirt(rng.choice((0, 1))))
            elif floor[index] and row != TURNSTILE_ROW:
                if roll < 0.07:
                    put('sujeira', col, row, dirt(rng.choice(floor_decals)))
                elif roll < 0.085:
                    put('sujeira', col, row, dirt(rng.choice((3, 4))))
    # respiros soltando vapor nas plataformas e na calçada
    for col, row in ((6, 8), (27, 17), (45, 26), (11, 43), (40, 44)):
        put('sujeira', col, row, dirt(7))
    # fachada: pichações nas lojas, cartazes da Floria e o letreiro sobre a faixa azul
    for col in rng.sample(range(1, 47), 9):
        put('fachada-neon', col, rng.choice((3, 4)), dirt(rng.choice((8, 9, 13))))
    for col in (5, 17, 29, 41):
        put('fachada-neon', col, 2, dirt(rng.choice((10, 11))))
    for col in (11, 35):
        put('fachada-neon', col, 5, dirt(15))
    for dx in range(4):
        put('fachada-neon', 16 + dx, 1, dirt(2 * 8 + 2 + dx))
    # telão holográfico da Floria vigiando a Plataforma A
    for dy in range(2):
        for dx in range(2):
            put('fachada-neon', 36 + dx, 6 + dy, dirt((2 + dy) * 8 + dx))
    # seta de neon apontando a catraca
    put('fachada-neon', 21, 41, dirt(12))

    out = {
        'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
        'nextlayerid': len(order) + 1, 'nextobjectid': 1, 'orientation': 'orthogonal',
        'renderorder': 'right-down', 'tiledversion': '1.10.2', 'tileheight': 16, 'tilewidth': 16,
        'type': 'map', 'version': '1.10',
        'tilesets': [ts[name]['json'] for name in TILESETS],
        'layers': [
            {
                'data': layers[name]['data'], 'height': H, 'id': i + 1, 'name': name, 'opacity': 1,
                'type': 'tilelayer', 'visible': True, 'width': W, 'x': 0, 'y': 0,
                **({'properties': [{'name': 'collider', 'type': 'bool', 'value': True}]} if layers[name]['collider'] else {}),
            }
            for i, name in enumerate(order)
        ],
    }
    path = os.path.join(ROOT, 'maps', 'room5.json')
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(path)


if __name__ == '__main__':
    main()
