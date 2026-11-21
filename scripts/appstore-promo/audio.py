"""Music, sound effects and the voice, mixed to the stage's timeline (timeline.json) -> mix.wav (48 kHz stereo)."""
import json, os, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
here = os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(here, os.environ.get('TL', 'timeline.json'))))
TOTAL = tl['total']
N = int(TOTAL * SR)
rng = np.random.default_rng(3)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=None, d=None):
    """attack then exponential decay (d = time constant)"""
    e = np.ones(n)
    na = max(1, int(a * SR))
    e[:na] = np.linspace(0, 1, na)
    if d:
        e[na:] *= np.exp(-np.arange(n - na) / (d * SR))
    if r:
        nr = min(n, int(r * SR))
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def sos(kind, f, order=2):
    if kind == 'bp':
        return signal.butter(order, [f[0] / (SR / 2), f[1] / (SR / 2)], 'bandpass', output='sos')
    return signal.butter(order, f / (SR / 2), kind, output='sos')


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def sweep_filter(x, f0, f1, kind='bp', q=0.35, block=256):
    """a filter whose frequency glides from f0 to f1 (log), block by block"""
    out = np.zeros_like(x)
    nb = len(x) // block + 1
    zi = None
    for i in range(nb):
        k = i / max(1, nb - 1)
        f = f0 * (f1 / f0) ** k
        if kind == 'bp':
            s = sos('bp', (f * (1 - q), min(f * (1 + q), SR / 2 - 100)))
        else:
            s = sos(kind, min(f, SR / 2 - 100))
        if zi is None or zi.shape != (s.shape[0], 2):
            zi = np.zeros((s.shape[0], 2))
        seg = x[i * block:(i + 1) * block]
        if not len(seg):
            break
        y, zi = signal.sosfilt(s, seg, zi=zi)
        out[i * block:i * block + len(seg)] = y
    return out


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def reverb(x, secs=1.2, mix=0.25):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (secs * SR / 5))
    ir = filt(ir, 'lowpass', 6000)
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + norm(wet, np.max(np.abs(x)) or 1) * mix


# ---------------- sound effects ----------------
def sfx_whoosh():
    d = 0.6
    n = rng.standard_normal(int(d * SR))
    y = sweep_filter(n, 400, 5000, 'bp', 0.5)
    e = np.sin(np.linspace(0, np.pi, len(y))) ** 2
    return norm(y * e, 0.5)


def sfx_riser():
    d = 2.72
    tt = t_(d)
    n = sweep_filter(rng.standard_normal(len(tt)), 200, 9000, 'bp', 0.4)
    f = 110 * (8 ** (tt / d))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.15
    e = (tt / d) ** 2
    return norm((n * 0.7 + tone) * e, 0.55)


def sfx_hit():
    tt = t_(0.5)
    f = 160 * np.exp(-tt * 18) + 45
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.001, d=0.12)
    crack = filt(rng.standard_normal(len(tt)), 'highpass', 1800) * env(len(tt), 0.001, d=0.03)
    return norm(body + crack * 0.5, 0.9)


def sfx_impact():
    tt = t_(2.2)
    f = 90 * np.exp(-tt * 6) + 32
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.002, d=0.55)
    noise = filt(rng.standard_normal(len(tt)), 'lowpass', 3000) * env(len(tt), 0.001, d=0.18)
    y = reverb(sub + noise * 0.6, 1.8, 0.3)
    return norm(y, 1.0)


def sfx_tick():
    tt = t_(0.05)
    return np.sin(2 * np.pi * 2600 * tt) * env(len(tt), 0.0005, d=0.008) * 0.45


def sfx_click():
    tt = t_(0.12)
    y = np.sin(2 * np.pi * 1400 * tt) * env(len(tt), 0.0005, d=0.012) + filt(rng.standard_normal(len(tt)), 'highpass', 3000) * env(len(tt), 0.0005, d=0.006) * 0.5
    low = np.sin(2 * np.pi * 180 * tt) * env(len(tt), 0.001, d=0.03) * 0.6
    return norm(y + low, 0.7)


def sfx_pop():
    tt = t_(0.14)
    f = 1100 * np.exp(-tt * 22) + 380
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.001, d=0.05) * 0.55


def sfx_ding():
    tt = t_(1.6)
    y = sum(a * np.sin(2 * np.pi * 1318.5 * r * tt) * np.exp(-tt * k) for r, a, k in [(1, 1, 3), (2.0, 0.5, 4), (3.01, 0.25, 6), (4.2, 0.12, 8)])
    y += sum(a * np.sin(2 * np.pi * 1975.5 * r * tt) * np.exp(-tt * k) for r, a, k in [(1, 0.7, 3.2), (2.0, 0.3, 5)]) * (tt > 0.09)
    return norm(reverb(y * env(len(tt), 0.002), 1.2, 0.25), 0.55)


def sfx_stamp():
    tt = t_(0.6)
    f = 120 * np.exp(-tt * 25) + 60
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.001, d=0.08)
    chunk = filt(rng.standard_normal(len(tt)), 'bp' if False else 'lowpass', 2500) * env(len(tt), 0.001, d=0.04)
    return norm(reverb(body + chunk * 0.7, 0.6, 0.2), 0.85)


def sfx_sparkle():
    d = 1.6
    y = np.zeros(int(d * SR))
    for _ in range(26):
        st = rng.uniform(0, 1.2)
        f = rng.uniform(2500, 6000)
        tt = t_(0.18)
        g = np.sin(2 * np.pi * f * tt) * env(len(tt), 0.001, d=0.04) * rng.uniform(0.2, 0.5)
        i = int(st * SR)
        y[i:i + len(g)] += g[: len(y) - i]
    return norm(reverb(y, 1.0, 0.35), 0.45)


SFX = {k[4:]: v() for k, v in list(globals().items()) if k.startswith('sfx_')}

# ---------------- music ----------------
BPM = 120
BEAT = 60 / BPM
T0 = tl.get('drop', 2.72)  # the drop, when the logo lands
END_HIT = next(s['start'] for s in tl['scenes'] if s['key'] == 'end') + 0.2
A4 = 440


def hz(midi):
    return A4 * 2 ** ((midi - 69) / 12)


def saw(f, d, detune=0.0):
    tt = t_(d)
    ph = (f * (1 + detune) * tt) % 1
    return 2 * ph - 1


def add(buf, x, at, gain=1.0):
    i = int(at * SR)
    if i >= len(buf) or i + len(x) <= 0:
        return
    j = min(len(buf), i + len(x))
    if i < 0:
        x = x[-i:]
        i = 0
    buf[i:j] += x[: j - i] * gain


# A minor with a Hijaz turn: Am | F | G | E (E major: the G# gives the Arabic colour)
CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]]
BASS = [45, 41, 43, 40]
kick = np.zeros(N); snare = np.zeros(N); hats = np.zeros(N); bass = np.zeros(N); pad = np.zeros(N); arp = np.zeros(N)


def mk_kick():
    tt = t_(0.45)
    f = 140 * np.exp(-tt * 30) + 48
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(tt), 0.001, d=0.16) + filt(rng.standard_normal(len(tt)), 'highpass', 4000) * env(len(tt), 0.0005, d=0.004) * 0.3


def mk_snare():
    tt = t_(0.3)
    n = filt(rng.standard_normal(len(tt)), 'bp', (1200, 7000)) * env(len(tt), 0.001, d=0.07)
    b = np.sin(2 * np.pi * 190 * tt) * env(len(tt), 0.001, d=0.05)
    return reverb(n * 0.8 + b * 0.5, 0.5, 0.2)


def mk_hat(open_=False):
    tt = t_(0.25 if open_ else 0.06)
    return filt(rng.standard_normal(len(tt)), 'highpass', 8000) * env(len(tt), 0.0005, d=0.06 if open_ else 0.012)


K, S, Hc, Ho = mk_kick(), mk_snare(), mk_hat(), mk_hat(True)
end_music = END_HIT - 0.05
beats = int((end_music - T0) / BEAT)
for b in range(beats):
    at = T0 + b * BEAT
    bar = b // 4
    chord = (b // 8) % 4
    # intro groove: first 2 bars kick only on 1, then full
    add(kick, K, at, 1.0 if b >= 8 or b % 4 == 0 else 0.0)
    if b >= 8 and b % 4 in (1, 3):
        add(snare, S, at, 0.8)
    if b >= 4:
        add(hats, Hc, at, 0.35)
        add(hats, Ho if b % 2 else Hc, at + BEAT / 2, 0.5 if b % 2 else 0.4)
        if b >= 16:
            add(hats, Hc, at + BEAT / 4, 0.18); add(hats, Hc, at + 3 * BEAT / 4, 0.18)
    # bass: 8th notes, root with an octave jump on the off-beat
    for h in range(2):
        f = hz(BASS[chord] + (12 if h == 1 and b % 2 else 0))
        x = (saw(f, BEAT / 2 * 0.9) * 0.6 + np.sin(2 * np.pi * f * t_(BEAT / 2 * 0.9))) * env(int(BEAT / 2 * 0.9 * SR), 0.004, r=0.03)
        add(bass, x, at + h * BEAT / 2, 0.9)
    # pad: one long chord every 2 bars
    if b % 8 == 0:
        d = 8 * BEAT
        x = sum(saw(hz(m), d, dt) for m in CHORDS[chord] for dt in (-0.004, 0.004)) / 6
        x *= env(len(x), 0.4, r=0.6)
        add(pad, x, at, 1)
    # arpeggio (16ths) once the explanation is under way
    if at > 11 and at < end_music - 1:
        for q in range(4):
            notes = CHORDS[chord]
            m = notes[(b * 4 + q) % 3] + 24 - (12 if q == 3 else 0)
            x = (saw(hz(m), 0.12) * 0.4 + np.sin(2 * np.pi * hz(m) * t_(0.12))) * env(int(0.12 * SR), 0.002, d=0.05)
            add(arp, x, at + q * BEAT / 4, 0.5)

bass = filt(bass, 'lowpass', 700)
pad = filt(pad, 'lowpass', 2200)
arp = reverb(filt(arp, 'lowpass', 5000), 1.0, 0.3)
music = kick * 0.9 + snare * 0.55 + hats * 0.28 + bass * 0.5 + pad * 0.32 + arp * 0.16
# the last hit and a held chord to close
fin = sum(saw(hz(m), 4.0, dt) for m in [45, 57, 60, 64, 69] for dt in (-0.003, 0.003)) / 10
fin = filt(fin * env(len(fin), 0.01, d=1.6), 'lowpass', 2600)
add(music, reverb(fin, 2.0, 0.35) * 0.6, END_HIT)
add(music, K, END_HIT, 1.0)
music = np.tanh(music * 1.2) / 1.2  # glue

# ---------------- voice ----------------
voice = np.zeros(N)
for v in tl['voice']:
    sr, x = wavfile.read(os.path.join(here, 'voice', v['key'] + '.wav'))
    x = x.astype(np.float64)
    if x.ndim > 1:
        x = x.mean(1)
    x /= 32768 if np.max(np.abs(x)) > 2 else 1
    if sr != SR:
        x = signal.resample_poly(x, SR, sr)
    add(voice, x, v['t'])
voice = filt(voice, 'highpass', 70)
voice = norm(voice, 0.95) if np.max(np.abs(voice)) > 0 else voice

# duck the music under the voice (smooth envelope, -9 dB)
venv = np.abs(voice)
venv = filt(venv, 'lowpass', 4)
venv = np.clip(venv / ((np.max(venv) or 1) * 0.08), 0, 1)
venv = filt(venv, "lowpass", 3)
duck = 1 - 0.72 * np.clip(venv, 0, 1)
music *= duck

# ---------------- sound effects on the cues ----------------
fxb = np.zeros(N)
for e in tl['events']:
    x = SFX.get(e['s'])
    if x is None:
        print('no sfx', e['s'], file=sys.stderr)
        continue
    add(fxb, x, e['t'], e.get('v', 1))

# NO_MUSIC=1: the sound effects only (no music bed).
NO_MUSIC = os.environ.get('NO_MUSIC') == '1'
if NO_MUSIC:
    music = music * 0
mix = voice * 1.0 + music * 0.6 + fxb * (0.9 if NO_MUSIC else 0.5)
# fade the very end
fade = int(0.8 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)
mix = norm(mix, 0.97)
st = np.stack([mix, mix], 1)
# a little width for music/fx only: delay one side slightly
wide = (music * 0.55 + fxb * 0.5)
d = int(0.012 * SR)
st[d:, 1] += wide[:-d] * 0.12
st[:, 0] -= np.concatenate([np.zeros(d), wide[:-d]]) * 0.0
st = st / np.max(np.abs(st)) * 0.97
wavfile.write(os.path.join(here, os.environ.get('MIX') or ('mix-fx.wav' if NO_MUSIC else 'mix.wav')), SR, (st * 32767).astype(np.int16))
print('mix', round(TOTAL, 2), 's')
