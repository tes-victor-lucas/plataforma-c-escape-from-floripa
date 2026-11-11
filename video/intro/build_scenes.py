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


ANIM_JS = open(os.path.join(HERE, 'lib', 'anim2d.js')).read()


def anim2d(sc, film_start, cfg):
    """Canvas 2D da cena: desenha pelo tempo do filme (hf-seek) menos o início da cena."""
    import json
    cfg = {'duration': sc.duration, **cfg}
    sc.add(f'<canvas id="{sc.sid}-c" width="1920" height="1080" style="position:absolute;left:0;top:0;width:1920px;'
           f'height:1080px;z-index:1;"></canvas>')
    sc.tl(ANIM_JS)
    sc.tl(f'''const anim = makeAnim2D(document.getElementById("{sc.sid}-c"), {json.dumps(cfg)});
      const draw = (filmTime) => anim.render(Math.min({sc.duration}, Math.max(0, filmTime - {film_start})));
      window.addEventListener("hf-seek", (e) => {{
        draw(e && e.detail && typeof e.detail.time === "number" ? e.detail.time : 0);
      }});
      draw({film_start});''')


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

# 1. Do telhado: o personagem de costas diante da Ponte Hercílio Luz e do Centro, chuva, um drone passando.
s = Scene('s1', 4.0)
anim2d(s, 0.0, {'shot': 'rooftop', 'shake': 2})
s.caption('l0', 0.6, 3.3, 'FLORIANÓPOLIS, 2067')
s.add('<div id="s1-cdl" class="cap" style="left:0;width:1920px;text-align:center;top:70px;font-size:28px;">PARTIDA EM</div>')
countdown(s, 0.0, 4.0, 'left:0;width:1920px;text-align:center;top:108px;font-size:72px;')
SCENES.append((s, 0.0))

# 2. Contra-plongée desenhada: o Centro Cultural visto de baixo, o drone varre a fachada com o holofote.
s = Scene('s2', 3.0)
anim2d(s, 4.0, {'shot': 'facade', 'shake': 2})
s.caption('l0', 0.4, 2.6, 'FLORIA CONTROLA CADA ROTA DO CENTRO', style='right:200px;top:120px;')
SCENES.append((s, 4.0))

# 3. Cartela preta, como no trailer.
s = Scene('s3', 1.8)
s.caption('l0', 0.15, 1.65, 'QUEM SAI DA ROTA', style='left:0;width:1920px;text-align:center;top:430px;', size=72)
s.caption('l1', 0.85, 0.95, '<span class="red">VIRA AMEAÇA</span>', style='left:0;width:1920px;text-align:center;top:540px;', size=72)
SCENES.append((s, 7.0))

# 4. Rua em chamas de lado: a câmera corre com a multidão, carros pegando fogo, explosão.
s = Scene('s4', 4.0)
anim2d(s, 8.8, {'shot': 'riot', 'shake': 4, 'impacts': [2.2]})
SCENES.append((s, 8.8))

# 5. Tiroteio no Terminal Velho: o personagem atira, um robô revida, os dois robôs caem.
s = Scene('s5', 3.0)
anim2d(s, 12.8, {'shot': 'terminal', 'shake': 2, 'impacts': [0.5, 0.9, 1.3, 1.9, 2.3]})
s.flash('hurt', '#e90931', [1.17], 0.14, 0.4)
SCENES.append((s, 12.8))

# 6. Drones mergulham atirando na rua, explosões em volta.
s = Scene('s6', 3.5)
anim2d(s, 15.8, {'shot': 'drones', 'shake': 4, 'impacts': [1.0, 1.9, 2.8]})
SCENES.append((s, 15.8))

# 7. Escondido no bar: o holofote varre a sala e acha o personagem.
s = Scene('s7', 2.0)
anim2d(s, 19.3, {'shot': 'bar', 'shake': 1})
s.flash('found', '#e90931', [1.45], 0.5, 0.5)
SCENES.append((s, 19.3))

# 8. Montagem rápida: drone, corrida, robô, explosão, contagem, corrida.
s = Scene('s8', 2.5)
anim2d(s, 21.3, {'shot': 'montage', 'shake': 10, 'impacts': [1.26]})
countdown(s, 21.3 + 1.68, 0.42, 'left:0;width:1920px;text-align:center;top:380px;font-size:220px;', local_start=1.68)
SCENES.append((s, 21.3))

# 9. Plataforma C: o personagem corre até o 763.2 da Estrela, a porta abre; corte para preto.
s = Scene('s9', 3.0)
anim2d(s, 23.8, {'shot': 'bus', 'shake': 2})
s.caption('l0', 0.5, 2.1, 'O ÚLTIMO 763.2 VIA KOBRASOL', style='left:0;width:1920px;text-align:center;top:120px;')
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
    ('ehit', 'hurt.wav', 13.97, 0.21, 1.0),
    ('eshot0', 'enemy-shot.wav', 13.95, 1.97, 0.7),
    ('kill0', 'explosion_small.wav', 14.4, 0.7, 0.9),
    ('kill1', 'explosion_small.wav', 15.2, 0.7, 0.9),
]
SFX += [(f'pshot{k}', 'player-shot.wav', round(12.8 + t, 2), 1.46, 0.8) for k, t in enumerate([0.5, 0.9, 1.3, 1.9, 2.3])]
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
