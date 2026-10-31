#!/usr/bin/env python3
"""
توليد صوت الفيديو بالكامل بالتركيب الرقمي (بدون أي عيّنات أو موسيقى خارجية، وبدون numpy).

الموسيقى: 124 نبضة/دقيقة، لا الصغير، طبول (kick/clap/hat/snare) + باص + كوردات + لحن قصير.
المؤثرات: whoosh، pop/ding، انفجار، نقرات، عدّاد، كونفيتي، نغمة فوز… كلها مربوطة بنفس
جدول الأحداث في timeline.js الذي يقود الحركة، فالتزامن مضمون.

الاستعمال: python3 -I audio.py OUT.wav
"""
import array
import json
import math
import os
import random
import re
import sys
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000


def load_timeline():
    txt = open(os.path.join(HERE, 'timeline.js'), encoding='utf8').read()
    txt = re.sub(r'^[^{]*', '', txt).strip().rstrip(';')
    return json.loads(txt)


TL = load_timeline()
BPM = TL['bpm']
BEAT = 60.0 / BPM
DUR = TL['beats'] * BEAT
N = int(round(DUR * SR))
E = TL['events']


def T(b):
    return b * BEAT


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)


# ---------------------------------------------------------------- الحافلات
class Bus:
    def __init__(self, n=N):
        self.L = array.array('d', bytes(8 * n))
        self.R = array.array('d', bytes(8 * n))
        self.n = n

    def add(self, sig, t0, gain=1.0, pan=0.0, sig_r=None):
        """يضيف إشارة أحادية (أو ستيريو إذا أُعطيت sig_r) مع توزيع بقدرة ثابتة."""
        i0 = int(round(t0 * SR))
        a = (pan + 1) * math.pi / 4
        gl = gain * math.cos(a) * 1.41421356
        gr = gain * math.sin(a) * 1.41421356
        L, R, n = self.L, self.R, self.n
        sr = sig_r if sig_r is not None else sig
        j0 = max(0, -i0)
        j1 = min(len(sig), n - i0)
        for j in range(j0, j1):
            L[i0 + j] += sig[j] * gl
            R[i0 + j] += sr[j] * gr

    def add_pan(self, sig, t0, gain, pans):
        """توزيع متحرك: pans قائمة بنفس طول الإشارة (-1 يسار، +1 يمين)."""
        i0 = int(round(t0 * SR))
        L, R, n = self.L, self.R, self.n
        for j in range(max(0, -i0), min(len(sig), n - i0)):
            a = (pans[j] + 1) * math.pi / 4
            L[i0 + j] += sig[j] * gain * math.cos(a) * 1.41421356
            R[i0 + j] += sig[j] * gain * math.sin(a) * 1.41421356


drums = Bus()     # الطبول
duck = Bus()      # باص وكوردات (تنخفض مع الكِك)
lead = Bus()      # اللحن والنغمات الموسيقية
sfx = Bus()       # المؤثرات
send = Bus()      # إرسال الصدى (reverb)

# ---------------------------------------------------------------- أدوات DSP
_rng = random.Random(2026)


def noise(n, seed=None):
    r = random.Random(seed) if seed is not None else _rng
    u = r.uniform
    return [u(-1.0, 1.0) for _ in range(n)]


def svf(x, fc, q=0.707, mode='lp'):
    """مرشح SVF بتصميم TPT (ثابت مع أي تردد). fc رقم أو قائمة لكل عيّنة."""
    out = [0.0] * len(x)
    ic1 = ic2 = 0.0
    k = 1.0 / q
    varying = isinstance(fc, list)
    if not varying:
        g = math.tan(math.pi * min(fc, SR * 0.45) / SR)
        a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    for i, v in enumerate(x):
        if varying:
            g = math.tan(math.pi * min(fc[i], SR * 0.45) / SR)
            a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
        v3 = v - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        if mode == 'lp':
            out[i] = v2
        elif mode == 'bp':
            out[i] = v1
        else:
            out[i] = v - k * v1 - v2
    return out


def env_exp(n, k, attack=0.002):
    na = max(1, int(attack * SR))
    return [(i / na if i < na else 1.0) * math.exp(-k * i / SR) for i in range(n)]


def mul(a, b):
    return [x * y for x, y in zip(a, b)]


def saw(freq, n, phase=0.0):
    out = [0.0] * n
    inc = freq / SR
    p = phase % 1.0
    for i in range(n):
        v = 2 * p - 1
        if p < inc:
            t = p / inc; v -= t + t - t * t - 1
        elif p > 1 - inc:
            t = (p - 1) / inc; v -= t * t + t + t + 1
        out[i] = v
        p += inc
        if p >= 1:
            p -= 1
    return out


def sine_sweep(f_fn, n, amp_fn=None):
    out = [0.0] * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * f_fn(t) / SR
        out[i] = math.sin(ph) * (amp_fn(t) if amp_fn else 1.0)
    return out


def norm_peak(x, peak=1.0):
    m = max(1e-9, max(abs(v) for v in x))
    return [v * peak / m for v in x]


# ---------------------------------------------------------------- الطبول
def make_kick():
    n = int(0.5 * SR)
    ph = 0.0
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        f = 46 + 120 * math.exp(-t * 32) + 260 * math.exp(-t * 300)
        ph += 2 * math.pi * f / SR
        a = min(1.0, t / 0.0015) * math.exp(-t * 6.5)
        out[i] = math.tanh(2.0 * math.sin(ph) * a)
    r = random.Random(5)
    for i in range(int(0.005 * SR)):
        out[i] += r.uniform(-1, 1) * 0.3 * math.exp(-i / SR * 900)
    return norm_peak(out, 1.0)


def make_clap(seed=7):
    n = int(0.42 * SR)
    x = svf(noise(n, seed), 1350, 0.9, 'bp')
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        e = 0.0
        for o in (0.0, 0.0105, 0.021):
            if t >= o:
                e += math.exp(-(t - o) * 380)
        if t >= 0.029:
            e += 0.8 * math.exp(-(t - 0.029) * 19)
        out[i] = x[i] * e
    return norm_peak(out, 1.0)


def make_hat(open_=False, seed=11):
    n = int((0.38 if open_ else 0.07) * SR)
    x = svf(noise(n, seed), 7600, 0.8, 'hp')
    x = svf(x, 11000, 0.6, 'lp')
    k = 9 if open_ else 75
    return norm_peak(mul(x, env_exp(n, k, 0.0008)), 1.0)


def make_snare(pitch=1.0, seed=13):
    n = int(0.25 * SR)
    nz = svf(noise(n, seed), 2100 * pitch, 0.7, 'bp')
    out = [0.0] * n
    ph = 0.0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * (185 * pitch + 60 * math.exp(-t * 40)) / SR
        out[i] = nz[i] * math.exp(-t * 17) * 1.2 + math.sin(ph) * math.exp(-t * 32) * 0.6
    return norm_peak(out, 1.0)


def make_crash(seed):
    n = int(2.6 * SR)
    x = svf(noise(n, seed), 4800, 0.7, 'hp')
    x2 = svf(x, 9000, 1.2, 'bp')
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        out[i] = (x[i] * 0.6 + x2[i] * 0.8) * min(1.0, t / 0.003) * math.exp(-t * 2.1)
    return norm_peak(out, 1.0)


KICK = make_kick()
CLAP = make_clap()
HAT = make_hat(False)
OHAT = make_hat(True)
CRASH_L = make_crash(21)
CRASH_R = make_crash(22)
SNARES = [make_snare(1.0 + 0.04 * k, 30 + k) for k in range(8)]

# ---------------------------------------------------------------- الموسيقى
CH = {'Am': [57, 60, 64], 'F': [57, 60, 65], 'C': [55, 60, 64], 'G': [55, 59, 62]}
ROOT = {'Am': 45, 'F': 41, 'C': 36, 'G': 43}


def chord_at(b):
    if b < 4:
        return 'Am'
    k = int(b // 4)
    seq = {1: 'Am', 2: 'F', 3: 'C', 4: 'G', 5: 'Am', 6: 'F', 7: 'G', 8: 'Am', 9: 'F', 10: 'C', 11: 'G', 12: 'F', 13: 'C'}
    if k == 12 and b >= 50:
        return 'G'
    return seq.get(k, 'C')


def kick_beats():
    ks = []
    for b in range(4, 30):
        ks.append(b)
    for b in range(32, 53):
        ks.append(b)
    return ks


KICKS = kick_beats()

# ---- طبول
for b in KICKS:
    g = 1.0 if b not in (4, 32, 52) else 1.15
    drums.add(KICK, T(b), 0.92 * g)
for b in list(range(5, 28, 2)) + list(range(33, 40, 2)) + list(range(41, 52, 2)):
    drums.add(CLAP, T(b), 0.42, pan=0.05)
    send.add(CLAP, T(b), 0.12)
for b in list(range(4, 28)) + list(range(40, 52)):
    drums.add(HAT, T(b + 0.5), 0.22, pan=0.25)
for b in range(32, 40):
    drums.add(OHAT, T(b + 0.5), 0.2, pan=0.25)
    drums.add(HAT, T(b + 0.25), 0.1, pan=-0.3)
    drums.add(HAT, T(b + 0.75), 0.12, pan=-0.3)
for b in range(16, 28):  # هايهات خفيف إضافي يرفع الطاقة تدريجيًا
    drums.add(HAT, T(b + 0.25), 0.07, pan=-0.35)
    drums.add(HAT, T(b + 0.75), 0.08, pan=-0.35)
# لفّة السنير في البناء (تتسارع وتعلو)
roll = []
b = 28.0
while b < 31.75 - 1e-6:
    roll.append(b)
    step = 1.0 if b < 29 else 0.5 if b < 30 else 0.25 if b < 31 else 0.125
    b += step
for i, b in enumerate(roll):
    p = (b - 28) / 3.75
    s = SNARES[min(7, int(p * 8))]
    drums.add(s, T(b), 0.18 + 0.42 * p * p, pan=0.0)
    send.add(s, T(b), 0.1 + 0.15 * p)
for b, g in ((4, 0.55), (24, 0.32), (32, 0.6), (40, 0.36), (50, 0.45), (52, 0.55)):
    drums.add(CRASH_L, T(b), g, pan=-0.5)
    drums.add(CRASH_R, T(b), g, pan=0.5)

# ---- باص
def bass_note(m, dur, cutoff=1500.0, sub=True, gain=1.0):
    n = int(dur * SR)
    f = midi(m)
    x = saw(f, n)
    if sub:
        fs = f / 2 if f / 2 >= 40 else f
        x = [v * 0.6 + math.sin(2 * math.pi * fs * i / SR) * 0.8 for i, v in enumerate(x)]
    fc = [180 + cutoff * math.exp(-i / SR * 14) for i in range(n)]
    y = svf(x, fc, 0.9, 'lp')
    na = int(0.003 * SR); nr = int(0.03 * SR)
    for i in range(n):
        a = min(1.0, i / na) * (0.85 + 0.15 * math.exp(-i / SR * 12))
        if i > n - nr:
            a *= (n - i) / nr
        y[i] *= a * gain
    return y


bass_cache = {}


def bass(m, dur, cutoff, gain=1.0):
    key = (m, round(dur, 4), cutoff)
    if key not in bass_cache:
        bass_cache[key] = bass_note(m, dur, cutoff)
    return bass_cache[key]


for b in range(4, 30):
    if b == 4:
        continue
    r = ROOT[chord_at(b)]
    duck.add(bass(r, 0.42 * BEAT, 1400), T(b + 0.5), 0.5)
for b in range(32, 52):
    r = ROOT[chord_at(b)]
    if 32 <= b < 40:
        duck.add(bass(r, 0.22 * BEAT, 2200), T(b + 0.25), 0.42)
        duck.add(bass(r + 12, 0.22 * BEAT, 2600), T(b + 0.5), 0.4)
        duck.add(bass(r, 0.22 * BEAT, 2200), T(b + 0.75), 0.42)
    else:
        duck.add(bass(r, 0.42 * BEAT, 1400), T(b + 0.5), 0.5)


# ---- كوردات: سوبر سو
def supersaw(notes, dur, cut0, cut1, attack=0.004, release=0.08, voices=5, detune=0.18, seed=1, gain=1.0):
    n = int(dur * SR)
    r = random.Random(seed)
    L = [0.0] * n
    R = [0.0] * n
    for m in notes:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune
            s = saw(midi(m + d), n, r.random())
            pan = (v - (voices - 1) / 2) / max(1, voices - 1) * 1.4
            gl = math.cos((pan + 1) * math.pi / 4)
            gr = math.sin((pan + 1) * math.pi / 4)
            for i in range(n):
                L[i] += s[i] * gl
                R[i] += s[i] * gr
    fc = [cut1 + (cut0 - cut1) * math.exp(-i / SR * 9) for i in range(n)]
    L = svf(L, fc, 0.8, 'lp')
    R = svf(R, fc, 0.8, 'lp')
    na = max(1, int(attack * SR)); nr = max(1, int(release * SR))
    sc = gain / (len(notes) * voices) * 2.2
    for i in range(n):
        a = min(1.0, i / na)
        if i > n - nr:
            a *= (n - i) / nr
        L[i] *= a * sc
        R[i] *= a * sc
    return L, R


def pad(notes, dur, cut_from, cut_to, gain, seed):
    n = int(dur * SR)
    r = random.Random(seed)
    L = [0.0] * n; R = [0.0] * n
    for m in notes:
        for v, d in enumerate((-0.12, 0.0, 0.12)):
            s = saw(midi(m + d), n, r.random())
            gl, gr = (1.0, 0.35) if v == 0 else (0.35, 1.0) if v == 2 else (0.7, 0.7)
            for i in range(n):
                L[i] += s[i] * gl; R[i] += s[i] * gr
    fc = [cut_from * (cut_to / cut_from) ** (i / n) for i in range(n)]
    L = svf(L, fc, 0.7, 'lp'); R = svf(R, fc, 0.7, 'lp')
    na = int(min(0.6, dur * 0.4) * SR); nr = int(min(0.5, dur * 0.3) * SR)
    sc = gain / (len(notes) * 3)
    for i in range(n):
        a = min(1.0, i / na) if na else 1.0
        if i > n - nr:
            a *= (n - i) / nr
        L[i] *= a * sc; R[i] *= a * sc
    return L, R


# مقدمة: باد لا الصغير يتفتح
pl, pr = pad([45, 57, 60, 64, 69], T(4) + 0.3, 250, 2600, 0.55, 3)
lead.add(pl, 0.0, 1.0, sig_r=pr)
send.add(pl, 0.0, 0.25)
# ضربة الشعار: كورد قوي
sl, sr_ = supersaw([57, 60, 64, 69], 1.1, 5200, 700, release=0.4, seed=4, gain=0.85)
duck.add(sl, T(4), 1.0, sig_r=sr_)
send.add(sl, T(4), 0.3)
# باد هادئ تحت أجزاء الواجهة
for b0, b1 in ((8, 28), (40, 50)):
    for bar in range(b0, b1, 4):
        c = chord_at(bar)
        l_, r_ = pad([n + 12 for n in CH[c]], T(4) + 0.25, 700, 1400, 0.16, 10 + bar)
        duck.add(l_, T(bar), 1.0, sig_r=r_)
# الضربة: ستابات على النبضات الخلفية
for b in range(32, 40):
    c = chord_at(b)
    notes = [n + 12 for n in CH[c]] + [CH[c][0]]
    for off, ln in ((0.5, 0.2), (0.75, 0.14)) if b % 2 == 1 else ((0.5, 0.22),):
        l_, r_ = supersaw(notes, ln * BEAT + 0.05, 6500, 1200, seed=50 + b, gain=0.55)
        duck.add(l_, T(b + off), 1.0, sig_r=r_)
        send.add(l_, T(b + off), 0.12)
# ستاب كبير عند الضربة وعند المبادلة
for b, g in ((32, 0.95), (34, 0.6), (40, 0.6), (50, 0.7)):
    c = chord_at(b)
    l_, r_ = supersaw([n + 12 for n in CH[c]] + [CH[c][0]], 0.9, 6000, 600, release=0.35, seed=90 + b, gain=g)
    duck.add(l_, T(b), 1.0, sig_r=r_)
    send.add(l_, T(b), 0.25)
# الختام: كورد دو الكبير يرنّ
l_, r_ = supersaw([48, 55, 60, 64, 67, 72, 76], T(5) + 0.2, 4500, 900, release=1.4, voices=5, seed=99, gain=0.9)
lead.add(l_, T(52), 1.0, sig_r=r_)
send.add(l_, T(52), 0.5)


# ---- لحن وأربيجيو
def pluck(m, dur=0.22, bright=3800, gain=1.0, pulse_w=0.3):
    n = int(dur * SR)
    f = midi(m)
    out = [0.0] * n
    p = 0.0
    inc = f / SR
    for i in range(n):
        out[i] = (1.0 if p < pulse_w else -1.0) * 0.6 + (2 * p - 1) * 0.4
        p += inc
        if p >= 1:
            p -= 1
    fc = [300 + bright * math.exp(-i / SR * 18) for i in range(n)]
    out = svf(out, fc, 1.1, 'lp')
    e = env_exp(n, 9, 0.002)
    nr = int(0.02 * SR)
    for i in range(n):
        out[i] *= e[i] * gain * (1.0 if i < n - nr else (n - i) / nr)
    return out


HOOK = [(0, 76, 1), (2, 76, 1), (3, 79, 1), (4, 81, 2), (6, 79, 1), (7, 76, 1), (8, 74, 2), (10, 76, 2), (12, 72, 2), (14, 74, 2),
        (16, 72, 1), (18, 72, 1), (19, 74, 1), (20, 76, 2), (22, 74, 1), (23, 72, 1), (24, 69, 2), (26, 72, 2), (28, 67, 2), (30, 69, 2)]


def play_hook(start_beat, gain, bright=4200):
    for step, m, ln in HOOK:
        t0 = T(start_beat + step / 4)
        s = pluck(m, ln * BEAT / 4 + 0.12, bright, 1.0)
        lead.add(s, t0, gain, pan=0.0)
        send.add(s, t0, gain * 0.35)
        for k in range(1, 4):  # صدى متناوب يمين/يسار (3/16 نبضة)
            lead.add(s, t0 + k * 0.75 * BEAT, gain * 0.42 ** k, pan=(0.7 if k % 2 else -0.7))


play_hook(32, 0.42)
play_hook(36, 0.42)
play_hook(44, 0.24, 2600)
# أربيجيو خفيف في أجزاء الواجهة
ARP = [0, 1, 2, 1]
for b0, b1 in ((8, 28), (40, 44), (48, 52)):
    for b in range(b0, b1):
        c = CH[chord_at(b)]
        for k in range(2):
            m = c[ARP[(b * 2 + k) % 4]] + 12
            s = pluck(m, 0.16, 2200, 1.0, 0.5)
            lead.add(s, T(b + k * 0.5 + 0.25), 0.2, pan=(0.35 if k else -0.35))


# ---------------------------------------------------------------- المؤثرات
def whoosh(dur, f0, f1, gain=1.0, pan0=0.0, pan1=0.0, peak=0.7, seed=None, q=1.4):
    n = int(dur * SR)
    x = noise(n, seed)
    fc = [f0 * (f1 / f0) ** (i / n) for i in range(n)]
    y = svf(x, fc, q, 'bp')
    y2 = svf(x, [v * 1.9 for v in fc], q * 1.2, 'bp')
    out = [0.0] * n
    for i in range(n):
        p = i / n
        a = (p / peak) ** 2 if p < peak else ((1 - p) / (1 - peak)) ** 1.5
        out[i] = (y[i] + 0.5 * y2[i]) * a
    out = norm_peak(out, gain)
    pans = [pan0 + (pan1 - pan0) * (i / n) for i in range(n)]
    return out, pans


def add_whoosh(t_end, dur, f0, f1, gain, pan0=0.0, pan1=0.0, peak=0.75, seed=None):
    s, pans = whoosh(dur, f0, f1, gain, pan0, pan1, peak, seed)
    sfx.add_pan(s, t_end - dur * peak, 1.0, pans)
    send.add(s, t_end - dur * peak, 0.15)


def boom(dur=2.2, gain=1.0, seed=1, sub_from=95, sub_to=32):
    n = int(dur * SR)
    out = []
    for ch in range(2):
        x = noise(n, seed * 10 + ch)
        fc = [110 + 4200 * math.exp(-i / SR * 7) for i in range(n)]
        y = svf(x, fc, 0.8, 'lp')
        r = random.Random(seed * 77 + ch)
        cr = [0.0] * n
        for _ in range(140):
            i0 = int(r.random() ** 2 * 0.9 * SR)
            if i0 >= n:
                continue
            a = r.uniform(0.2, 1.0) * math.exp(-i0 / SR * 3)
            for j in range(min(int(0.004 * SR), n - i0)):
                cr[i0 + j] += r.uniform(-1, 1) * a * math.exp(-j / SR * 1200)
        ph = 0.0
        o = [0.0] * n
        for i in range(n):
            t = i / SR
            f = sub_to + (sub_from - sub_to) * math.exp(-t * 3.2)
            ph += 2 * math.pi * f / SR
            env = min(1.0, t / 0.004)
            o[i] = (y[i] * 1.5 * math.exp(-t * 2.6) + math.sin(ph) * 0.9 * math.exp(-t * 2.4) + cr[i] * 0.5 * math.exp(-t * 2)) * env
        out.append(o)
    m = max(max(abs(v) for v in out[0]), max(abs(v) for v in out[1]))
    return [v * gain / m for v in out[0]], [v * gain / m for v in out[1]]


def pop(f0=420, f1=980, dur=0.11, gain=1.0):
    n = int(dur * SR)
    s = sine_sweep(lambda t: f0 + (f1 - f0) * (1 - math.exp(-t * 60)), n, lambda t: min(1, t / 0.002) * math.exp(-t * 34))
    nz = svf(noise(n, 3), 2500, 1.0, 'bp')
    return norm_peak([v + nz[i] * 0.12 * math.exp(-i / SR * 200) for i, v in enumerate(s)], gain)


def bell(m, dur=1.2, gain=1.0, decay=3.0):
    f = midi(m)
    n = int(dur * SR)
    parts = ((1.0, 1.0, decay), (2.0, 0.45, decay * 1.5), (2.76, 0.3, decay * 2.2), (5.4, 0.18, decay * 3.5), (8.1, 0.08, decay * 5))
    out = [0.0] * n
    for mult, amp, k in parts:
        w = 2 * math.pi * f * mult / SR
        for i in range(n):
            out[i] += math.sin(w * i) * amp * math.exp(-k * i / SR)
    na = int(0.0015 * SR)
    for i in range(na):
        out[i] *= i / na
    return norm_peak(out, gain)


def click(gain=1.0, f=3200):
    n = int(0.03 * SR)
    nz = noise(n, 8)
    return norm_peak([nz[i] * math.exp(-i / SR * 900) * 0.7 + math.sin(2 * math.pi * f * i / SR) * math.exp(-i / SR * 260) for i in range(n)], gain)


def tick(f=2400, gain=1.0):
    n = int(0.05 * SR)
    return [math.sin(2 * math.pi * f * i / SR) * math.exp(-i / SR * 110) * gain * min(1, i / 30) for i in range(n)]


def lock_click(gain=1.0):
    n = int(0.16 * SR)
    a = svf(noise(n, 4), 3600, 6.0, 'bp')
    out = [0.0] * n
    for i in range(n):
        t = i / SR
        e1 = math.exp(-t * 160)
        e2 = math.exp(-(t - 0.045) * 140) if t > 0.045 else 0.0
        out[i] = a[i] * (e1 + 1.3 * e2) * 2.5 + math.sin(2 * math.pi * 170 * t) * (e2 * 0.8)
    return norm_peak(out, gain)


def popper(gain=1.0, seed=9):
    n = int(0.9 * SR)
    x = svf(noise(n, seed), 2300, 0.9, 'bp')
    out = [x[i] * math.exp(-i / SR * 26) * 1.4 for i in range(n)]
    r = random.Random(seed)
    for _ in range(90):
        i0 = int((0.03 + r.random() ** 1.6 * 0.7) * SR)
        a = r.uniform(0.1, 0.6) * math.exp(-i0 / SR * 2.5)
        f = r.uniform(3000, 7000)
        for j in range(min(int(0.006 * SR), n - i0)):
            out[i0 + j] += math.sin(2 * math.pi * f * j / SR) * a * math.exp(-j / SR * 700)
    return norm_peak(out, gain)


def boing(f=330, gain=1.0):
    n = int(0.35 * SR)
    return norm_peak(sine_sweep(lambda t: f * (1 + 0.35 * math.sin(2 * math.pi * 11 * t) * math.exp(-t * 7)) * (1 + 0.6 * math.exp(-t * 30)),
                                n, lambda t: min(1, t / 0.003) * math.exp(-t * 9)), gain)


def sizzle(dur, gain=1.0, seed=15):
    n = int(dur * SR)
    hiss = svf(noise(n, seed), 6500, 0.7, 'hp')
    r = random.Random(seed)
    out = [hiss[i] * 0.25 * (0.6 + 0.4 * math.sin(i / SR * 37) * math.sin(i / SR * 23)) for i in range(n)]
    i = 0
    while i < n:
        i += int(r.expovariate(260) * SR) + 1
        a = r.uniform(0.2, 1.0)
        for j in range(min(int(0.0025 * SR), n - i)):
            out[i + j] += r.uniform(-1, 1) * a * math.exp(-j / SR * 1800)
    fade = int(0.15 * SR)
    for k in range(n):
        g = min(1.0, k / fade, (n - k) / fade)
        out[k] *= g
    out = svf(out, 2200, 0.7, 'hp')
    return norm_peak(out, gain)


def riser(dur, gain=1.0, seed=17):
    n = int(dur * SR)
    x = noise(n, seed)
    fc = [300 * (9000 / 300) ** ((i / n) ** 1.4) for i in range(n)]
    y = svf(x, fc, 2.2, 'bp')
    tone = sine_sweep(lambda t: 180 * (4.0 ** (t / dur)), n)
    out = [(y[i] * 1.0 + tone[i] * 0.18) * ((i / n) ** 1.8) for i in range(n)]
    return norm_peak(out, gain)


def reverse_swell(dur, gain, seed=19):
    s = make_crash(seed)[: int(dur * SR)]
    s = s[::-1]
    n = len(s)
    return [v * (i / n) ** 1.5 * gain for i, v in enumerate(s)]


# --- المقدمة
sfx.add(reverse_swell(T(1) + 0.1, 0.12), 0.0, 1.0, pan=0.0)
sfx.add(pop(220, 520, 0.16, 0.6), T(E['bomb']), 1.0, pan=0.0)
bl, br = boom(1.0, 0.35, seed=3, sub_from=120, sub_to=50)
sfx.add(bl, T(E['bomb']), 1.0, sig_r=br)
sfx.add(sizzle(T(4) - T(E['bomb']) + 0.25, 0.14), T(E['bomb']) + 0.05, 1.0, pan=0.25)
add_whoosh(T(4), 1.0, 500, 4200, 0.5, pan0=0.9, pan1=0.05, peak=0.92, seed=31)
add_whoosh(T(4), 1.0, 450, 3800, 0.5, pan0=-0.9, pan1=-0.05, peak=0.92, seed=32)
sfx.add(reverse_swell(0.9, 0.22, seed=23), T(4) - 0.9, 1.0)
bl, br = boom(2.4, 0.95, seed=1)
sfx.add(bl, T(E['logoHit']), 1.0, sig_r=br)
send.add(bl, T(E['logoHit']), 0.25)
sfx.add(pop(600, 1500, 0.1, 0.42), T(E['ao']), 1.0)
for i, m in enumerate((81, 84, 88, 93)):
    b_ = bell(m, 0.9, 0.12, 4)
    sfx.add(b_, T(E['tagline']) + i * 0.045, 1.0, pan=(-0.4 + 0.27 * i))
    send.add(b_, T(E['tagline']) + i * 0.045, 0.2)

# --- الانتقالات (whoosh)
for b_end, dur, f0, f1, g, p0, p1, sd in ((8.0, 0.75, 300, 3500, 0.42, -0.6, 0.6, 41), (11.75, 0.6, 350, 3000, 0.34, 0.6, -0.4, 42),
                                         (16.05, 0.65, 350, 3200, 0.36, -0.5, 0.5, 43), (40.0, 0.6, 3000, 400, 0.36, 0.6, -0.6, 44),
                                         (50.0, 0.8, 300, 4200, 0.4, -0.6, 0.6, 45)):
    add_whoosh(T(b_end), dur, f0, f1, g, p0, p1, 0.8, sd)

# --- الغرفة
sfx.add(click(0.35), T(E['tapCreate']), 1.0)
sfx.add(pop(500, 1100, 0.1, 0.36), T(E['tapCreate']) + 0.02, 1.0)
for i, (b, m) in enumerate(zip(E['codePulse'], (88, 91, 96))):
    s = bell(m, 1.0, 0.2, 4.5)
    sfx.add(s, T(b), 1.0, pan=0.1)
    send.add(s, T(b), 0.25)
sfx.add(pop(380, 820, 0.12, 0.4), T(E['team1']), 1.0, pan=0.35)
sfx.add(pop(330, 700, 0.12, 0.4), T(E['team2']), 1.0, pan=-0.35)
for b, m in zip(E['cats'], (84, 88, 91)):
    sfx.add(pluck(m, 0.2, 5000, 0.22), T(b), 1.0, pan=0.0)

# --- اللوحة
for b, m in zip(E['rows'], (79, 83, 86, 91, 95)):
    s = pluck(m, 0.3, 6000, 0.24)
    sfx.add(s, T(b), 1.0, pan=0.0)
    send.add(s, T(b), 0.2)
    for c in range(1, 4):
        sfx.add(tick(2600 + 300 * c, 0.05), T(b) + c * 0.045, 1.0, pan=(-0.5 + c * 0.33))
sfx.add(click(0.4), T(E['tapCell']), 1.0)
sfx.add(pop(480, 1200, 0.1, 0.4), T(E['tapCell']) + 0.02, 1.0)
sfx.add(riser(T(24) - T(20.4), 0.16, seed=51), T(20.4), 1.0)
add_whoosh(T(24), 1.25, 200, 7000, 0.5, -0.2, 0.2, 0.97, 52)
bl, br = boom(1.6, 0.55, seed=5, sub_from=110, sub_to=40)
sfx.add(bl, T(E['questionIn']), 1.0, sig_r=br)

# --- السؤال
for i, b in enumerate(E['btnPulse']):
    m = 81 if i % 2 == 0 else 84
    sfx.add(pluck(m, 0.18, 4500, 0.22, 0.25), T(b), 1.0, pan=(-0.4 if i % 2 == 0 else 0.4))
sfx.add(pop(300, 700, 0.12, 0.38), T(E['lock']), 1.0)
sfx.add(lock_click(0.5), T(E['lockClick']) - 0.045, 1.0)
for k in range(8):  # تبديل سريع بين الزرّين أثناء البناء
    sfx.add(tick(1800 if k % 2 == 0 else 2400, 0.07), T(30 + k * 0.25), 1.0, pan=(-0.5 if k % 2 == 0 else 0.5))
sfx.add(riser(T(31.75) - T(28), 0.32, seed=53), T(28), 1.0)
# الضربة
bl, br = boom(2.6, 1.0, seed=7)
sfx.add(bl, T(E['drop']), 1.0, sig_r=br)
send.add(bl, T(E['drop']), 0.3)
# المبادلة: هبّتان متعاكستان
add_whoosh(T(E['swap']) + 0.3, 0.55, 500, 3800, 0.42, -0.9, 0.9, 0.6, 61)
add_whoosh(T(E['swap']) + 0.3, 0.55, 450, 3400, 0.42, 0.9, -0.9, 0.6, 62)
sfx.add(pop(400, 900, 0.1, 0.3), T(E['subs']), 1.0)

# --- النتيجة
sfx.add(pop(260, 760, 0.16, 0.5), T(E['resultIn']), 1.0)
bl, br = boom(1.2, 0.4, seed=9, sub_from=100, sub_to=45)
sfx.add(bl, T(E['resultIn']), 1.0, sig_r=br)
pl_ = popper(0.55, 71)
sfx.add(pl_, T(E['confetti']), 1.0, pan=-0.6)
sfx.add(popper(0.55, 72), T(E['confetti']) + 0.03, 1.0, pan=0.6)
send.add(pl_, T(E['confetti']), 0.2)
a_, b_ = T(E['count'][0]), T(E['count'][1])
scale = (72, 74, 76, 77, 79, 81, 83, 84, 86, 88)
for i in range(1, 11):
    tk = a_ + (b_ - a_) * (1 - (1 - i / 10) ** (1 / 3))
    sfx.add(tick(midi(scale[i - 1] + 12), 0.12), tk, 1.0, pan=0.15)
# نغمة الفوز
for i, m in enumerate((72, 76, 79, 84, 88, 91, 96)):
    s = bell(m, 1.3 if i == 6 else 0.6, 0.2, 3.5)
    lead.add(s, T(43) + i * 0.055, 1.0, pan=(-0.5 + i / 6))
    send.add(s, T(43) + i * 0.055, 0.3)
for m in (84, 88, 91):
    s = bell(m, 1.8, 0.14, 2.2)
    lead.add(s, T(43.5), 1.0)
    send.add(s, T(43.5), 0.35)
sfx.add(boing(300, 0.36), T(E['teamsBounce'][0]), 1.0, pan=0.35)
sfx.add(boing(250, 0.26), T(E['teamsBounce'][1]), 1.0, pan=-0.35)
for i, m in enumerate((83, 86)):
    s = bell(m, 0.8, 0.16, 4)
    sfx.add(s, T(E['answerGlow']) + i * 0.12, 1.0)
    send.add(s, T(E['answerGlow']) + i * 0.12, 0.25)

# --- الخاتمة
bl, br = boom(2.0, 0.75, seed=11)
sfx.add(bl, T(E['outroIn']), 1.0, sig_r=br)
for i, m in enumerate((79, 83, 86, 91, 95, 98)):
    s = bell(m, 1.0, 0.1, 3)
    sfx.add(s, T(E['outroIn']) + 0.05 + i * 0.06, 1.0, pan=(0.6 - 0.24 * i))
    send.add(s, T(E['outroIn']) + 0.05 + i * 0.06, 0.3)
add_whoosh(T(E['outroLogo']) + 0.3, 0.45, 600, 3600, 0.3, 0.8, 0.0, 0.7, 81)
add_whoosh(T(E['outroLogo']) + 0.3, 0.45, 550, 3300, 0.3, -0.8, 0.0, 0.7, 82)
sfx.add(pop(600, 1400, 0.1, 0.3), T(E['outroLogo']) + 0.25, 1.0)
bl, br = boom(2.8, 0.7, seed=13, sub_from=80, sub_to=30)
sfx.add(bl, T(E['final']), 1.0, sig_r=br)
for i, m in enumerate((84, 88, 91, 96)):
    s = bell(m, 2.5, 0.12, 1.6)
    lead.add(s, T(E['final']) + 0.02 + i * 0.03, 1.0, pan=(-0.45 + 0.3 * i))
    send.add(s, T(E['final']), 0.4)


# ---------------------------------------------------------------- الصدى + الدمج النهائي
def reverb(x, delays, fb=0.8, damp=0.28, ap=(556, 441)):
    n = len(x)
    acc = [0.0] * n
    sc = SR / 44100.0
    for d0 in delays:
        d = int(d0 * sc)
        buf = [0.0] * d
        idx = 0
        store = 0.0
        for i in range(n):
            o = buf[idx]
            store = o * (1 - damp) + store * damp
            buf[idx] = x[i] + store * fb
            idx += 1
            if idx == d:
                idx = 0
            acc[i] += o
    for d0 in ap:
        d = int(d0 * sc)
        buf = [0.0] * d
        idx = 0
        for i in range(n):
            o = buf[idx]
            v = acc[i]
            buf[idx] = v + o * 0.5
            acc[i] = o - v
            idx += 1
            if idx == d:
                idx = 0
    return acc


if os.environ.get('AUDIO_STATS'):
    def rms(bus, t0, t1):
        i0, i1 = int(t0 * SR), int(t1 * SR)
        v = sum(bus.L[i] ** 2 + bus.R[i] ** 2 for i in range(i0, i1)) / max(1, 2 * (i1 - i0))
        pk = max(max(abs(bus.L[i]), abs(bus.R[i])) for i in range(i0, i1))
        return f'{10 * math.log10(v + 1e-12):6.1f}/{20 * math.log10(pk + 1e-12):5.1f}'
    secs = [('intro', 0, T(4)), ('hit', T(4), T(6)), ('room', T(8), T(16)), ('board', T(16), T(24)), ('quest', T(24), T(31.75)),
            ('drop', T(32), T(40)), ('result', T(40), T(50)), ('outro', T(50), DUR)]
    print('section   ' + ' '.join(f'{n:>12}' for n in ('drums', 'duck', 'lead', 'sfx')))
    for name, a0, a1 in secs:
        print(f'{name:8}  ' + ' '.join(f'{rms(bb, a0, a1):>12}' for bb in (drums, duck, lead, sfx)))

mono_send = [(a + b) * 0.5 for a, b in zip(send.L, send.R)]
revL = reverb(mono_send, (1116, 1188, 1277, 1356))
revR = reverb(mono_send, (1139, 1211, 1300, 1379), ap=(579, 464))

# منحنى الانخفاض مع الكِك (sidechain)
duck_env = [1.0] * N
for b in KICKS:
    i0 = int(round(T(b) * SR))
    for j in range(int(0.32 * SR)):
        i = i0 + j
        if i >= N:
            break
        t = j / SR
        v = 1 - 0.62 * math.exp(-t / 0.085) * min(1.0, t / 0.004 + 0.25)
        if v < duck_env[i]:
            duck_env[i] = v

outL = [0.0] * N
outR = [0.0] * N
for i in range(N):
    d = duck_env[i]
    outL[i] = drums.L[i] * 0.48 + duck.L[i] * d * 0.85 + lead.L[i] * 0.95 + sfx.L[i] * 1.5 + revL[i] * 0.05
    outR[i] = drums.R[i] * 0.48 + duck.R[i] * d * 0.85 + lead.R[i] * 0.95 + sfx.R[i] * 1.5 + revR[i] * 0.05

# فلتر تمرير عالي خفيف لإزالة الإزاحة والترددات تحت السمعية
outL = svf(outL, 28, 0.707, 'hp')
outR = svf(outR, 28, 0.707, 'hp')

# تطبيع الجهارة (RMS ≈ -14.5 dBFS) ثم محدِّد ناعم يمنع القص، ثم ذروة نهائية ≤ -3 dBFS (هامش لترميز AAC)
rms_all = math.sqrt(sum(v * v for v in outL) / N * 0.5 + sum(v * v for v in outR) / N * 0.5)
g0 = 10 ** (-14.5 / 20) / rms_all


def soft(v):
    a = abs(v)
    if a < 0.55:
        return v
    y = 0.55 + 0.4 * math.tanh((a - 0.55) / 0.4)
    return y if v > 0 else -y


outL = [soft(v * g0) for v in outL]
outR = [soft(v * g0) for v in outR]
fi = int(0.03 * SR)
fo = int(1.6 * SR)
for i in range(N):
    g = 1.0
    if i < fi:
        g = i / fi
    if i > N - fo:
        x = (N - i) / fo
        g *= x * x
    outL[i] *= g
    outR[i] *= g
peak = max(max(abs(v) for v in outL), max(abs(v) for v in outR))
target = 10 ** (-3.0 / 20)
sc = min(1.0, target / peak)

out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'audio.wav')
data = array.array('h', [0] * (2 * N))
for i in range(N):
    data[2 * i] = int(round(max(-1.0, min(1.0, outL[i] * sc)) * 32767))
    data[2 * i + 1] = int(round(max(-1.0, min(1.0, outR[i] * sc)) * 32767))
with wave.open(out_path, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print(f'audio: {out_path} {N / SR:.3f}s peak {20 * math.log10(peak * sc):.2f} dBFS')
