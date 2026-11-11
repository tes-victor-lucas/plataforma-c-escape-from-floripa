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


def mode7(sc, room, run, scale=5, tilt=66):
    """O mapa da sala como chão em perspectiva; o chão desliza para a câmera (correndo pelo mapa)."""
    w, h = 672, 576
    pw, ph = w * scale, h * scale
    sc.add(f'<div id="{sc.sid}-stage" class="stage"><div id="{sc.sid}-plane" class="plane" '
           f'style="left:{(W - pw) / 2}px;top:{H + 160 - ph}px;width:{pw}px;height:{ph}px;">'
           f'<img id="{sc.sid}-floor" src="assets/rooms/{room}.png" alt=""></div></div>')
    sc.tl(f'tl.set("#{sc.sid}-plane", {{ rotationX: {tilt} }}, 0);')
    sc.tl(f'tl.fromTo("#{sc.sid}-floor", {{ y: 0 }}, {{ y: {run}, duration: {sc.duration}, ease: "none" }}, 0);')


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


def countdown(sc, start_film, duration, style, local_start=0.0):
    """Uma etiqueta por segundo, 300 s menos o tempo do filme; local_start é onde ela começa dentro da cena."""
    t = 0.0
    while t < duration - 1e-6:
        film = start_film + t
        left = 300 - int(film)
        nxt = min(duration, (int(film) + 1) - start_film)
        sc.add(f'<div id="{sc.sid}-cd-{int(film)}" class="clip cap red" data-start="{local_start + t:.3f}" '
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
SCENES.append((s, 0.0))

# 2. Contra-plongée: o Centro Cultural visto de baixo, o drone passa com o holofote.
s = Scene('s2', 3.0)
s.add('<div id="s2-tilt" class="full" style="perspective:900px;perspective-origin:50% 100%;">'
      '<div id="s2-facade" class="full" style="transform-origin:50% 100%;">'
      f'<img class="art" src="{ART}centro-cultural-marinha-facade.png" alt="" '
      'style="left:-40px;top:-140px;width:2000px;height:1333px;"></div></div>')
# Noite sobre a fachada diurna: o drone caça no escuro.
s.add('<div id="s2-night" class="full" style="background:#061230;opacity:0.62;mix-blend-mode:multiply;z-index:5;"></div>')
s.tl('tl.fromTo("#s2-facade", { rotationX: -16, scale: 1.05 }, { rotationX: -24, scale: 1.12, duration: 3, ease: "power1.inOut" }, 0);')
s.add('<div id="s2-beam" style="position:absolute;left:0;top:0;width:420px;height:900px;z-index:6;'
      'background:rgba(150,235,255,0.20);clip-path:polygon(45% 0, 55% 0, 100% 100%, 0 100%);"></div>')
s.sprite('drone', SPR + 'drone.png', 32, 7, 0, 60, z=7, origin='50% 50%')
s.tl('tl.fromTo("#s2-drone", { x: 1700 }, { x: 260, duration: 3, ease: "none" }, 0);')
s.tl('tl.fromTo("#s2-beam", { x: 1610 }, { x: 170, duration: 3, ease: "none" }, 0);')
s.sprite('hero', SPR + 'player-back-dark.png', 38, 17, 60, 430, z=8)
s.caption('l0', 0.4, 2.6, 'FLORIA CONTROLA CADA ROTA DO CENTRO', style='right:200px;top:120px;')
SCENES.append((s, 4.0))

# 3. Cartela preta, como no trailer.
s = Scene('s3', 1.8)
s.caption('l0', 0.15, 1.65, 'QUEM SAI DA ROTA', style='left:0;width:1920px;text-align:center;top:430px;', size=72)
s.caption('l1', 0.85, 0.95, '<span class="red">VIRA AMEAÇA</span>', style='left:0;width:1920px;text-align:center;top:540px;', size=72)
SCENES.append((s, 7.0))

# 4. Mode 7 na Sala I: correndo no meio da multidão que foge, rua em chamas, explosão à frente.
s = Scene('s4', 4.0)
s.add('<div id="s4-shake" class="full">')
mode7(s, 'room1', 1500)
s.add('<div id="s4-glow" class="full" style="background:#ff6a1a;opacity:0.10;mix-blend-mode:screen;z-index:2;"></div>')
for i, (x, y, sc_) in enumerate([(690, 400, 9), (1180, 420, 8), (930, 360, 6)]):
    s.sprite(f'fire{i}', SPR + 'explosion.png', 32, sc_, x, y, z=3)
    s.frames(f'fire{i}', 32, sc_, [(round(k * 0.1, 2), 1 + (k + i) % 2) for k in range(40)])
for i, (x, y, sc_, rise, delay) in enumerate([(430, 640, 8, -330, 0), (1260, 600, 7, -300, 0.2),
                                                 (1520, 700, 9, -360, 0.1), (640, 520, 5, -220, 0.3)]):
    s.sprite(f'run{i}', SPR + 'runner-dark.png', 38, sc_, x, y, z=4)
    s.cycle(f'run{i}', 38, sc_, 0, 4.0, 1, 8, 14 + i)
    s.tl(f'tl.fromTo("#s4-run{i}", {{ y: 0, scale: 1 }}, {{ y: {rise}, scale: 0.55, duration: {4 - delay}, ease: "power1.in" }}, {delay});')
s.sprite('hero', SPR + 'player-up.png', 38, 10, 770, 700, z=6)
s.cycle('hero', 38, 10, 0, 4.0, 1, 8, 15)
burst(s, 'boom', 960, 430, 16, 2.2, z=5)
s.add('</div>')
s.shake('#s4-shake', 0, 2.2, 5, 11)
s.shake('#s4-shake', 2.2, 2.8, 22, 17)
s.shake('#s4-shake', 2.8, 4.0, 5, 19)
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

# 6. Mode 7 na Praça XV: drones mergulham atirando, explosões ao lado.
s = Scene('s6', 3.5)
s.add('<div id="s6-shake" class="full">')
mode7(s, 'room3', 1700)
for i, (x0, x1, t0, scale) in enumerate([(300, 640, 0.0, 4), (1500, 1200, 0.6, 5), (900, 860, 1.4, 6)]):
    s.sprite(f'd{i}', SPR + 'drone.png', 32, scale, x0, 120, z=5, origin='50% 50%')
    s.tl(f'tl.fromTo("#s6-d{i}", {{ x: 0, y: 0, scale: 1 }}, {{ x: {x1 - x0}, y: 260, scale: 2.2, duration: 2.0, ease: "power2.in" }}, {t0});')
    tracer(s, f'tr{i}', x1 + 60, 480, 940, 900, t0 + 0.7, '#e90931')
for i, (x, y, t) in enumerate([(560, 700, 1.0), (1380, 680, 1.9), (760, 620, 2.8)]):
    burst(s, f'b{i}', x, y, 12, t, z=4)
s.sprite('hero', SPR + 'player-up.png', 38, 10, 770, 700, z=6)
s.cycle('hero', 38, 10, 0, 3.5, 1, 8, 15)
s.add('</div>')
for a, b in ((0, 1.0), (1.25, 1.9), (2.15, 2.8), (3.05, 3.5)):
    s.shake('#s6-shake', a, b, 5, int(a * 100) + 23)
for t in (1.0, 1.9, 2.8):
    s.shake('#s6-shake', t, t + 0.25, 18, int(t * 1000))
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
s.caption('l0', 1.4, 4.1, 'PEGUE O 763.2 ANTES DA PARTIDA', style='left:0;width:1920px;text-align:center;top:600px;')
s.add('<div id="s10-cdl" class="cap" style="left:0;width:1920px;text-align:center;top:90px;font-size:34px;">PARTIDA EM</div>')
countdown(s, 26.8, 5.5, 'left:0;width:1920px;text-align:center;top:135px;font-size:96px;')
SCENES.append((s, 26.8))

TOTAL = 32.3

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
