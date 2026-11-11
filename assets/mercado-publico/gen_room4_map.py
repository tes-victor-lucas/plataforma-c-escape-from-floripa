"""Primeira versão do mapa da Sala IV (Mercado Público) no formato JSON do Tiled.

Gera game/public/assets/maps/room4.json a partir dos tilesets de gen_mercado_assets.py.
Depois de gerado, o mapa é editado no Tiled; rodar de novo sobrescreve essas edições.

uso (da raiz do repositório): python3 assets/mercado-publico/gen_room4_map.py
"""
import json
import os
import random

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets')
W, H = 48, 40

# Ordem igual a ROOM_DEFINITIONS.room4.tilesets: o jogo resolve os tilesets por posição.
TILESETS = [
    'mercado_piso',
    'curva-faixa-rua-256',
    'mercado_fachada',
    'mercado_itens',
    'poste_3_globos',
]

FACADE_COL, FACADE_ROWS = 2, 14
SIDEWALK_ROWS = range(14, 18)
STREET_ROW = 18
LARGO_ROW = 23


def load_tilesets():
    result, firstgid = {}, 1
    for name in TILESETS:
        path = os.path.join(ROOT, 'tilesets', name + '.png')
        img = Image.open(path).convert('RGBA')
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


class Layer:
    def __init__(self, name, collider=False):
        self.name, self.collider = name, collider
        self.data = [0] * (W * H)

    def set(self, col, row, gid):
        if 0 <= col < W and 0 <= row < H:
            self.data[row * W + col] = gid


def main():
    ts = load_tilesets()
    rng = random.Random(4)

    def gid(name, local):
        return ts[name]['firstgid'] + local

    def is_empty(name, local):
        t = ts[name]
        x, y = (local % t['cols']) * 16, (local // t['cols']) * 16
        return t['img'].crop((x, y, x + 16, y + 16)).getbbox() is None

    # O céu colide: fecha o topo do mapa nas laterais da fachada.
    sky = Layer('ceu', collider=True)
    floor = Layer('floor')
    street = Layer('street')
    facade = Layer('fachada')
    items_base = Layer('itens-base', collider=True)
    items_top = Layer('itens-topo')
    posts_base = Layer('postes-base', collider=True)
    posts = Layer('postes')

    for row in range(FACADE_ROWS):
        for col in range(W):
            sky.set(col, row, gid('mercado_piso', 6 + rng.randint(0, 1)))
    for row in range(FACADE_ROWS, H):
        for col in range(W):
            if row in SIDEWALK_ROWS or STREET_ROW <= row < LARGO_ROW:
                local = 13 if row == 14 else 4 + rng.randint(0, 1)
                if row == 16 and col in (12, 35):
                    local = 10  # bueiros
            else:
                local = rng.choice((0, 1, 2, 3, 14, 15))
            floor.set(col, row, gid('mercado_piso', local))
    # Mesmo trecho reto de rua usado na Sala III (padrão de 5 colunas da curva-faixa-rua).
    for r in range(5):
        for col in range(W):
            street.set(col, STREET_ROW + r, gid('curva-faixa-rua-256', 42 + col % 5 + 16 * r))
    for fy in range(FACADE_ROWS):
        for fx in range(44):
            local = fy * 44 + fx
            if not is_empty('mercado_fachada', local):
                facade.set(FACADE_COL + fx, fy, gid('mercado_fachada', local))

    def place(name, local_x, local_y, w, h, col, row, top_rows):
        """Coloca um objeto do tileset: as linhas de cima vão para a frente do jogador, a base colide."""
        for dy in range(h):
            for dx in range(w):
                local = (local_y + dy) * ts[name]['cols'] + local_x + dx
                if is_empty(name, local):
                    continue
                target = (items_top if dy < top_rows else items_base) if name == 'mercado_itens' \
                    else (posts if dy < top_rows else posts_base)
                target.set(col + dx, row + dy, gid(name, local))

    # Laterais das bancas 2, 5, 13, 37 e 43 ficam livres: os comerciantes contornam por ali.
    peixe, fruta = (0, 0), (0, 3)
    mesa_teal, mesa_red = (3, 0), (3, 3)
    for (sx, sy), col in ((peixe, 2), (fruta, 5), (peixe, 13), (fruta, 37), (peixe, 40), (fruta, 43)):
        place('mercado_itens', sx, sy, 3, 3, col, 25, 2)
    for i, (col, row) in enumerate(((13, 29), (17, 29), (27, 29), (30, 29), (13, 34), (18, 34), (27, 34), (31, 34))):
        sx, sy = mesa_teal if i % 2 == 0 else mesa_red
        place('mercado_itens', sx, sy, 3, 3, col, row, 2)
    for (sx, sy, h), (col, row) in (
        ((6, 0, 1), (3, 29)), ((6, 1, 1), (16, 27)), ((7, 0, 2), (47, 28)),
        ((8, 0, 1), (34, 29)), ((8, 0, 1), (6, 37)), ((7, 0, 2), (43, 36)), ((6, 0, 1), (44, 30)),
    ):
        place('mercado_itens', sx, sy, 1, h, col, row, 0)
    for col, row in ((6, 13), (16, 13), (30, 13), (40, 13), (1, 31), (45, 31)):
        place('poste_3_globos', 0, 0, 2, 4, col, row, 3)

    layers = [sky, floor, street, facade, items_base, items_top, posts_base, posts]
    out = {
        'compressionlevel': -1, 'height': H, 'width': W, 'infinite': False,
        'nextlayerid': len(layers) + 1, 'nextobjectid': 1, 'orientation': 'orthogonal',
        'renderorder': 'right-down', 'tiledversion': '1.10.2', 'tileheight': 16, 'tilewidth': 16,
        'type': 'map', 'version': '1.10',
        'tilesets': [ts[name]['json'] for name in TILESETS],
        'layers': [
            {
                'data': layer.data, 'height': H, 'id': index + 1, 'name': layer.name, 'opacity': 1,
                'type': 'tilelayer', 'visible': True, 'width': W, 'x': 0, 'y': 0,
                **({'properties': [{'name': 'collider', 'type': 'bool', 'value': True}]} if layer.collider else {}),
            }
            for index, layer in enumerate(layers)
        ],
    }
    path = os.path.join(ROOT, 'maps', 'room4.json')
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    print(path)


if __name__ == '__main__':
    main()
