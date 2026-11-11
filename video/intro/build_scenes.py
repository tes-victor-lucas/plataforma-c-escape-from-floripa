"""Gera index.html e compositions/*.html do filme "Último ônibus" a partir de uma tabela de tomadas.

Os enquadramentos são calculados aqui (a imagem sempre cobre o quadro); depois de gerado, o projeto pode ser
editado no HyperFrames normalmente. Rodar de novo sobrescreve os arquivos.

uso: python3 build_scenes.py
"""
import os

W, H = 1920, 1080
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))

ROOMS = {
    'room1': (672, 576), 'room2': (672, 576), 'room3': (672, 576),
    'room4': (768, 640), 'room5': (768, 736),
}


def cam(room, scale, fx, fy):
    """Posição da imagem para centrar (fx, fy), presa para nunca mostrar fora dela."""
    w, h = ROOMS[room]
    x = min(0, max(W - w * scale, W / 2 - fx * scale))
    y = min(0, max(H - h * scale, H / 2 - fy * scale))
    return round(x, 1), round(y, 1)


def countdown(prefix, scene_start, duration):
    """Uma etiqueta por segundo: 300 s menos o tempo do filme, contínua entre as cenas."""
    out = []
    t = 0.0
    while t < duration - 1e-6:
        film = scene_start + t
        left = 300 - int(film)
        nxt = min(duration, (int(film) + 1) - scene_start)
        out.append(
            f'<span id="{prefix}-cd-{int(film)}" class="clip cd-digits" data-start="{round(t, 3)}" '
            f'data-duration="{round(nxt - t, 3)}">{left // 60:02d}:{left % 60:02d}</span>'
        )
        t = nxt
    return '\n      '.join(out)


DISSOLVE_JS = """
      // Dissolução em blocos de 120 px, ordem fixa por semente (o filme renderiza igual sempre).
      function dissolve(tl, id, start, appear, seed) {
        const box = document.getElementById(id);
        const blocks = [];
        for (let i = 0; i < 144; i++) {
          const b = document.createElement('div');
          b.className = 'blk';
          b.style.left = (i % 16) * 120 + 'px';
          b.style.top = Math.floor(i / 16) * 120 + 'px';
          box.appendChild(b);
          blocks.push(b);
        }
        let s = seed;
        const order = blocks.map((b, i) => { s = (s * 1103515245 + 12345) % 2147483648; return [s, b]; })
          .sort((a, b) => a[0] - b[0]).map(([, b]) => b);
        order.forEach((b, i) => {
          tl.set(b, { opacity: appear ? 0 : 1 }, 0);
          tl.set(b, { opacity: appear ? 1 : 0 }, start + Math.floor(i / 12) * (0.4 / 12));
        });
      }"""

BASE_CSS = """
      #root { position: absolute; inset: 0; overflow: hidden; background: #01141a; font-family: 'PixelGamer', monospace; }
      @font-face { font-family: 'PixelGamer'; src: url('assets/fonts/PixelGamer-Regular.otf'); }
      /* Como no jogo (src/main.ts): na PixelGamer, números e pontuação são desenhos; vêm da Pixeboy. */
      @font-face { font-family: 'PixelGamer'; src: url('assets/fonts/Pixeboy.ttf');
        unicode-range: U+24-26, U+2C, U+2E, U+30-3A; size-adjust: 140%; }
      .cam { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
      .cam img { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
      .line { position: absolute; left: 200px; bottom: 140px; z-index: 5; }
      .line span.box { display: inline-block; background: rgba(0, 0, 0, 0.88); color: #ffffff; font-size: 56px;
        padding: 22px 30px 16px; letter-spacing: 2px; white-space: nowrap; }
      .red { color: #e90931; }
      .dissolve { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
      .blk { position: absolute; width: 120px; height: 120px; background: #01141a; opacity: 0; }
      .cd { position: absolute; left: 200px; top: 120px; z-index: 6; background: rgba(0, 0, 0, 0.88);
        padding: 20px 30px 12px; color: #ffffff; }
      .cd small { display: block; font-size: 34px; letter-spacing: 3px; }
      .cd-digits { position: relative; display: block; font-size: 120px; color: #e90931; line-height: 1; }"""


def line_html(prefix, idx, start, duration, text):
    return (f'<div id="{prefix}-l{idx}" class="clip line" data-start="{start}" data-duration="{duration}">'
            f'<span class="box" id="{prefix}-l{idx}-box">{text}</span></div>')


def line_js(prefix, idx, start):
    # A caixa abre da esquerda em 6 passos, como as dicas do jogo; o texto não se mexe depois.
    return (f'tl.fromTo("#{prefix}-l{idx}-box", {{ clipPath: "inset(0 100% 0 0)" }}, '
            f'{{ clipPath: "inset(0 0% 0 0)", duration: 0.27, ease: "steps(6)" }}, {start});')


def scene(sid, duration, body, js, dissolve_in=True, dissolve_out=True):
    parts = [DISSOLVE_JS]
    if dissolve_in:
        parts.append(f'dissolve(tl, "{sid}-din", 0, false, {len(sid) * 7919});')
    if dissolve_out:
        parts.append(f'dissolve(tl, "{sid}-dout", {duration - 0.42}, true, {len(sid) * 104729});')
    return f"""<template>
  <style>{BASE_CSS}
  </style>
  <div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080">
      {body}
      <div id="{sid}-din" class="dissolve"></div>
      <div id="{sid}-dout" class="dissolve"></div>
  </div>
  <script>
      const tl = gsap.timeline({{ paused: true }});
      {js}
      {' '.join(parts)}
      window.__timelines["{sid}"] = tl;
  </script>
</template>
"""


def room_shot(sid, room, scale, start_focus, end_focus, duration, lines, extra_body='', extra_js=''):
    w, h = ROOMS[room]
    x0, y0 = cam(room, scale, *start_focus)
    x1, y1 = cam(room, scale, *end_focus)
    body = (f'<div id="{sid}-cam" class="cam" style="width:{w}px;height:{h}px;">'
            f'<img id="{sid}-img" src="assets/rooms/{room}.png" alt="">{extra_body}</div>\n      '
            + '\n      '.join(line_html(sid, i, s, d, t) for i, (s, d, t) in enumerate(lines)))
    js = (f'tl.fromTo("#{sid}-cam", {{ x: {x0}, y: {y0}, scale: {scale} }}, '
          f'{{ x: {x1}, y: {y1}, scale: {scale}, duration: {duration}, ease: "power2.inOut" }}, 0);\n      '
          + '\n      '.join(line_js(sid, i, s) for i, (s, _, _) in enumerate(lines)) + '\n      ' + extra_js)
    return body, js


SCENES = []

# 1. TICEN: o 763.2 a 5x, depois recua para as plataformas.
s1x0, s1y0 = cam('room5', 5, 664, 488)
s1x1, s1y1 = cam('room5', 2.5, 384, 440)
SCENES.append(('s1', 0, 7.5, scene('s1', 7.5,
    f"""<div id="s1-cam" class="cam" style="width:768px;height:736px;"><img id="s1-img" src="assets/rooms/room5.png" alt=""></div>
      <div id="s1-cd" class="cd"><small>PARTIDA EM</small>
      {countdown('s1', 0, 7.5)}
      </div>
      {line_html('s1', 0, 0.8, 2.7, 'TICEN, PLATAFORMA C')}
      {line_html('s1', 1, 4.3, 2.8, 'FLORIANÓPOLIS, 2067')}""",
    f"""tl.fromTo("#s1-cam", {{ x: {s1x0}, y: {s1y0}, scale: 5 }}, {{ x: {s1x0}, y: {s1y0}, scale: 5, duration: 3.4 }}, 0);
      tl.to("#s1-cam", {{ x: {s1x1}, y: {s1y1}, scale: 2.5, duration: 3.6, ease: "power2.inOut" }}, 3.4);
      {line_js('s1', 0, 0.8)}
      {line_js('s1', 1, 4.3)}""", dissolve_in=False)))

for sid, start, room, scale, f0, f1, dur, lines in [
    ('s2', 7.5, 'room4', 3.5, (560, 300), (230, 300), 4, [(0.4, 3.2, 'FLORIA CONTROLA CADA ROTA DO CENTRO')]),
    ('s3', 11.5, 'room3', 3.5, (336, 470), (336, 200), 4,
     [(0.4, 3.2, 'QUEM SAI DA ROTA VIRA <span class="red">AMEAÇA</span>')]),
    ('s4', 15.5, 'room2', 3.5, (480, 330), (190, 360), 3.5, []),
]:
    body, js = room_shot(sid, room, scale, f0, f1, dur, lines)
    SCENES.append((sid, start, dur, scene(sid, dur, body, js)))

# 5. Sala I: o personagem de costas na calçada; depois corre para cima com a câmera atrás.
PLAYER = 38 * 0.7
player_body = (f'<div id="s5-player" style="position:absolute;left:{336 - PLAYER / 2}px;top:{536 - PLAYER / 2}px;'
               f'width:{PLAYER}px;height:{PLAYER}px;overflow:hidden;">'
               f'<img id="s5-strip" src="assets/art/player-up-strip.png" alt="" '
               f'style="position:absolute;left:0;top:0;width:{PLAYER * 9}px;height:{PLAYER}px;image-rendering:pixelated;"></div>')
p0x, p0y = cam('room1', 5, 336, 536)
p1x, p1y = cam('room1', 5, 336, 330)
SCENES.append(('s5', 19, 5.5, scene('s5', 5.5,
    f"""<div id="s5-cam" class="cam" style="width:672px;height:576px;"><img id="s5-img" src="assets/rooms/room1.png" alt="">{player_body}</div>
      {line_html('s5', 0, 0.5, 2.1, 'VOCÊ SAIU DA ROTA')}
      {line_html('s5', 1, 3.0, 2.1, '<span class="red">CORRA</span>')}""",
    f"""tl.fromTo("#s5-cam", {{ x: {p0x}, y: {p0y}, scale: 5 }}, {{ x: {p0x}, y: {p0y}, scale: 5, duration: 2.8 }}, 0);
      tl.to("#s5-cam", {{ x: {p1x}, y: {p1y}, scale: 5, duration: 2.7, ease: "power1.inOut" }}, 2.8);
      // Corrida: 9 quadros a 15 qps enquanto sobe a calçada.
      // Até o 9º quadro, nunca além dele: a posição depois do último é vazia.
      tl.fromTo("#s5-strip", {{ x: 0 }}, {{ x: {-PLAYER * 8}, duration: 0.6, ease: "steps(8)", repeat: 4 }}, 2.8);
      tl.fromTo("#s5-player", {{ y: 0 }}, {{ y: -236, duration: 2.7, ease: "none" }}, 2.8);
      {line_js('s5', 0, 0.5)}
      {line_js('s5', 1, 3.0)}""")))

# 6. Título: a ponte com o sol vermelho do menu, o logo e a contagem seguindo.
SCENES.append(('s6', 24.5, 5.5, scene('s6', 5.5,
    f"""<div id="s6-bg" class="cam" style="width:1920px;height:1081px;transform-origin:50% 50%;"><img id="s6-img" src="assets/art/background-bridge.png" alt=""></div>
      <img id="s6-title" src="assets/art/title.png" alt="Plataforma C: Escape from Floripa"
        style="position:absolute;left:{(W - 1009 * 1.5) / 2}px;top:400px;width:{1009 * 1.5}px;height:{154 * 1.5}px;image-rendering:pixelated;z-index:4;">
      <div id="s6-cd" class="cd"><small>PARTIDA EM</small>
      {countdown('s6', 24.5, 5.5)}
      </div>
      <div id="s6-l0" class="clip line" data-start="1.6" data-duration="3.9" style="left:auto;right:200px;bottom:170px;">
        <span class="box" id="s6-l0-box">PEGUE O 763.2 ANTES DA PARTIDA</span></div>""",
    """tl.fromTo("#s6-bg", { scale: 1 }, { scale: 1.04, duration: 5.5, ease: "none" }, 0);
      tl.fromTo("#s6-title", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "steps(12)" }, 0.5);
      """ + line_js('s6', 0, 1.6), dissolve_out=False)))

os.makedirs(os.path.join(OUT, 'compositions'), exist_ok=True)
for sid, _, _, html in SCENES:
    with open(os.path.join(OUT, 'compositions', f'{sid}.html'), 'w') as f:
        f.write(html)

hosts = '\n'.join(
    f'      <div id="{sid}" data-composition-id="{sid}" data-composition-src="compositions/{sid}.html" '
    f'data-start="{start}" data-duration="{dur}" data-track-index="1" data-track-kind="graphics" '
    f'data-width="1920" data-height="1080"></div>'
    for sid, start, dur, _ in SCENES)

steps = '\n'.join(
    f'      <audio id="step{k}" class="clip" src="assets/audio/player-footstep-concrete.wav" data-start="{round(21.8 + k * 0.3, 2)}" '
    f'data-duration="0.29" data-track-index="{6 + k % 2}" data-volume="0.9"></audio>' for k in range(9))

index = f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #01141a; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="30" data-width="1920" data-height="1080">
{hosts}
      <audio id="music" class="clip" src="assets/audio/mainmenu-trecho.mp3" data-start="0" data-duration="30"
        data-track-index="2" data-volume="0.8" data-fade-in="0.8" data-fade-out="1.5"></audio>
      <audio id="sting" class="clip" src="assets/audio/horror-tension.wav" data-start="11.85" data-duration="1.6" data-track-index="3" data-volume="1"></audio>
      <audio id="shot1" class="clip" src="assets/audio/enemy-shot.wav" data-start="15.9" data-duration="1.97" data-track-index="4" data-volume="0.8"></audio>
      <audio id="shot2" class="clip" src="assets/audio/enemy-shot.wav" data-start="16.8" data-duration="1.97" data-track-index="5" data-volume="0.7"></audio>
      <audio id="boom" class="clip" src="assets/audio/explosion_small.wav" data-start="17.9" data-duration="0.7" data-track-index="4" data-volume="1"></audio>
{steps}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
"""
with open(os.path.join(OUT, 'index.html'), 'w') as f:
    f.write(index)
print('ok', [s[0] for s in SCENES])
