"""Cuts the recorded pages into the final guide video (apps/web/public/videos/stream-guide.mp4 + poster)."""
import json, os, subprocess, sys

out = os.environ.get('OUT', os.path.join(os.path.dirname(__file__), 'out'))
dest = os.path.join(os.path.dirname(__file__), '..', '..', 'apps', 'web', 'public', 'videos')
m = json.load(open(os.path.join(out, 'marks.json')))
order = ['S', 'B']
inputs, filters, labels = [], [], []
for k in order:
    inputs += ['-i', m[k]]
for i, s in enumerate(m['marks']):
    st, en = s['start'] + 0.15, s['end']
    d = en - st
    filters.append(f"[{order.index(s['who'])}:v]trim=start={st:.3f}:end={en:.3f},setpts=PTS-STARTPTS,fps=30,scale=1280:720,format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st={d-0.3:.3f}:d=0.3[v{i}]")
    labels.append(f'[v{i}]')
fc = ';'.join(filters) + ';' + ''.join(labels) + f'concat=n={len(labels)}:v=1:a=0[out]'
video = os.path.join(dest, 'stream-guide.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', fc, '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', video], check=True)
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '2', '-i', video, '-frames:v', '1', '-q:v', '4', video.replace('.mp4', '.jpg')], check=True)
print('written', video, file=sys.stderr)
