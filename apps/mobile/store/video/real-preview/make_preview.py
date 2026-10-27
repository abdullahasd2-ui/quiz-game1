#!/usr/bin/env python3
"""معاينة App Store من تسجيل شاشة حقيقي للعبة (محاكي iPhone 17 Pro Max): مقاطع من التسجيل + نصوص علوية + تلاشي بسيط + خاتمة قصيرة.
الاستعمال: python3 -I make_preview.py RECORDING.mp4 WORKDIR OUT.mp4  (يحتاج ffmpeg وChrome وPillow وملف make_audio.py بجانبه)"""
import html, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

REC, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
FONT = f'{ROOT}/node_modules/@fontsource/tajawal/files'
ICON = f'{ROOT}/apps/web/public/icons/app-icon-action.png'
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
FFMPEG = os.environ.get('FFMPEG', '/opt/homebrew/bin/ffmpeg')
W, H = 886, 1920
FW, FH, FX, FY, RAD = 800, 1738, 43, 150, 100   # مكان اللقطة داخل الإطار
XF, XF_END = 0.2, 0.4
os.makedirs(WORK, exist_ok=True)

# (اسم، بداية، نهاية بالثواني من التسجيل، السرعة، نص الشريط العلوي)
SEGS = [
    ('A', 6.4, 9.6, 1.0, 'اختر نوع اللعبة وأنشئ غرفة'),
    ('B', 25.6, 28.2, 1.0, 'شارك الكود وينضم خصمك'),
    ('C', 47.4, 53.2, 1.6, 'اختاروا الفئات اللي تحبونها'),
    ('D', 61.2, 62.5, 1.0, ''),
    ('E1', 62.7, 64.5, 1.0, 'اختر السؤال بالنقاط'),
    ('E2', 76.9, 79.0, 1.0, ''),
    ('F', 80.0, 82.0, 1.0, 'جاوب أو بادل… قرارك سرّي'),
    ('F2', 90.0, 92.4, 1.0, ''),
    ('G', 96.6, 98.6, 1.0, 'اختر إجابتك قبل انتهاء الوقت'),
    ('H1', 108.9, 111.3, 1.0, ''),
    ('H3', 118.0, 121.8, 1.0, 'النتيجة تظهر فورًا'),
]
END_DUR = 1.8


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit('فشل: ' + ' '.join(cmd[:4]) + '\n' + r.stderr[-1500:])


def chrome_png(body, out, w, h, transparent):
    page = out + '.html'
    css = (f'@font-face{{font-family:T;font-weight:900;src:url("file://{FONT}/tajawal-arabic-900-normal.woff2")}}'
           f'@font-face{{font-family:T;font-weight:700;src:url("file://{FONT}/tajawal-arabic-700-normal.woff2")}}'
           f'*{{margin:0;box-sizing:border-box}}html,body{{width:{w}px;height:{h}px;overflow:hidden;font-family:T,sans-serif;direction:rtl}}')
    open(page, 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><style>{css}</style>{body}')
    raw = out + '.raw.png'
    args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
            f'--window-size={w},{h + 200}', f'--screenshot={raw}', '--virtual-time-budget=4000']
    if transparent:
        args.append('--default-background-color=00000000')
    sh(args + [f'file://{page}'])
    im = Image.open(raw).convert('RGBA').crop((0, 0, w, h))
    im.save(out)


# ---- خلفية وقناع وإطار
def rounded(size, radius, fill):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=fill); return m

bg = Image.new('RGB', (W, H), (7, 7, 26))
glow = Image.new('RGB', (W, H), (0, 0, 0)); gd = ImageDraw.Draw(glow)
gd.ellipse((W * 0.2, -H * 0.12, W * 1.25, H * 0.28), fill=(110, 50, 190)); gd.ellipse((-W * 0.35, H * 0.55, W * 0.7, H * 1.05), fill=(25, 90, 150))
glow = glow.filter(ImageFilter.GaussianBlur(160))
bg = Image.blend(bg, Image.eval(glow, lambda v: min(255, v)), 0.55); bg.save(f'{WORK}/bg.png')
rounded((FW, FH), RAD, 255).save(f'{WORK}/mask.png')
fr = Image.new('RGBA', (W, H), (0, 0, 0, 0))
halo = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(halo).rounded_rectangle((FX - 6, FY - 6, FX + FW + 6, FY + FH + 6), RAD + 6, outline=(168, 85, 247, 170), width=10)
fr = Image.alpha_composite(fr, halo.filter(ImageFilter.GaussianBlur(16)))
ImageDraw.Draw(fr).rounded_rectangle((FX - 2, FY - 2, FX + FW + 2, FY + FH + 2), RAD + 2, outline=(255, 255, 255, 70), width=3)
fr.save(f'{WORK}/frame.png')
Image.new('RGBA', (W, 150), (0, 0, 0, 0)).save(f'{WORK}/cap_none.png')

# ---- النصوص والخاتمة
for name, _, _, _, text in SEGS:
    if text:
        chrome_png(f'<div style="height:150px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:{50 if len(text) > 24 else 58}px;white-space:nowrap;color:#f7c948;'
                   f'text-shadow:0 0 30px rgba(247,201,72,.38),0 3px 0 rgba(0,0,0,.45)">{html.escape(text)}</div>', f'{WORK}/cap_{name}.png', W, 150, True)
chrome_png(f'''<div style="width:{W}px;height:{H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:46px;
 background:radial-gradient(900px 700px at 80% 12%,rgba(130,60,210,.55),transparent 70%),radial-gradient(800px 700px at 10% 90%,rgba(30,110,170,.45),transparent 70%),#07071a">
 <img src="file://{ICON}" style="width:300px;height:300px;border-radius:68px;box-shadow:0 0 90px rgba(168,85,247,.65)">
 <div style="font-weight:900;font-size:104px;line-height:1.1"><span style="color:#a855f7">جاوب</span> <span style="font-size:70px;color:#fff">أو</span> <span style="color:#38bdf8">بادل</span></div>
 <div style="font-weight:700;font-size:44px;color:rgba(255,255,255,.7)">لعبة أسئلة جماعية بين فريقين</div></div>''', f'{WORK}/end.png', W, H, False)

# ---- مقاطع اللقطات (قص من التسجيل، 30 إطارًا، بدون صوت)
durs = []
for name, s, e, sp, _ in SEGS:
    d = (e - s) / sp; durs.append(d)
    sh([FFMPEG, '-y', '-v', 'error', '-ss', str(s), '-t', str(e - s), '-i', REC, '-an', '-vf',
        f'setpts=(PTS-STARTPTS)/{sp},fps=30,scale={FW}:{FH}:flags=lanczos,format=yuv420p', '-t', f'{d:.3f}',
        '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/seg_{name}.mp4'])

# ---- تركيب كل مقطع على الخلفية مع نصه
for (name, _, _, _, text), d in zip(SEGS, durs):
    cap = f'{WORK}/cap_{name}.png' if text else f'{WORK}/cap_none.png'
    fc = (f'[1:v][2:v]alphamerge[fg];[0:v][fg]overlay={FX}:{FY}:format=auto[b1];[b1][3:v]overlay=0:0:format=auto[b2];'
          f'[4:v]format=rgba,fade=t=in:st=0.12:d=0.25:alpha=1,fade=t=out:st={max(0.2, d - 0.4):.3f}:d=0.25:alpha=1[cap];'
          f'[b2][cap]overlay=0:0:format=auto,format=yuv420p,fps=30[o]')
    sh([FFMPEG, '-y', '-v', 'error',
        '-loop', '1', '-framerate', '30', '-t', f'{d:.3f}', '-i', f'{WORK}/bg.png', '-i', f'{WORK}/seg_{name}.mp4',
        '-loop', '1', '-framerate', '30', '-t', f'{d:.3f}', '-i', f'{WORK}/mask.png',
        '-loop', '1', '-framerate', '30', '-t', f'{d:.3f}', '-i', f'{WORK}/frame.png',
        '-loop', '1', '-framerate', '30', '-t', f'{d:.3f}', '-i', cap,
        '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/comp_{name}.mp4'])
sh([FFMPEG, '-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-t', str(END_DUR), '-i', f'{WORK}/end.png', '-vf',
    f'fade=t=in:st=0:d=0.3,format=yuv420p,fps=30', '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/comp_END.mp4'])

# ---- دمج بتلاشي بسيط فقط
names = [s[0] for s in SEGS] + ['END']; all_d = durs + [END_DUR]
cmd = [FFMPEG, '-y', '-v', 'error']
for n in names:
    cmd += ['-i', f'{WORK}/comp_{n}.mp4']
chain, cum, last = [], all_d[0], '[0:v]'
for k in range(1, len(names)):
    xd = XF_END if k == len(names) - 1 else XF
    tag = f'[x{k}]'
    chain.append(f'{last}[{k}:v]xfade=transition=fade:duration={xd}:offset={cum - xd:.3f}{tag}')
    cum += all_d[k] - xd; last = tag
TOTAL = cum
print(f'المدة الكلية: {TOTAL:.2f} ثانية')
sh(cmd + ['-filter_complex', ';'.join(chain), '-map', last, '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/joined.mp4'])

# ---- الصوت والترميز النهائي (مواصفات أبل: H.264 High 4.0 بمعدل 10–12 ميغابت، AAC ستريو 48kHz)
sh([sys.executable, '-I', os.path.join(HERE, 'make_audio.py'), f'{WORK}/music.wav', f'{TOTAL:.3f}'])
sh([FFMPEG, '-y', '-v', 'error', '-i', f'{WORK}/joined.mp4', '-i', f'{WORK}/music.wav', '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-r', '30', '-b:v', '11M', '-minrate', '11M', '-maxrate', '11M', '-bufsize', '22M', '-x264-params', 'nal-hrd=cbr',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', f'{TOTAL:.3f}', '-movflags', '+faststart', OUT])
print('تم:', OUT)
