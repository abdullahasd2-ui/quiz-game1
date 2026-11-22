"""App Store app preview (iPhone 6.9"/6.7"/6.5"/6.3"/6.1", portrait 886x1920) cut from the real recordings in rec/.

Every picture is the app itself: segments of the screen recordings, joined by short cross-fades, with Arabic captions
laid on top (text overlays are allowed; nothing of the app is invented). Output follows Apple's App Preview spec:
  886x1920, 29.9 s (15-30 s), 30 fps constant, H.264 High@4.0 progressive ~11 Mbps, yuv420p,
  AAC-LC stereo 256 kb/s 48 kHz, .mp4, far under 500 MB.
Run: python3 edit-preview.py  (needs rec/ from record-app.cjs, caption PNGs from captions.cjs, ffmpeg)
"""
import json, os, subprocess, bisect

here = os.path.dirname(os.path.abspath(__file__))
IPAD = os.environ.get('IPAD') == '1'
REC = os.path.join(here, 'rec-ipad' if IPAD else 'rec')
OUT = os.path.join(here, 'preview-ipad' if IPAD else 'preview-iphone')
CAPS = os.path.join(here, 'captions-ipad' if IPAD else 'captions')
os.makedirs(OUT, exist_ok=True)
W, H, FPS = (1200, 1600, 30) if IPAD else (886, 1920, 30)
XF = 0.35  # cross-fade length

# (take, mark, offset from the mark, length, caption key)
SEGMENTS = [
    ('game', 'home', 0.2, 3.6, 'c1'),
    ('game', 'scroll', 2.3, 2.8, 'c2'),
    ('game', 'create', -0.3, 4.0, 'c3'),
    ('game', 'joined1', -0.5, 2.6, 'c4'),
    ('game', 'cats', 0.1, 3.0, 'c5'),
    ('game', 'board', 0.6, 5.0, 'c6'),
    ('game', 'result', -0.1, 4.0, 'c7'),
    ('list', 'type', 0.0, 4.0, 'c8'),
    ('game', 'final', 0.0, 3.7, 'c9'),
]
TOTAL = sum(s[3] for s in SEGMENTS) - XF * (len(SEGMENTS) - 1)


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def take_video(take):
    """The recording as a constant 30 fps video: each screencast frame held until the next one arrived."""
    out = os.path.join(OUT, f'take-{take}.mp4')
    fr = json.load(open(os.path.join(REC, take, 'frames.json')))
    lst = os.path.join(OUT, f'take-{take}.txt')
    with open(lst, 'w') as f:
        for i, x in enumerate(fr):
            d = (fr[i + 1]['t'] - x['t']) if i + 1 < len(fr) else 1.0
            f.write(f"file '{os.path.join(REC, take, 'frames', x['f'])}'\nduration {max(d, 0.001):.4f}\n")
        f.write(f"file '{os.path.join(REC, take, 'frames', fr[-1]['f'])}'\n")
    run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', f'scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p', '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', out])
    return out, fr[0]['t'], json.load(open(os.path.join(REC, take, 'marks.json')))


takes = {t: take_video(t) for t in sorted({s[0] for s in SEGMENTS})}

# Each segment, with its caption faded in over the footage.
segs = []
starts = []
t = 0.0
for i, (take, mark, off, dur, cap) in enumerate(SEGMENTS):
    src, t0, marks = takes[take]
    ss = marks[mark] - t0 + off
    png = os.path.join(CAPS, f'{cap}.png')
    out = os.path.join(OUT, f'seg{i}.mp4')
    run(['ffmpeg', '-y', '-ss', f'{ss:.3f}', '-t', f'{dur:.3f}', '-i', src, '-loop', '1', '-t', f'{dur:.3f}', '-i', png,
         '-filter_complex', f"[1:v]format=rgba,fade=t=in:st=0.15:d=0.35:alpha=1[c];[0:v][c]overlay=0:0:format=auto,fps={FPS},format=yuv420p[v]",
         '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', out])
    segs.append(out)
    starts.append(t)
    t += dur - XF

# Cross-fade them into one picture.
inputs = sum((['-i', s] for s in segs), [])
fc = []
prev = '[0:v]'
acc = SEGMENTS[0][3]
for i in range(1, len(segs)):
    lab = f'[x{i}]'
    fc.append(f'{prev}[{i}:v]xfade=transition=fade:duration={XF}:offset={acc - XF:.3f}{lab}')
    prev = lab
    acc += SEGMENTS[i][3] - XF
picture = os.path.join(OUT, 'picture.mp4')
run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', prev, '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-r', str(FPS), picture])

# The sound: effects on the cuts and on what happens in the footage (no voice; music optional).
events = []
for i, s0 in enumerate(starts):
    if i:
        events.append({'t': round(s0, 3), 's': 'whoosh', 'v': 0.7})
events += [
    {'t': 0.0, 's': 'riser', 'v': 0.6},
    {'t': 0.9, 's': 'impact', 'v': 0.8},
    {'t': starts[2] + 0.9, 's': 'click', 'v': 1},  # typing the team name
    {'t': starts[2] + 3.0, 's': 'pop', 'v': 1},  # room created
    {'t': starts[3] + 0.5, 's': 'pop', 'v': 1},  # a friend joins
    {'t': starts[4] + 0.3, 's': 'click', 'v': 1},
    {'t': starts[4] + 0.75, 's': 'click', 'v': 1},
    {'t': starts[4] + 1.2, 's': 'click', 'v': 1},
    {'t': starts[5] + 0.6, 's': 'click', 'v': 1},  # a cell on the board
    {'t': starts[5] + 3.8, 's': 'stamp', 'v': 1},  # swap!
    {'t': starts[6] + 0.3, 's': 'ding', 'v': 1},  # the result
    {'t': starts[6] + 0.5, 's': 'sparkle', 'v': 0.8},
    {'t': starts[8] + 0.2, 's': 'impact', 'v': 0.9},
    {'t': starts[8] + 0.3, 's': 'sparkle', 'v': 1},
]
for k in range(8):
    events.append({'t': round(starts[7] + 0.3 + k * 0.45, 3), 's': 'tick', 'v': 0.6})
tl = {'total': TOTAL, 'drop': 0.9, 'events': sorted(events, key=lambda e: e['t']), 'voice': [], 'scenes': [{'key': 'end', 'start': starts[8]}]}
json.dump(tl, open(os.path.join(here, 'timeline-preview.json'), 'w'), indent=1)
env = dict(os.environ, TL='timeline-preview.json', MIX='mix-preview.wav', NO_MUSIC=os.environ.get('NO_MUSIC', '1'))
subprocess.run(['python3', os.path.join(here, 'audio.py')], check=True, env=env)

# Final encode to Apple's App Preview spec.
final = os.path.join(OUT, f'jawab-badel-app-preview-{W}x{H}.mp4')
run(['ffmpeg', '-y', '-i', picture, '-i', os.path.join(here, 'mix-preview.wav'),
     '-map', '0:v', '-map', '1:a', '-t', f'{TOTAL:.3f}',
     '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-r', str(FPS),
     '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M', '-preset', 'slow', '-x264-params', 'nal-hrd=vbr',
     '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
     '-movflags', '+faststart', final])
print('total', round(TOTAL, 3), 's ->', final)
