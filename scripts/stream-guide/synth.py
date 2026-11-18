"""Voice for the guide: each line of narration.json (fully voweled Arabic) read by espeak-ng with the MBROLA ar1 voice.
Writes out/<key>.wav and out/durations.json (record.cjs times each step to its line).
Needs: apt install espeak-ng mbrola mbrola-ar1, and the ar1 table patched so espeak's «R» maps to MBROLA «r»
(espeak-ng --compile-mbrola=<ar1 file with the line `0 R NULL 0 r` added>), or every ر is silent."""
import json, os, subprocess

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, 'out')
os.makedirs(out, exist_ok=True)
lines = json.load(open(os.path.join(here, 'narration.json')))
dur = {}
for k, text in lines.items():
    raw, wav = os.path.join(out, f'{k}.raw.wav'), os.path.join(out, f'{k}.wav')
    err = subprocess.run(['espeak-ng', '-v', 'mb-ar1', '-s', '140', '-p', '45', '-w', raw, text], capture_output=True, text=True).stderr
    if 'unknown' in err:
        raise SystemExit(f'{k}: missing sounds in the voice (reword the line):\n{err}')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', 'highpass=f=80,loudnorm=I=-16:TP=-1.5,aresample=48000', '-ac', '2', wav], check=True)
    dur[k] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]))
json.dump(dur, open(os.path.join(out, 'durations.json'), 'w'), indent=1)
print(dur)
