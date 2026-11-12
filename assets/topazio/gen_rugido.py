"""Rugido do Golem de Topázio para as cutscenes (70% e 40% de vida), sintetizado sem amostras de terceiros.

Voz grave e áspera que sobe e desce, ronco de pedra (ruído filtrado), a pancada no chão no mesmo instante
em que o golem bate na cutscene (45% de 1,5 s) e um tilintar de cristal logo depois.

uso: python3 assets/topazio/gen_rugido.py
"""
import math
import os
import random
import struct
import wave

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game', 'public', 'assets', 'audio', 'golem-roar.wav')
RATE = 44100
DURATION = 1.5
IMPACT = DURATION * 0.45  # TOPAZIO_BOSS.roar.duration * 0.45: quando ele bate no chão na cutscene


def envelope(t):
    if t < 0.12:
        return t / 0.12
    if t > 1.1:
        return max(0.0, 1 - (t - 1.1) / (DURATION - 1.1))
    return 1.0


def pitch(t):
    # sobe rosnando, segura e despenca no fim
    if t < 0.3:
        return 70 + 25 * t / 0.3
    return 95 - 47 * min(1.0, (t - 0.3) / 1.2)


def main():
    rng = random.Random(7)
    samples = []
    phase = 0.0
    rumble = 0.0
    jitter = 0.0
    for n in range(int(RATE * DURATION)):
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
        # pancada no chão: grave curto com estalo de ruído
        dt = t - IMPACT
        if dt >= 0:
            hit = math.exp(-dt * 9)
            value += 1.4 * hit * math.sin(2 * math.pi * 45 * dt) + 0.5 * math.exp(-dt * 40) * rng.uniform(-1, 1)
            # tilintar de cristal depois da pancada
            for freq, gain in ((1840, 0.18), (2470, 0.14), (3150, 0.1)):
                value += gain * math.exp(-dt * 6) * math.sin(2 * math.pi * freq * dt)
        samples.append(math.tanh(1.8 * value))
    peak = max(abs(s) for s in samples) or 1
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with wave.open(OUT, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b''.join(struct.pack('<h', int(s / peak * 0.9 * 32767)) for s in samples))
    print('ok')


if __name__ == '__main__':
    main()
