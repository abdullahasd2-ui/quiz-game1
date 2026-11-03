#!/usr/bin/env node
/*
 * تصيير فيديو «جاوب أو بادل» بأمر واحد.
 *
 *   node render.mjs                 # الصوت + النسختان + الترميز النهائي + التحقق
 *   node render.mjs stills --mode promo --times 1,2.5,9 --out DIR   # لقطات ثابتة للمراجعة
 *
 * الخيارات: --work DIR (مجلد الملفات المؤقتة)  --workers N  --sub N (عيّنات التمويه الحركي لكل إطار)
 *           --only promo|preview  --skip-audio
 *
 * الطريقة: Chrome بدون واجهة يُدار ببروتوكول DevTools (CDP) عبر WebSocket المدمج في Node 22.
 * كل عامل يفتح الصفحة، يستدعي render(t) لكل عيّنة زمنية، يلتقط PNG ويمرّره مباشرة إلى ffmpeg
 * الذي يدمج العيّنات الفرعية (tmix) ويكتب مقطعًا بلا فقد (FFV1). بعدها تُضم المقاطع ويُرمّز الناتج.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || '/opt/homebrew/bin/ffmpeg';
const FFPROBE = process.env.FFPROBE || '/opt/homebrew/bin/ffprobe';
const PYTHON = process.env.PYTHON || 'python3';

// ------------------------------------------------------------ وسائط سطر الأوامر
const argv = process.argv.slice(2);
const cmd = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'all';
const opt = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { const k = argv[i].slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opt[k] = v; }
}
const WORK = path.resolve(opt.work || process.env.VIDEO_WORK || path.join(os.tmpdir(), 'jawabbadel-video-work'));
fs.mkdirSync(WORK, { recursive: true });

const TL = JSON.parse(fs.readFileSync(path.join(HERE, 'timeline.js'), 'utf8').replace(/^[^{]*/, '').replace(/;\s*$/, ''));
const FPS = TL.fps;
const DUR = (TL.beats * 60) / TL.bpm;
const NFRAMES = Math.round(DUR * FPS);
const MODES = {
  promo: { w: 1080, h: 1920, file: 'jawabbadel-promo-1080x1920.mp4' },
  preview: { w: 886, h: 1920, file: 'jawabbadel-app-preview-886x1920.mp4' },
};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ------------------------------------------------------------ Chrome + CDP
class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0; this.pending = new Map(); this.errors = [];
    this.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') this.errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') this.errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    };
  }
  open() { return new Promise((r, j) => { this.ws.onopen = r; this.ws.onerror = j; }); }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  close() { try { this.ws.close(); } catch {} }
}

async function launch(idx, w, h) {
  const dir = path.join(WORK, `chrome-profile-${idx}`);
  fs.mkdirSync(dir, { recursive: true });
  const portFile = path.join(dir, 'DevToolsActivePort');
  try { fs.unlinkSync(portFile); } catch {}
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--allow-file-access-from-files', '--hide-scrollbars',
    '--force-color-profile=srgb', '--mute-audio', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--font-render-hinting=none',
    `--window-size=${w},${h}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  fs.appendFileSync(path.join(WORK, 'pids.txt'), `${proc.pid}\n`);
  let port;
  for (let i = 0; i < 300 && !port; i++) {
    await new Promise((r) => setTimeout(r, 50));
    try { port = fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(); } catch {}
  }
  if (!port) { proc.kill(); throw new Error('Chrome لم يفتح منفذ التصحيح'); }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  const cdp = new CDP(page.webSocketDebuggerUrl);
  await cdp.open();
  return { proc, cdp };
}

async function openPage(cdp, mode, w, h) {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const url = pathToFileURL(path.join(HERE, 'index.html')).href + `?mode=${mode}&w=${w}&h=${h}`;
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 50));
    try {
      const r = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.READY||null)', returnByValue: true });
      const v = JSON.parse(r.result.value || 'null');
      if (v) { if (!v.ok) throw new Error('الصفحة لم تحمّل كل المواد: ' + JSON.stringify(v)); return v; }
    } catch (e) { if (String(e.message).includes('الصفحة')) throw e; }
  }
  throw new Error('انتهت مهلة تحميل الصفحة\n' + cdp.errors.join('\n'));
}

async function grab(cdp, t) {
  await cdp.send('Runtime.evaluate', {
    expression: `render(${t.toFixed(6)}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`,
    awaitPromise: true,
  });
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

function run(bin, args, label) {
  const r = spawnSync(bin, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) throw new Error(`${label || bin} فشل (رمز ${r.status})`);
}

// ------------------------------------------------------------ لقطات ثابتة للمراجعة
async function stills() {
  const mode = opt.mode || 'promo';
  const { w, h } = MODES[mode];
  const out = path.resolve(opt.out || path.join(WORK, `stills-${mode}`));
  fs.mkdirSync(out, { recursive: true });
  const times = String(opt.times || '1,2,3').split(',').map(Number);
  const { proc, cdp } = await launch(`s-${mode}`, w, h);
  try {
    const ready = await openPage(cdp, mode, w, h);
    log('جاهز', JSON.stringify(ready.fonts));
    for (const t of times) {
      const buf = await grab(cdp, t);
      const f = path.join(out, `${mode}-${t.toFixed(2).padStart(6, '0')}.png`);
      fs.writeFileSync(f, buf);
    }
    log(`حُفظت ${times.length} لقطة في ${out}`);
  } finally { cdp.close(); proc.kill(); }
}

// ------------------------------------------------------------ تصيير نسخة كاملة
async function renderMode(mode) {
  const { w, h } = MODES[mode];
  const sub = +(opt.sub || 4);
  const workers = Math.max(1, +(opt.workers || Math.min(8, Math.max(2, os.cpus().length - 4))));
  const chunk = Math.ceil(NFRAMES / workers);
  log(`تصيير ${mode} ${w}×${h}: ${NFRAMES} إطار × ${sub} عيّنة، ${workers} عامل`);
  const t0 = Date.now();
  let done = 0;
  const parts = [];
  const jobs = [];
  for (let k = 0; k < workers; k++) {
    const a = k * chunk, b = Math.min(NFRAMES, a + chunk);
    if (a >= b) break;
    const part = path.join(WORK, `${mode}-part-${String(k).padStart(2, '0')}.mkv`);
    parts.push(part);
    jobs.push((async () => {
      const { proc, cdp } = await launch(`${mode}-${k}`, w, h);
      const vf = sub > 1 ? ['-vf', `tmix=frames=${sub},select=eq(mod(n\\,${sub})\\,${sub - 1}),setpts=N/(${FPS}*TB)`] : [];
      const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS * sub), '-c:v', 'png', '-i', '-',
        ...vf, '-r', String(FPS), '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0', part], { stdio: ['pipe', 'inherit', 'inherit'] });
      try {
        await openPage(cdp, mode, w, h);
        for (let n = a; n < b; n++) {
          for (let s = 0; s < sub; s++) {
            // غالق 180°: العيّنات موزعة على نصف مدة الإطار ومتمركزة حوله
            const t = sub > 1 ? (n + ((s + 0.5) / sub - 0.5) * 0.5) / FPS : n / FPS;
            const buf = await grab(cdp, Math.max(0, t));
            if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
          }
          done++;
          if (done % 60 === 0) log(`  ${mode}: ${done}/${NFRAMES} (${((Date.now() - t0) / 1000).toFixed(0)}ث)`);
        }
        ff.stdin.end();
        const [code] = await once(ff, 'close');
        if (code !== 0) throw new Error('ffmpeg فشل في المقطع ' + k);
      } finally { cdp.close(); proc.kill(); }
    })());
  }
  await Promise.all(jobs);
  const listFile = path.join(WORK, `${mode}-parts.txt`);
  fs.writeFileSync(listFile, parts.map((p) => `file '${p}'`).join('\n') + '\n');
  const full = path.join(WORK, `${mode}-lossless.mkv`);
  run(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', full], 'ضم المقاطع');
  log(`انتهى تصيير ${mode} في ${((Date.now() - t0) / 1000).toFixed(0)} ثانية`);
  return full;
}

// ------------------------------------------------------------ الترميز النهائي
const COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
const VF = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p';
const AUDIO = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2'];

function encode(mode, video, audio) {
  const out = path.join(OUT_DIR, MODES[mode].file);
  if (mode === 'promo') {
    run(FFMPEG, ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-vf', VF,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-maxrate', '20M', '-bufsize', '30M', '-profile:v', 'high', '-level:v', '4.0',
      '-pix_fmt', 'yuv420p', ...COLOR, '-r', String(FPS), '-fps_mode', 'cfr', ...AUDIO, '-movflags', '+faststart', '-shortest', out], 'ترميز promo');
  } else {
    // App Preview: H.264 High حتى المستوى 4.0، معدل بت مستهدف 10–12 ميغابت (مواصفات أبل)، ترميز بمرورين
    const plog = path.join(WORK, 'x264-preview');
    const common = ['-vf', VF, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M',
      '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p', ...COLOR, '-r', String(FPS), '-fps_mode', 'cfr', '-passlogfile', plog];
    run(FFMPEG, ['-v', 'error', '-y', '-i', video, '-an', ...common, '-pass', '1', '-f', 'mp4', '/dev/null'], 'المرور الأول');
    run(FFMPEG, ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', ...common, '-pass', '2',
      ...AUDIO, '-movflags', '+faststart', '-shortest', out], 'المرور الثاني');
  }
  return out;
}

function probe(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries',
    'format=duration,size,bit_rate:stream=codec_type,codec_name,profile,level,width,height,r_frame_rate,avg_frame_rate,pix_fmt,sample_rate,channels,bit_rate,nb_frames',
    '-of', 'json', file], { encoding: 'utf8' });
  return JSON.parse(r.stdout);
}

async function all() {
  const t0 = Date.now();
  const audio = path.join(WORK, 'audio.wav');
  if (!opt['skip-audio'] || !fs.existsSync(audio)) {
    log('توليد الصوت…');
    run(PYTHON, ['-I', path.join(HERE, 'audio.py'), audio], 'audio.py');
  }
  const modes = opt.only ? [opt.only] : ['promo', 'preview'];
  for (const m of modes) {
    const v = await renderMode(m);
    log(`ترميز ${m}…`);
    const out = encode(m, v, audio);
    const chk = spawnSync(FFMPEG, ['-v', 'error', '-i', out, '-f', 'null', '-'], { encoding: 'utf8' });
    const p = probe(out);
    log(`${path.basename(out)}: ${(p.format.size / 1048576).toFixed(1)}MB، ${(+p.format.duration).toFixed(2)}ث، قراءة كاملة: ${chk.status === 0 && !chk.stderr.trim() ? 'سليمة' : 'أخطاء!\n' + chk.stderr}`);
    console.log(JSON.stringify(p.streams.map((s) => ({ ...s })), null, 0));
  }
  log(`المجموع ${((Date.now() - t0) / 1000).toFixed(0)} ثانية`);
}

const main = { all, stills, render: async () => renderMode(opt.mode || 'promo') }[cmd];
if (!main) { console.error('أمر غير معروف: ' + cmd); process.exit(2); }
main().catch((e) => { console.error(e); process.exit(1); });
