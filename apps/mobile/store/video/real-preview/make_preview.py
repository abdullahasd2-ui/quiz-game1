#!/usr/bin/env python3
"""معاينة App Store من تسجيل شاشة حقيقي للعبة (محاكي iPhone 17 Pro Max): **تسجيل الشاشة يملأ الإطار كله بلا أي إطار أو خلفية**،
وفوقه نصوص قصيرة فقط، وبين المقاطع تلاشٍ بسيط.

النسخة السابقة (تسجيل داخل إطار مدوّر على خلفية بنفسجية مع خاتمة بالأيقونة) رفضتها أبل في 2026-10-28 ببند 2.3.4:
«Includes framing around the video screen capture of the app». لذلك لا يوجد هنا قناع ولا إطار ولا خلفية ولا خاتمة.

الاستعمال: python3 -I make_preview.py RECORDING.mp4 WORKDIR OUT.mp4  (يحتاج ffmpeg وChrome وPillow وملف make_audio.py بجانبه)"""
import html, os, subprocess, sys
from PIL import Image

REC, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../../..'))
FONT = f'{ROOT}/node_modules/@fontsource/tajawal/files'
CHROME = os.environ.get('CHROME', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
FFMPEG = os.environ.get('FFMPEG', '/opt/homebrew/bin/ffmpeg')
W, H = 886, 1920   # مقاس معاينة آيفون في أبل
XF = 0.2           # مدة التلاشي بين المقاطع
os.makedirs(WORK, exist_ok=True)

# (اسم، بداية، نهاية بالثواني من التسجيل، السرعة، نص فوق اللقطة، [مكان النص: bottom افتراضيًا أو top])
SEGS = [
    ('A', 6.4, 9.6, 1.0, 'اختر نوع اللعبة وأنشئ غرفة', 'top'),
    ('B', 25.6, 28.2, 1.0, 'شارك الكود وينضم خصمك'),
    ('C', 47.4, 53.2, 1.6, 'اختاروا الفئات اللي تحبونها'),
    ('D', 61.2, 62.5, 1.0, ''),
    ('E1', 62.7, 64.5, 1.0, 'اختر السؤال بالنقاط'),
    ('E2', 76.9, 79.0, 1.0, ''),
    ('F', 80.0, 82.0, 1.0, 'جاوب أو بادل… قرارك سرّي'),
    ('F2', 90.0, 92.4, 1.0, ''),
    ('G', 96.6, 98.6, 1.0, 'اختر إجابتك قبل انتهاء الوقت'),
    ('H1', 108.9, 111.3, 1.0, ''),
    ('H3', 118.0, 122.6, 1.0, 'النتيجة تظهر فورًا'),
]


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit('فشل: ' + ' '.join(cmd[:4]) + '\n' + r.stderr[-1500:])


def chrome_png(body, out, w, h):
    """صفحة HTML شفافة بالمقاس الكامل، تُصوَّر بـ Chrome بدون واجهة."""
    page = out + '.html'
    css = (f'@font-face{{font-family:T;font-weight:900;src:url("file://{FONT}/tajawal-arabic-900-normal.woff2")}}'
           f'*{{margin:0;box-sizing:border-box}}html,body{{width:{w}px;height:{h}px;overflow:hidden;background:transparent;font-family:T,sans-serif;direction:rtl}}body{{position:relative}}')
    open(page, 'w', encoding='utf-8').write(f'<!doctype html><meta charset="utf-8"><style>{css}</style>{body}')
    raw = out + '.raw.png'
    sh([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
        f'--window-size={w},{h + 200}', f'--screenshot={raw}', '--virtual-time-budget=4000',
        '--default-background-color=00000000', f'file://{page}'])
    Image.open(raw).convert('RGBA').crop((0, 0, w, h)).save(out)


# ---- نصوص فقط: كبسولة صغيرة أسفل الشاشة (فوق منطقة فارغة في أغلب الشاشات)، بحجم الإطار كله
Image.new('RGBA', (W, H), (0, 0, 0, 0)).save(f'{WORK}/cap_none.png')
for name, _, _, _, text, *where in SEGS:
    if text:
        edge = 'top:140px' if where == ['top'] else 'bottom:150px'
        size = 46 if len(text) > 24 else 52
        chrome_png(
            f'<div style="position:absolute;left:0;right:0;{edge};display:flex;justify-content:center">'
            f'<div style="padding:18px 42px;border-radius:999px;background:rgba(7,7,26,.82);border:2px solid rgba(247,201,72,.55);'
            f'font-weight:900;font-size:{size}px;white-space:nowrap;color:#f7c948;text-shadow:0 2px 0 rgba(0,0,0,.5)">{html.escape(text)}</div></div>',
            f'{WORK}/cap_{name}.png', W, H)

# ---- مقاطع اللقطات: قص من التسجيل، 30 إطارًا، بمقاس الشاشة كاملًا (بلا قص ولا حواف)
durs = []
for name, s, e, sp, *_ in SEGS:
    d = (e - s) / sp
    durs.append(d)
    sh([FFMPEG, '-y', '-v', 'error', '-ss', str(s), '-t', str(e - s), '-i', REC, '-an', '-vf',
        f'setpts=(PTS-STARTPTS)/{sp},fps=30,scale={W}:{H}:flags=lanczos,format=yuv420p', '-t', f'{d:.3f}',
        '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/seg_{name}.mp4'])

# ---- النص فوق المقطع مباشرة (يدخل ويخرج بتلاشٍ)
for (name, _, _, _, text, *_), d in zip(SEGS, durs):
    cap = f'{WORK}/cap_{name}.png' if text else f'{WORK}/cap_none.png'
    fc = (f'[1:v]format=rgba,fade=t=in:st=0.12:d=0.25:alpha=1,fade=t=out:st={max(0.2, d - 0.4):.3f}:d=0.25:alpha=1[cap];'
          f'[0:v][cap]overlay=0:0:format=auto,format=yuv420p,fps=30[o]')
    sh([FFMPEG, '-y', '-v', 'error', '-i', f'{WORK}/seg_{name}.mp4',
        '-loop', '1', '-framerate', '30', '-t', f'{d:.3f}', '-i', cap,
        '-filter_complex', fc, '-map', '[o]', '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/comp_{name}.mp4'])

# ---- دمج بتلاشٍ بسيط فقط (dissolve)
names = [s[0] for s in SEGS]
cmd = [FFMPEG, '-y', '-v', 'error']
for n in names:
    cmd += ['-i', f'{WORK}/comp_{n}.mp4']
chain, cum, last = [], durs[0], '[0:v]'
for k in range(1, len(names)):
    tag = f'[x{k}]'
    chain.append(f'{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={cum - XF:.3f}{tag}')
    cum += durs[k] - XF
    last = tag
TOTAL = cum
print(f'المدة الكلية: {TOTAL:.2f} ثانية')
sh(cmd + ['-filter_complex', ';'.join(chain), '-map', last, '-an', '-c:v', 'libx264', '-crf', '12', '-preset', 'fast', f'{WORK}/joined.mp4'])

# ---- الصوت والترميز النهائي (مواصفات أبل: H.264 High 4.0 بمعدل 10–12 ميغابت، AAC ستريو 48kHz)
sh([sys.executable, '-I', os.path.join(HERE, 'make_audio.py'), f'{WORK}/music.wav', f'{TOTAL:.3f}'])
sh([FFMPEG, '-y', '-v', 'error', '-i', f'{WORK}/joined.mp4', '-i', f'{WORK}/music.wav', '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-r', '30', '-b:v', '11M', '-minrate', '11M', '-maxrate', '11M', '-bufsize', '22M', '-x264-params', 'nal-hrd=cbr',
    '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', f'{TOTAL:.3f}', '-movflags', '+faststart', OUT])
print('تم:', OUT)
