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
# CUT=tour: the app's interactive tour «اكتشف طريقة اللعب» playing itself (labelled «تجربة تعليمية» on screen), then
# real multiplayer footage: friends joining and a real result, so the preview ends on the game itself.
CUT = os.environ.get('CUT', 'game')
if CUT == 'tour':
    tm = json.load(open(os.path.join(REC, 'tour', 'marks.json')))
    tour_len = round(tm['s:final'] - tm['s:intro'] + 2.6, 2)
    rest = 29.9 - tour_len + 2 * XF
    SEGMENTS = [
        ('tour', 's:intro', 0.0, tour_len, None),
        ('game', 'joined1', -0.5, round(rest / 2, 2), 'c10'),
        ('game', 'result', -0.1, round(rest - round(rest / 2, 2), 2), 'c11'),
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
    run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', f'scale={W}:{H}:flags=lanczos+accurate_rnd+full_chroma_int,unsharp=5:5:0.45:3:3:0.0,fps={FPS},format=yuv420p', '-c:v', 'libx264', '-crf', '8', '-preset', 'medium', out])
    return out, fr[0]['t'], json.load(open(os.path.join(REC, take, 'marks.json')))


takes = {t: take_video(t) for t in sorted({s[0] for s in SEGMENTS})}

# Each segment, with its caption faded in over the footage.
segs = []
starts = []
t = 0.0
for i, (take, mark, off, dur, cap) in enumerate(SEGMENTS):
    src, t0, marks = takes[take]
    ss = marks[mark] - t0 + off
    out = os.path.join(OUT, f'seg{i}.mp4')
    if cap is None:
        run(['ffmpeg', '-y', '-ss', f'{ss:.3f}', '-t', f'{dur:.3f}', '-i', src, '-vf', f'fps={FPS},format=yuv420p', '-an', '-c:v', 'libx264', '-crf', '8', '-preset', 'medium', out])
    else:
        png = os.path.join(CAPS, f'{cap}.png')
        run(['ffmpeg', '-y', '-ss', f'{ss:.3f}', '-t', f'{dur:.3f}', '-i', src, '-loop', '1', '-t', f'{dur:.3f}', '-i', png,
             '-filter_complex', f"[1:v]format=rgba,fade=t=in:st=0.15:d=0.35:alpha=1[c];[0:v][c]overlay=0:0:format=auto,fps={FPS},format=yuv420p[v]",
             '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '8', '-preset', 'medium', out])
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
run(['ffmpeg', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', prev, '-c:v', 'libx264', '-crf', '8', '-preset', 'medium', '-r', str(FPS), picture])

# The sound: effects on the cuts and on what happens in the footage (no voice; music optional).
events = []
for i, s0 in enumerate(starts):
    if i:
        events.append({'t': round(s0, 3), 's': 'whoosh', 'v': 0.7})
if CUT == 'tour':
    t0 = tm['s:intro']
    at = lambda k, d=0.0: round(tm[k] - t0 + d, 3)
    events = [{'t': starts[1], 's': 'whoosh', 'v': 0.7}, {'t': starts[2], 's': 'whoosh', 'v': 0.7}]
    events += [{'t': 0.4, 's': 'riser', 'v': 0.6}, {'t': 1.15, 's': 'impact', 'v': 0.9}, {'t': 1.25, 's': 'sparkle', 'v': 0.9}]
    for k in [k for k in tm if k.startswith('s:') and k not in ('s:intro',)]:
        events.append({'t': at(k), 's': 'whoosh', 'v': 0.6})
    events += [{'t': at('s:اختاروا 3 فئات', 0.9 + i * 0.52), 's': 'pop', 'v': 1} for i in range(3)]
    events += [
        {'t': at('s:اختاروا سؤال من اللوحة', 1.5), 's': 'click', 'v': 1},
        {'t': at('s:قراركم السري', 2.3), 's': 'stamp', 'v': 1},
        {'t': at('s:جاوبوا!', 1.7), 's': 'click', 'v': 1},
        {'t': at('s:جاوبوا!', 2.45), 's': 'ding', 'v': 1},
        {'t': at('s:جاوبوا!', 2.5), 's': 'sparkle', 'v': 0.8},
        {'t': at('s:final', 0.1), 's': 'impact', 'v': 0.9},
        {'t': at('s:final', 0.2), 's': 'sparkle', 'v': 1},
        {'t': starts[1] + 0.5, 's': 'pop', 'v': 1},
        {'t': starts[2] + 0.3, 's': 'ding', 'v': 1},
    ]
    events = [e for e in events if 0 <= e['t'] < TOTAL]
    tl = {'total': TOTAL, 'drop': 1.15, 'events': sorted(events, key=lambda e: e['t']), 'voice': [], 'scenes': [{'key': 'end', 'start': starts[2]}]}
events_game = [] if CUT == 'tour' else [
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
if CUT != 'tour':
    events += events_game
    for k in range(8):
        events.append({'t': round(starts[7] + 0.3 + k * 0.45, 3), 's': 'tick', 'v': 0.6})
    tl = {'total': TOTAL, 'drop': 0.9, 'events': sorted(events, key=lambda e: e['t']), 'voice': [], 'scenes': [{'key': 'end', 'start': starts[8]}]}
json.dump(tl, open(os.path.join(here, 'timeline-preview.json'), 'w'), indent=1)
env = dict(os.environ, TL='timeline-preview.json', MIX='mix-preview.wav', NO_MUSIC=os.environ.get('NO_MUSIC', '1'))
subprocess.run(['python3', os.path.join(here, 'audio.py')], check=True, env=env)

# Final encode to Apple's App Preview spec.
final = os.path.join(OUT, f'jawab-badel-app-preview{"-tour" if CUT == "tour" else ""}-{W}x{H}.mp4')
run(['ffmpeg', '-y', '-i', picture, '-i', os.path.join(here, 'mix-preview.wav'),
     '-map', '0:v', '-map', '1:a', '-t', f'{TOTAL:.3f}',
     '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', '-r', str(FPS),
     '-b:v', '11.8M', '-maxrate', '12M', '-bufsize', '24M', '-preset', 'veryslow', '-tune', 'animation', '-x264-params', 'nal-hrd=vbr:aq-mode=3:deblock=-1,-1',
     '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2',
     '-movflags', '+faststart', final])
print('total', round(TOTAL, 3), 's ->', final)
