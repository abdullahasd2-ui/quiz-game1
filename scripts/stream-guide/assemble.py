"""Cuts the recorded pages into the final guide video with its voice (apps/web/public/videos/stream-guide.mp4 + poster)."""
import json, os, subprocess, sys

here = os.path.dirname(os.path.abspath(__file__))
out = os.environ.get('OUT', os.path.join(here, 'out'))
dest = os.path.join(here, '..', '..', 'apps', 'web', 'public', 'videos')
m = json.load(open(os.path.join(out, 'marks.json')))
order = ['S', 'B']
inputs, filters, pairs = [], [], []
for k in order:
    inputs += ['-i', m[k]]
for s in m['marks']:
    inputs += ['-i', os.path.join(out, s['key'] + '.wav')]
for i, s in enumerate(m['marks']):
    st, en = s['start'] + 0.15, s['end']
    d = en - st
    filters.append(f"[{order.index(s['who'])}:v]trim=start={st:.3f}:end={en:.3f},setpts=PTS-STARTPTS,fps=30,scale=1280:720,format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st={d-0.3:.3f}:d=0.3[v{i}]")
    # the voice line starts just after the step appears, padded with silence to the step's length
    filters.append(f"[{len(order)+i}:a]adelay=350|350,apad,atrim=0:{d:.3f},asetpts=PTS-STARTPTS[a{i}]")
    pairs.append(f'[v{i}][a{i}]')
fc = ';'.join(filters) + ';' + ''.join(pairs) + f'concat=n={len(pairs)}:v=1:a=1[outv][outa]'
video = os.path.join(dest, 'stream-guide.mp4')
tmp = video.replace('.mp4', '.tmp.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '[outv]', '-map', '[outa]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', tmp], check=True)
os.replace(tmp, video)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2', '-i', video, '-frames:v', '1', '-q:v', '4', video.replace('.mp4', '.jpg')], check=True)
print('written', video, file=sys.stderr)
