"""Puts together what the stage needs: fonts.css (Lalezar + Tajawal from @fontsource, embedded), the logos with a
transparent background (assets/), the voice lines (voice/ from ../out) and data.js (shots + voice lengths)."""
import base64, json, os, shutil
import numpy as np
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
repo = os.path.join(here, '..', '..', '..')
fs = os.path.join(here, 'node_modules', '@fontsource')  # npm i @fontsource/lalezar @fontsource/tajawal (in this folder)


def face(fam, rel, w):
    b = base64.b64encode(open(os.path.join(fs, rel), 'rb').read()).decode()
    return f"@font-face{{font-family:'{fam}';font-weight:{w};font-display:block;src:url(data:font/woff2;base64,{b}) format('woff2');}}\n"


css = face('Lalezar', 'lalezar/files/lalezar-arabic-400-normal.woff2', 400) + face('Lalezar', 'lalezar/files/lalezar-latin-400-normal.woff2', 400)
for w in (400, 500, 700, 800, 900):
    for sub in ('arabic', 'latin'):
        rel = f'tajawal/files/tajawal-{sub}-{w}-normal.woff2'
        if os.path.exists(os.path.join(fs, rel)):
            css += face('Tajawal', rel, w)
open(os.path.join(here, 'fonts.css'), 'w').write(css)

os.makedirs(os.path.join(here, 'assets'), exist_ok=True)
for f in ('app-icon.png', 'app-icon-action-v2.png'):
    im = np.asarray(Image.open(os.path.join(repo, 'apps/web/public/icons', f)).convert('RGB')).astype(float)
    c = np.concatenate([im[:40, :40].reshape(-1, 3), im[-40:, -40:].reshape(-1, 3)])
    bg = np.median(c, 0)
    a = np.clip((np.sqrt(((im - bg) ** 2).sum(2)) - 14) / 50, 0, 1)
    rgb = np.where(a[..., None] > 0.01, (im - bg * (1 - a[..., None])) / np.maximum(a[..., None], 0.01), 0)
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8), 'RGBA').save(os.path.join(here, 'assets', f.replace('.png', '-t.png')))

os.makedirs(os.path.join(here, 'voice'), exist_ok=True)
dur = json.load(open(os.path.join(here, '..', 'out', 'durations.json')))
for k in dur:
    shutil.copy(os.path.join(here, '..', 'out', f'{k}.wav'), os.path.join(here, 'voice', f'{k}.wav'))
shots = json.load(open(os.path.join(here, 'shots', 'shots.json')))
open(os.path.join(here, 'data.js'), 'w').write('window.SHOTS=' + json.dumps(shots) + ';window.DUR=' + json.dumps(dur) + ';')
print('ready')
