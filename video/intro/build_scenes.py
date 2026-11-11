"""Gera index.html e compositions/*.html do filme "Último ônibus" (versão cinematográfica).

Planos de cinema sobre a arte do jogo: por cima do ombro, contra-plongée, Mode 7 (o mapa da sala vira chão em
perspectiva e a câmera corre atrás do personagem), primeira pessoa com tiros e uma montagem rápida.
Tudo determinístico: quadros de sprite, tremores e fogo saem de tabelas e de uma semente fixa.

uso: python3 gen_assets.py && python3 build_scenes.py
"""
import math
import os

from PIL import Image

W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
SPRITE_SIZES = {}


def sprite_info(src):
    if src not in SPRITE_SIZES:
        SPRITE_SIZES[src] = Image.open(os.path.join(HERE, src)).size
    return SPRITE_SIZES[src]


class Scene:
    def __init__(self, sid, duration):
        self.sid, self.duration = sid, duration
        self.body, self.js = [], []

    def add(self, html):
        self.body.append(html)

    def tl(self, code):
        self.js.append(code)

    # --- sprites recortados de uma tira horizontal -----------------------------------------------------------
    def sprite(self, name, src, fw, scale, left, top, frame=0, z=3, origin='50% 100%'):
        sw, sh = sprite_info(src)
        self.add(f'<div id="{self.sid}-{name}" class="spr" style="left:{left}px;top:{top}px;width:{fw * scale}px;'
                 f'height:{sh * scale}px;z-index:{z};transform-origin:{origin};">'
                 f'<img id="{self.sid}-{name}-s" src="{src}" alt="" style="width:{sw * scale}px;height:{sh * scale}px;"></div>')
        self.tl(f'tl.set("#{self.sid}-{name}-s", {{ x: {-frame * fw * scale} }}, 0);')

    def frames(self, name, fw, scale, schedule):
        """schedule: [(tempo, quadro)]; quadro None esconde o sprite."""
        for t, f in schedule:
            if f is None:
                self.tl(f'tl.set("#{self.sid}-{name}", {{ opacity: 0 }}, {t:.3f});')
            else:
                self.tl(f'tl.set("#{self.sid}-{name}", {{ opacity: 1 }}, {t:.3f}); '
                        f'tl.set("#{self.sid}-{name}-s", {{ x: {-f * fw * scale} }}, {t:.3f});')

    def cycle(self, name, fw, scale, start, end, first, count, fps):
        """Repete os quadros first..first+count-1 entre start e end."""
        t, k, sched = start, 0, []
        while t < end - 1e-6:
            sched.append((round(t, 3), first + k % count))
            t += 1 / fps
            k += 1
        self.frames(name, fw, scale, sched)

    def shake(self, target, start, end, amp, seed):
        s, t = seed, start
        while t < end:
            s = (s * 1103515245 + 12345) % 2147483648
            dx = (s % 1000) / 500 - 1
            s = (s * 1103515245 + 12345) % 2147483648
            dy = (s % 1000) / 500 - 1
            self.tl(f'tl.set("{target}", {{ x: {dx * amp:.1f}, y: {dy * amp:.1f} }}, {t:.3f});')
            t += 1 / 30
        self.tl(f'tl.set("{target}", {{ x: 0, y: 0 }}, {end:.3f});')

    def caption(self, name, start, duration, text, style='right:200px;bottom:150px;', size=52):
        self.add(f'<div id="{self.sid}-{name}" class="clip cap" data-start="{start}" data-duration="{duration}" '
                 f'style="{style}font-size:{size}px;">{text}</div>')

    def flash(self, name, color, times, length=0.12, alpha=0.45):
        self.add(f'<div id="{self.sid}-{name}" class="full" style="background:{color};opacity:0;z-index:15;"></div>')
        for t in times:
            self.tl(f'tl.set("#{self.sid}-{name}", {{ opacity: {alpha} }}, {t:.3f}); '
                    f'tl.set("#{self.sid}-{name}", {{ opacity: 0 }}, {t + length:.3f});')

    def html(self):
        body = '\n      '.join(self.body)
        js = '\n      '.join(self.js)
        return f"""<template>
  <style>{CSS}
  </style>
  <div id="root" data-composition-id="{self.sid}" data-width="1920" data-height="1080">
      {body}
  </div>
  <script>
      const tl = gsap.timeline({{ paused: true }});
      {js}
      window.__timelines["{self.sid}"] = tl;
  </script>
</template>
"""


CSS = """
      #root { position: absolute; inset: 0; overflow: hidden; background: #04050a; font-family: 'PixelGamer', monospace; }
      @font-face { font-family: 'PixelGamer'; src: url('assets/fonts/PixelGamer-Regular.otf'); }
      /* Como no jogo (src/main.ts): na PixelGamer, números e pontuação são desenhos; vêm da Pixeboy. */
      @font-face { font-family: 'PixelGamer'; src: url('assets/fonts/Pixeboy.ttf');
        unicode-range: U+24-26, U+2C, U+2E, U+30-3A; size-adjust: 140%; }
      .full { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
      .art { position: absolute; left: -8px; top: 0; width: 1936px; height: 1080px; image-rendering: pixelated; }
      .spr { position: absolute; overflow: hidden; }
      .spr img { position: absolute; left: 0; top: 0; image-rendering: pixelated; }
      .cap { position: absolute; color: #ffffff; letter-spacing: 3px; text-shadow: 5px 5px 0 #000000; z-index: 12;
        white-space: nowrap; }
      .red { color: #e90931; }
      .stage { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; perspective: 520px;
        perspective-origin: 50% 12%; overflow: hidden; background: #04050a; }
      .plane { position: absolute; overflow: hidden; transform-origin: 50% 100%; }
      .plane img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; image-rendering: pixelated; }"""

SPR = 'assets/sprites/'
ART = 'assets/art/'


def art_shot(sc, name, src, push_from, push_to, origin):
    sc.add(f'<div id="{sc.sid}-{name}" class="full" style="transform-origin:{origin};">'
           f'<img class="art" src="{src}" alt=""></div>')
    sc.tl(f'tl.fromTo("#{sc.sid}-{name}", {{ scale: {push_from} }}, '
          f'{{ scale: {push_to}, duration: {sc.duration}, ease: "none" }}, 0);')


CITY_JS = open(os.path.join(HERE, 'lib', 'city3d.js')).read()


def city3d(sc, film_start, cfg):
    """Canvas 3D da cena: desenha pelo tempo do filme (hf-seek) menos o início da cena."""
    import json
    sc.add(f'<canvas id="{sc.sid}-c" width="480" height="270" style="position:absolute;left:0;top:0;width:1920px;'
           f'height:1080px;image-rendering:pixelated;z-index:1;"></canvas>')
    sc.tl(CITY_JS)
    sc.tl(f'''const street = makeCity3D(document.getElementById("{sc.sid}-c"), {json.dumps(cfg)});
      window.__hf = window.__hf || {{}};
      window.__hf.buildReady = window.__hf.buildReady || {{}};
      window.__hf.buildReady["{sc.sid}"] = street.ready;
      const draw = (filmTime) => street.render(Math.min({sc.duration}, Math.max(0, filmTime - {film_start})));
      window.addEventListener("hf-seek", (e) => {{
        const time = e && e.detail && typeof e.detail.time === "number" ? e.detail.time : 0;
        if (street.render) draw(time);
        else if (e && e.detail && e.detail.waitUntil) e.detail.waitUntil(street.ready.then(() => draw(time)));
      }});
      street.ready.then(() => draw({film_start}));''')


def tracer(sc, name, x0, y0, x1, y1, t, color='#ffd27a'):
    length = math.hypot(x1 - x0, y1 - y0)
    angle = math.degrees(math.atan2(y1 - y0, x1 - x0))
    sc.add(f'<div id="{sc.sid}-{name}" style="position:absolute;left:{x0}px;top:{y0}px;width:{length:.0f}px;height:4px;'
           f'background:{color};opacity:0;transform-origin:0 50%;z-index:9;"></div>')
    sc.tl(f'tl.set("#{sc.sid}-{name}", {{ rotation: {angle:.1f}, opacity: 1 }}, {t:.3f}); '
          f'tl.set("#{sc.sid}-{name}", {{ opacity: 0 }}, {t + 0.06:.3f});')


def burst(sc, name, cx, cy, scale, t, z=8):
    size = 32 * scale
    sc.sprite(name, SPR + 'explosion.png', 32, scale, cx - size / 2, cy - size / 2, z=z)
    sc.frames(name, 32, scale, [(0, None), (t, 0), (t + 0.08, 1), (t + 0.16, 2), (t + 0.26, 3), (t + 0.55, None)])


TOTAL = 32.3
GAME_START = TOTAL - 0.5  # 00:00 fica meio segundo na tela antes do corte para o jogo


def countdown(sc, start_film, duration, style, local_start=0.0):
    """Segundos que faltam para a partida (o jogo) começar; local_start é onde ela começa dentro da cena."""
    t = 0.0
    while t < duration - 1e-6:
        film = start_film + t
        left = max(0, math.ceil(GAME_START - film - 1e-9))
        # Próxima troca: quando o restante cruza o inteiro de baixo (ou o fim da cena).
        boundary = GAME_START - (left - 1) if left > 0 else start_film + duration
        nxt = min(duration, boundary - start_film)
        sc.add(f'<div id="{sc.sid}-cd-{round(film * 100)}" class="clip cap red" data-start="{local_start + t:.3f}" '
               f'data-duration="{nxt - t:.3f}" style="{style}">{left // 60:02d}:{left % 60:02d}</div>')
        t = nxt


SCENES = []

# 1. Por cima do ombro, do alto: a cidade e a ponte ao entardecer (o mapa apresentado).
s = Scene('s1', 4.0)
art_shot(s, 'bg', ART + 'background-bridge.png', 1.0, 1.07, '62% 58%')
s.add('<div id="s1-ledge" class="full" style="top:930px;height:150px;background:#05070c;border-top:6px solid #2a0a12;z-index:4;"></div>')
s.sprite('hero', SPR + 'player-back-dark.png', 38, 15, 170, 470, z=5)
s.tl('tl.fromTo("#s1-hero", { scaleY: 1 }, { scaleY: 1.015, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: 2 }, 0);')
s.caption('l0', 0.6, 3.3, 'FLORIANÓPOLIS, 2067')
s.add('<div id="s1-cdl" class="cap" style="left:0;width:1920px;text-align:center;top:70px;font-size:28px;">PARTIDA EM</div>')
countdown(s, 0.0, 4.0, 'left:0;width:1920px;text-align:center;top:108px;font-size:72px;')
SCENES.append((s, 0.0))

# 2. Contra-plongée: o Centro Cultural modelado em 3D visto de baixo; o drone passa com o holofote.
s = Scene('s2', 3.0)
city3d(s, 4.0, {
    'kind': 'facade', 'seed': 12, 'duration': 3.0, 'fov': 64, 'shake': 0.02,
    'sky': 0x070b18, 'fog': 0x0a1020, 'fogNear': 30, 'fogFar': 90,
    'skyLight': 0x6a7ab0, 'groundLight': 0x1a1418, 'hemi': 1.05, 'hero': True,
    'drones': [{'x0': 9, 'x1': -6, 'y0': 9.5, 'z': 5.5}],
})
s.caption('l0', 0.4, 2.6, 'FLORIA CONTROLA CADA ROTA DO CENTRO', style='right:200px;top:120px;')
SCENES.append((s, 4.0))

# 3. Cartela preta, como no trailer.
s = Scene('s3', 1.8)
s.caption('l0', 0.15, 1.65, 'QUEM SAI DA ROTA', style='left:0;width:1920px;text-align:center;top:430px;', size=72)
s.caption('l1', 0.85, 0.95, '<span class="red">VIRA AMEAÇA</span>', style='left:0;width:1920px;text-align:center;top:540px;', size=72)
SCENES.append((s, 7.0))

# 4. Rua em chamas em 3D: prédios modelados, carros pegando fogo, multidão fugindo em volta da câmera.
s = Scene('s4', 4.0)
city3d(s, 8.8, {
    'kind': 'street', 'seed': 41, 'length': 150, 'speed': 6.2, 'camX': 0.9, 'camY': 2.1, 'lookY': 1.7,
    'bob': 0.1, 'shake': 0.06, 'heroX': 0.0, 'heroAhead': 3.4, 'fov': 62,
    'sky': 0x1a0a06, 'fog': 0x3a1a0a, 'fogNear': 12, 'fogFar': 80,
    'skyLight': 0x9a6a70, 'groundLight': 0x3a2014, 'hemi': 1.1,
    'fires': [{'x': -2.6, 'z': -24, 'size': 3.4}, {'x': 2.8, 'z': -36, 'size': 4.2}, {'x': -0.4, 'z': -54, 'size': 5.2}],
    'cars': [[-2.6, -24, 0x5a6a7a, 0.4], [2.8, -36, 0x7a2a2a, -0.3]],
    'crowd': 24, 'hero': True, 'drones': [], 'tracers': [],
    'booms': [{'t': 2.2, 'x': 0.6, 'ahead': 18, 'shake': 0.9}],
})
SCENES.append((s, 8.8))

# 5. Primeira pessoa no Terminal Velho: guardas avançam, tiros, um acerto, os dois caem.
s = Scene('s5', 3.0)
s.add('<div id="s5-shake" class="full">')
art_shot(s, 'bg', ART + 'background-terminal.png', 1.05, 1.22, '58% 52%')
for name, x, y, dies in [('g0', 700, 470, 1.25), ('g1', 1080, 450, 2.4)]:
    s.sprite(name, SPR + 'guard.png', 32, 7, x, y, z=4)
    walk = [(round(k * 0.15, 2), k % 4) for k in range(int((dies - 0.25) / 0.15))]
    s.frames(name, 32, 7, walk + [(dies - 0.25, 6), (dies, 7)])
    s.tl(f'tl.fromTo("#s5-{name}", {{ scale: 1 }}, {{ scale: 1.5, duration: {dies}, ease: "none" }}, 0);')
    burst(s, f'{name}x', x + 112, y + 150, 9, dies, z=5)
s.sprite('gun', SPR + 'gun.png', 64, 9, 1060, 678, z=7)
s.tl('tl.fromTo("#s5-gun", { y: 0 }, { y: 18, duration: 0.18, ease: "steps(2)", yoyo: true, repeat: 15 }, 0);')
s.sprite('muz', SPR + 'muzzle.png', 24, 6, 1276, 624, z=8)
shots = [0.6, 1.0, 1.4, 2.0, 2.4]
s.frames('muz', 24, 6, [(0, None)] + [x for t in shots for x in ((t, 0), (t + 0.034, 1), (t + 0.07, None))])
for k, t in enumerate(shots):
    tx, ty = (812, 620) if t <= 1.25 else (1192, 600)
    tracer(s, f'tr{k}', 1348, 696, tx, ty, t)
s.add('</div>')
for t in shots:
    s.shake('#s5-shake', t, t + 0.12, 14, int(t * 100))
s.flash('hurt', '#e90931', [1.62], 0.14, 0.42)
SCENES.append((s, 12.8))

# 6. Rua em 3D à noite: drones modelados mergulham atirando, explosões ao lado.
s = Scene('s6', 3.5)
city3d(s, 15.8, {
    'kind': 'street', 'seed': 77, 'length': 150, 'speed': 7.2, 'camX': 0.6, 'camY': 1.5, 'lookY': 3.2,
    'bob': 0.12, 'shake': 0.07, 'heroX': 0.0, 'heroAhead': 3.4, 'fov': 64,
    'sky': 0x05080f, 'fog': 0x0a1424, 'fogNear': 14, 'fogFar': 85,
    'skyLight': 0x7a8aba, 'groundLight': 0x1a1a24, 'hemi': 1.0,
    'fires': [{'x': 2.6, 'z': -46, 'size': 3.6}], 'cars': [[2.6, -46, 0x3a4a5a, 0.2]],
    'crowd': 8, 'hero': True,
    'drones': [{'t0': 0.0, 'dur': 2.0, 'x0': -6, 'x1': -1.6, 'y0': 11, 'y1': 4.2, 'ahead0': 34, 'ahead1': 14},
               {'t0': 0.6, 'dur': 2.0, 'x0': 7, 'x1': 2.0, 'y0': 12, 'y1': 4.6, 'ahead0': 36, 'ahead1': 15},
               {'t0': 1.4, 'dur': 1.8, 'x0': 0, 'x1': 0.4, 'y0': 13, 'y1': 5.0, 'ahead0': 32, 'ahead1': 12}],
    'tracers': [{'t': 0.9, 'x0': -2.6, 'y0': 6.5, 'z0': 22, 'x1': 0.0, 'y1': 0.3, 'z1': 5},
                {'t': 1.5, 'x0': 3.2, 'y0': 7.0, 'z0': 24, 'x1': -0.6, 'y1': 0.3, 'z1': 6},
                {'t': 2.3, 'x0': 0.3, 'y0': 7.0, 'z0': 18, 'x1': 0.8, 'y1': 0.3, 'z1': 5}],
    'booms': [{'t': 1.0, 'x': -3.0, 'ahead': 9, 'shake': 0.6},
              {'t': 1.9, 'x': 3.2, 'ahead': 10, 'shake': 0.6},
              {'t': 2.8, 'x': -0.8, 'ahead': 13, 'shake': 0.7}],
})
SCENES.append((s, 15.8))

# 7. Escondido no bar: o holofote do drone varre a sala e acha o personagem.
s = Scene('s7', 2.0)
art_shot(s, 'bg', ART + 'background-bar.png', 1.0, 1.04, '30% 70%')
s.add('<div id="s7-beam" style="position:absolute;left:0;top:-200px;width:520px;height:1400px;z-index:6;'
      'background:rgba(150,235,255,0.22);clip-path:polygon(40% 0, 60% 0, 100% 100%, 0 100%);"></div>')
s.tl('tl.fromTo("#s7-beam", { x: 1500 }, { x: 40, duration: 1.4, ease: "power1.inOut" }, 0.1);')
s.sprite('hero', SPR + 'player-back-dark.png', 38, 18, 140, 470, z=7)
s.tl('tl.fromTo("#s7-hero", { scaleY: 1 }, { scaleY: 1.025, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 2 }, 0);')
s.flash('found', '#e90931', [1.45], 0.5, 0.5)
SCENES.append((s, 19.3))

# 8. Montagem rápida: drone, corrida de lado, guarda, explosão, contagem, corrida.
s = Scene('s8', 2.5)
cuts = [0, 0.42, 0.84, 1.26, 1.68, 2.1, 2.5]
grounds = ['#070a12', '#05070c', '#2a0610', '#000000', '#000000', '#05070c']
for i in range(6):
    s.add(f'<div id="s8-c{i}" class="clip full" data-start="{cuts[i]}" data-duration="{cuts[i + 1] - cuts[i]:.2f}" '
          f'style="background:{grounds[i]};"></div>')
s.add('<div id="s8-a" class="clip full" data-start="0" data-duration="0.42">')
s.sprite('drone', SPR + 'drone.png', 32, 26, 544, 124, z=3, origin='50% 50%')
s.add('</div><div id="s8-b" class="clip full" data-start="0.42" data-duration="0.42">')
s.add(f'<div id="s8-side" class="full"><img class="art" src="{ART}background-terminal.png" alt=""></div>')
s.tl('tl.fromTo("#s8-side", { x: 0 }, { x: -260, duration: 0.42, ease: "none" }, 0.42);')
s.sprite('runner', SPR + 'player-right.png', 38, 16, 660, 470, z=4)
s.cycle('runner', 38, 16, 0.42, 0.84, 1, 8, 18)
s.add('</div><div id="s8-c" class="clip full" data-start="0.84" data-duration="0.42">')
s.sprite('guard', SPR + 'guard.png', 32, 22, 608, 188, frame=5, z=3)
s.add('</div><div id="s8-d" class="clip full" data-start="1.26" data-duration="0.42">')
burst(s, 'boom', 960, 540, 30, 1.27, z=3)
s.add('</div>')
countdown(s, 21.3 + 1.68, 0.42, 'left:0;width:1920px;text-align:center;top:380px;font-size:220px;', local_start=1.68)
s.add('<div id="s8-f" class="clip full" data-start="2.1" data-duration="0.4">')
s.sprite('legs', SPR + 'player-up.png', 38, 30, 390, 380, z=3)
s.cycle('legs', 38, 30, 2.1, 2.5, 1, 8, 20)
s.add('</div>')
s.shake('#s8-a', 0, 0.42, 16, 31)
s.shake('#s8-d', 1.26, 1.68, 26, 37)
SCENES.append((s, 21.3))

# 9. Dentro do ônibus, devagar: a única saída.
s = Scene('s9', 3.0)
art_shot(s, 'bg', ART + 'background-bus.png', 1.0, 1.1, '74% 46%')
s.caption('l0', 0.5, 2.1, 'O ÚLTIMO 763.2 VIA KOBRASOL', style='left:0;width:1920px;text-align:center;bottom:150px;')
s.add('<div id="s9-black" class="clip full" data-start="2.6" data-duration="0.4" style="background:#000000;z-index:20;"></div>')
SCENES.append((s, 23.8))

# 10. Título: a ponte, o logo e a contagem seguindo.
s = Scene('s10', 5.5)
art_shot(s, 'bg', ART + 'background-bridge.png', 1.0, 1.04, '50% 50%')
s.add(f'<img id="s10-title" src="{ART}title.png" alt="Plataforma C: Escape from Floripa" '
      f'style="position:absolute;left:{(W - 1009 * 1.5) / 2}px;top:300px;width:{1009 * 1.5}px;height:{154 * 1.5}px;'
      'image-rendering:pixelated;z-index:4;">')
s.tl('tl.fromTo("#s10-title", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "steps(12)" }, 0.3);')
s.caption('l0', 1.4, 4.1, 'CHEGUE AO 763.2 NA PLATAFORMA C', style='left:0;width:1920px;text-align:center;top:600px;')
s.add('<div id="s10-cdl" class="cap" style="left:0;width:1920px;text-align:center;top:90px;font-size:34px;">PARTIDA EM</div>')
countdown(s, 26.8, 5.5, 'left:0;width:1920px;text-align:center;top:135px;font-size:96px;')
SCENES.append((s, 26.8))

os.makedirs(os.path.join(HERE, 'compositions'), exist_ok=True)
for name in os.listdir(os.path.join(HERE, 'compositions')):
    os.remove(os.path.join(HERE, 'compositions', name))
for sc, _ in SCENES:
    with open(os.path.join(HERE, 'compositions', f'{sc.sid}.html'), 'w') as f:
        f.write(sc.html())

hosts = '\n'.join(
    f'      <div id="{sc.sid}" data-composition-id="{sc.sid}" data-composition-src="compositions/{sc.sid}.html" '
    f'data-start="{start}" data-duration="{sc.duration}" data-track-index="1" data-track-kind="graphics" '
    f'data-width="1920" data-height="1080"></div>'
    for sc, start in SCENES)

SFX = [  # (id, arquivo, início no filme, duração, volume)
    ('sting1', 'horror-tension.wav', 7.85, 1.6, 1.0),
    ('boom1', 'explosion_small.wav', 11.0, 0.7, 1.0),
    ('sting2', 'horror-tension.wav', 20.75, 1.6, 1.0),
    ('boom5', 'explosion_small.wav', 22.56, 0.7, 1.0),
    ('sting3', 'horror-tension.wav', 26.8, 1.6, 0.9),
    ('ehit', 'hurt.wav', 14.45, 0.21, 1.0),
    ('eshot0', 'enemy-shot.wav', 14.4, 1.97, 0.7),
    ('kill0', 'explosion_small.wav', 14.05, 0.7, 0.9),
    ('kill1', 'explosion_small.wav', 15.2, 0.7, 0.9),
]
SFX += [(f'pshot{k}', 'player-shot.wav', round(12.8 + t, 2), 1.46, 0.8) for k, t in enumerate([0.6, 1.0, 1.4, 2.0, 2.4])]
SFX += [(f'dshot{k}', 'enemy-shot.wav', round(15.8 + t, 2), 1.97, 0.6) for k, t in enumerate([0.7, 1.3, 2.1])]
SFX += [(f'dboom{k}', 'explosion_small.wav', round(15.8 + t, 2), 0.7, 1.0) for k, t in enumerate([1.0, 1.9, 2.8])]
audio = '\n'.join(
    f'      <audio id="{i}" class="clip" src="assets/audio/{f}" data-start="{s_}" data-duration="{d}" '
    f'data-track-index="{3 + n}" data-volume="{v}"></audio>' for n, (i, f, s_, d, v) in enumerate(SFX))

index = f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #04050a; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080">
{hosts}
      <!-- Trilha: baixa até a corrida; o trecho mais forte entra junto com o Mode 7 da Sala I. -->
      <audio id="musicA" class="clip" src="assets/audio/mainmenu-trecho.mp3" data-start="0" data-duration="8.8"
        data-media-start="0.2" data-track-index="2" data-volume="0.3" data-fade-in="1"></audio>
      <audio id="musicB" class="clip" src="assets/audio/mainmenu-trecho.mp3" data-start="8.8" data-duration="{TOTAL - 8.8:.1f}"
        data-media-start="9" data-track-index="2" data-volume="0.95" data-fade-out="1.5"></audio>
{audio}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
with open(os.path.join(HERE, 'index.html'), 'w') as f:
    f.write(index)
print('ok', [sc.sid for sc, _ in SCENES])
