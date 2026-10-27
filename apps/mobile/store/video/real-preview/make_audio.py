#!/usr/bin/env python3
"""موسيقى خلفية مركّبة رقميًا (124 نبضة/دقيقة) لمعاينة التطبيق: طبول وباص وكوردات ولحن قصير. بدون عيّنات خارجية وبدون numpy.
الاستعمال: python3 -I make_audio.py OUT.wav DURATION_SECONDS"""
import array, math, random, sys, wave

OUT, DUR = sys.argv[1], float(sys.argv[2])
SR = 48000
N = int(DUR * SR)
BEAT = 60.0 / 124
BAR = BEAT * 4
random.seed(7)
L = array.array('f', [0.0]) * N
R = array.array('f', [0.0]) * N


def add(t0, samples, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    gl = gain * (1 - max(0.0, pan)); gr = gain * (1 + min(0.0, pan))
    end = min(N, i0 + len(samples))
    for i in range(i0, end):
        s = samples[i - i0]
        L[i] += s * gl; R[i] += s * gr


def kick():
    n = int(0.32 * SR); out = []; ph = 0.0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * (46 + 120 * math.exp(-t * 30)) / SR
        out.append(math.sin(ph) * math.exp(-t * 11) + (0.5 * math.exp(-t * 400) * (random.random() - 0.5)))
    return out


def hat(open_=False):
    n = int((0.16 if open_ else 0.05) * SR); out = []; prev = 0.0
    k = 22 if open_ else 80
    for i in range(n):
        x = random.random() * 2 - 1; hp = x - prev; prev = x
        out.append(hp * math.exp(-(i / SR) * k))
    return out


def clap():
    n = int(0.2 * SR); out = []; lp = 0.0
    for i in range(n):
        t = i / SR; x = random.random() * 2 - 1; lp += 0.35 * (x - lp)
        env = math.exp(-t * 20) + 0.7 * math.exp(-max(0, t - 0.012) * 60) * (t > 0.012) + 0.5 * math.exp(-max(0, t - 0.024) * 60) * (t > 0.024)
        out.append(lp * env)
    return out


def tone(freq, dur, harm=((1, 1.0), (2, 0.3)), decay=7.0, attack=0.004):
    n = int(dur * SR); out = []
    for i in range(n):
        t = i / SR; a = min(1.0, t / attack)
        v = sum(g * math.sin(2 * math.pi * freq * h * t) for h, g in harm)
        out.append(v * a * math.exp(-t * decay))
    return out


def pad_chord(freqs, dur):
    n = int(dur * SR); out = []
    for i in range(n):
        t = i / SR; w = math.sin(math.pi * i / n) ** 2
        v = 0.0
        for f in freqs:
            v += math.sin(2 * math.pi * f * 0.997 * t) + math.sin(2 * math.pi * f * 1.003 * t)
        out.append(v * w / len(freqs))
    return out


# الكوردات: Am F C G (جذر الباص، ثلاثية الباد، نغمات اللحن)
CH = [
    (55.00, (220.0, 261.63, 329.63), (440.0, 523.25, 659.25, 523.25)),
    (43.65, (174.61, 220.0, 261.63), (349.23, 440.0, 523.25, 440.0)),
    (65.41, (261.63, 329.63, 392.0), (523.25, 659.25, 783.99, 659.25)),
    (49.00, (196.0, 246.94, 293.66), (392.0, 493.88, 587.33, 493.88)),
]
K, H, OH, C = kick(), hat(), hat(True), clap()
bars = int(DUR / BAR) + 1
for b in range(bars):
    t = b * BAR
    root, padf, arp = CH[b % 4]
    add(t - 0.1 if b else t, pad_chord(padf, BAR * 1.25), 0.07)
    for beat in range(4):
        tb = t + beat * BEAT
        if b >= 1:
            add(tb, K, 0.55)
            add(tb + BEAT / 2, H, 0.10, pan=0.3)
            if beat % 2 == 1:
                add(tb, C, 0.20)
        if b >= 1:
            for half in (0, 1):
                add(tb + half * BEAT / 2, tone(root * (1 if half == 0 else 2), 0.22, ((1, 1.0), (2, 0.35)), 8.0), 0.22 if half == 0 else 0.12)
        if b >= 2:
            for half in (0, 1):
                note = arp[(beat * 2 + half) % 4]
                add(tb + half * BEAT / 2, tone(note, 0.2, ((1, 1.0), (3, 0.25)), 10.0), 0.045, pan=-0.35 + 0.7 * half)
    if b >= 1 and b % 4 == 0:
        add(t, hat(True), 0.14, pan=-0.2)

# خرج: ضغط ناعم، تلاشي دخول وخروج، قمة -2 ديسيبل
peak = max(max(abs(x) for x in L), max(abs(x) for x in R)) or 1.0
fade_in, fade_out = 0.5, 1.4
pcm = array.array('h')
for i in range(N):
    t = i / SR
    g = min(1.0, t / fade_in) * min(1.0, max(0.0, (DUR - t) / fade_out))
    for ch in (L, R):
        v = math.tanh(1.25 * ch[i] / peak) / math.tanh(1.25) * 0.79 * g
        pcm.append(int(max(-1.0, min(1.0, v)) * 32767))
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', OUT, round(DUR, 2), 's')
