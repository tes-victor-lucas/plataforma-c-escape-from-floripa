"""Sons do Golem de Topázio, sintetizados sem amostras de terceiros.

golem-roar.wav  rugido das cutscenes (70% e 40%): voz grave e áspera, ronco de pedra, a pancada no chão
                no mesmo instante em que o golem bate (45% de 1,5 s) e um tilintar de cristal depois.
golem-slam.wav  pancada no chão: baque grave com a rachadura do chão e um estalo de cristal a cada
                topázio da cadeia (a cada 55 ms, 15 vezes, como TOPAZIO_BOSS.slam).
golem-spin.wav  giro de 2,2 s: um sopro a cada punho que passa (2 por volta, na velocidade do giro)
                e a pedra raspando por baixo.

uso: python3 assets/topazio/gen_sons.py
"""
import math
import os
import random
import struct
import wave

AUDIO = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'audio')
RATE = 44100


def write(name, samples):
    peak = max(abs(s) for s in samples) or 1
    os.makedirs(AUDIO, exist_ok=True)
    with wave.open(os.path.join(AUDIO, name), 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(s / peak * 0.9 * 32767)) for s in samples))


def crystal(dt, gain=1.0, decay=6.0):
    """Tilintar de cristal: três tons agudos que somem rápido."""
    return gain * math.exp(-dt * decay) * sum(
        g * math.sin(2 * math.pi * f * dt) for f, g in ((1840, 0.18), (2470, 0.14), (3150, 0.1)))


# ---------------------------------------------------------------- rugido

ROAR_DURATION = 1.5
ROAR_IMPACT = ROAR_DURATION * 0.45  # TOPAZIO_BOSS.roar.duration * 0.45: quando ele bate no chão na cutscene


def roar():
    def envelope(t):
        if t < 0.12:
            return t / 0.12
        if t > 1.1:
            return max(0.0, 1 - (t - 1.1) / (ROAR_DURATION - 1.1))
        return 1.0

    def pitch(t):
        # sobe rosnando, segura e despenca no fim
        if t < 0.3:
            return 70 + 25 * t / 0.3
        return 95 - 47 * min(1.0, (t - 0.3) / 1.2)

    rng = random.Random(7)
    samples = []
    phase = rumble = jitter = 0.0
    for n in range(int(RATE * ROAR_DURATION)):
        t = n / RATE
        phase += 2 * math.pi * pitch(t) / RATE
        # voz: dente de serra com 12 harmônicos, áspera
        voice = sum(math.sin(k * phase) / k for k in range(1, 13))
        # rosnado: tremolo rápido com um pouco de irregularidade
        jitter += (rng.uniform(-1, 1) - jitter) * 0.002
        growl = 1 - 0.45 * (0.5 + 0.5 * math.sin(2 * math.pi * (28 + 6 * jitter) * t))
        # ronco de pedra: ruído passado por um filtro passa-baixa
        rumble += (rng.uniform(-1, 1) - rumble) * 0.04
        value = (0.55 * voice * growl + 1.6 * rumble) * envelope(t)
        dt = t - ROAR_IMPACT
        if dt >= 0:
            value += 1.4 * math.exp(-dt * 9) * math.sin(2 * math.pi * 45 * dt) + 0.5 * math.exp(-dt * 40) * rng.uniform(-1, 1)
            value += crystal(dt)
        samples.append(math.tanh(1.8 * value))
    return samples


# ---------------------------------------------------------------- pancada

SPIKE_INTERVAL = 0.055
SPIKE_COUNT = 15


def slam():
    rng = random.Random(11)
    samples = []
    crack = 0.0
    for n in range(int(RATE * 1.3)):
        t = n / RATE
        # baque: grave caindo de 60 para 35 Hz
        value = 1.6 * math.exp(-t * 7) * math.sin(2 * math.pi * (35 * t + 25 * (1 - math.exp(-t * 8)) / 8))
        # chão rachando: ruído granulado que some devagar
        crack += (rng.uniform(-1, 1) - crack) * 0.25
        value += 0.9 * math.exp(-t * 5) * crack * (1 if rng.random() < 0.3 else 0.4)
        # um estalo de cristal para cada topázio que brota, cada vez mais longe e mais baixo
        for step in range(1, SPIKE_COUNT + 1):
            dt = t - step * SPIKE_INTERVAL
            if dt < 0:
                break
            far = 1 - step / (SPIKE_COUNT + 4)
            value += far * (0.7 * math.exp(-dt * 60) * rng.uniform(-1, 1) + crystal(dt, 2.2, 22))
        samples.append(math.tanh(1.5 * value))
    return samples


# ---------------------------------------------------------------- giro

SPIN_DURATION = 2.2
SPIN_TURN_SPEED = 0.022  # TOPAZIO_BOSS.spin.turnSpeed, em radianos por ms


def spin():
    rng = random.Random(13)
    whooshes_per_second = 2 * SPIN_TURN_SPEED * 1000 / (2 * math.pi)  # dois punhos por volta
    samples = []
    low = band = grind = 0.0
    for n in range(int(RATE * SPIN_DURATION)):
        t = n / RATE
        envelope = min(1.0, t / 0.15) * min(1.0, (SPIN_DURATION - t) / 0.25)
        # sopro: ruído num passa-banda simples, pulsando a cada punho que passa
        noise = rng.uniform(-1, 1)
        low += (noise - low) * 0.18
        band += (low - band) * 0.5
        swing = math.sin(math.pi * ((t * whooshes_per_second) % 1)) ** 4
        value = 1.8 * (low - band) * (0.25 + swing)
        # pedra raspando: zumbido grave áspero
        grind += (rng.uniform(-1, 1) - grind) * 0.02
        value += 0.35 * math.sin(2 * math.pi * 58 * t) * (0.6 + 0.4 * swing) + 1.2 * grind
        samples.append(math.tanh(1.4 * value * envelope))
    return samples


if __name__ == '__main__':
    write('golem-roar.wav', roar())
    write('golem-slam.wav', slam())
    write('golem-spin.wav', spin())
    print('ok')
