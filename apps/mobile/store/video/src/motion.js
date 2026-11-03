/*
 * جاوب أو بادل — فيديو ترويجي.
 * كل شي في الصفحة دالة نقية في الزمن: render(t) ترسم الإطار عند الثانية t بدون أي اعتماد
 * على الساعة الحقيقية أو requestAnimationFrame، فالتصيير حتمي ويمكن تقسيمه على عدة متصفحات.
 * الوضعان: ?mode=promo (1080×1920 بإطار جوال) و ?mode=preview (886×1920 لقطات ملء الشاشة لمتجر أبل).
 */
(() => {
'use strict';

// ------------------------------------------------------------------ إعدادات
const TL = window.TIMELINE;
const Q = new URLSearchParams(location.search);
const MODE = Q.get('mode') === 'preview' ? 'preview' : 'promo';
const PROMO = MODE === 'promo';
const W = +(Q.get('w') || (PROMO ? 1080 : 886));
const H = +(Q.get('h') || 1920);
const BEAT = 60 / TL.bpm;
const T = (b) => b * BEAT;
const E = TL.events;
const DUR = T(TL.beats);
const SW = 1320, SH = 2868;
const SHOTS = '../../screenshots/raw/iphone-6.9/';
const ICON = '../../../../web/public/icons/app-icon-action.png';
const COL = { bg: '#07071a', panel: '#0f0f28', line: '#2a2a4a', gold: '#f7c948', orange: '#ff6b35', blue: '#3498db',
  red: '#e74c3c', green: '#27ae60', purple: '#a855f7', cyan: '#38bdf8', white: '#ffffff' };
const RGB = { gold: '247,201,72', orange: '255,107,53', blue: '52,152,219', red: '231,76,60', green: '39,174,96',
  purple: '168,85,247', cyan: '56,189,248', white: '255,255,255' };

// ------------------------------------------------------------------ رياضيات
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const ease = {
  lin: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x) => { const s = 1.9; return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); },
};
/** نابض مخمّد من 0 إلى 1 مع تجاوز. */
function spring(dt, freq = 2.2, damp = 0.4) {
  if (dt <= 0) return 0;
  const w = 2 * Math.PI * freq, wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * dt) * (Math.cos(wd * dt) + ((damp * w) / wd) * Math.sin(wd * dt));
}
/** نبضة: صعود سريع ثم اضمحلال أسي. */
function pulse(dt, k = 8, atk = 0.03) {
  if (dt < 0) return 0;
  if (dt < atk) return dt / atk;
  return Math.exp(-(dt - atk) * k);
}
/** ارتداد مخمّد يبدأ من الصفر (للنطّات). */
function bounce(dt, f = 2.6, k = 6) { return dt <= 0 ? 0 : Math.sin(dt * f * 2 * Math.PI) * Math.exp(-dt * k); }
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(i, s = 0) { return rng((i * 2654435761 + s * 97 + 12345) >>> 0)(); }
function sumPulses(t, beats, k = 8) { let v = 0; for (const b of beats) v += pulse(t - T(b), k); return v; }

/** نبض الإيقاع: يساوي 1 على كل نبضة ويضمحل، ويعمل فقط أثناء تشغيل الطبول. */
function beatEnv(t, k = 7) {
  const b = t / BEAT;
  if (b < 4 || b >= 52.5 || (b >= 31.75 && b < 32)) return 0;
  if (b >= 30 && b < 32) return 0.5 * Math.exp(-((b * 2) % 1) * BEAT * 0.5 * k);
  return Math.exp(-(b % 1) * BEAT * k);
}

// ------------------------------------------------------------------ أدوات DOM
const stage = document.getElementById('stage');
stage.classList.add(MODE);
stage.style.width = W + 'px';
stage.style.height = H + 'px';
function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  (parent || stage).appendChild(e);
  return e;
}
function css(e, o) {
  const c = e._c || (e._c = {});
  for (const k in o) { const v = o[k]; if (c[k] !== v) { e.style[k] = v; c[k] = v; } }
}
function vis(e, on) { css(e, { display: on ? '' : 'none' }); return on; }
function canvasLayer(id) {
  const c = el('canvas', 'layer'); c.id = id; c.width = W; c.height = H;
  c.style.width = W + 'px'; c.style.height = H + 'px';
  return c;
}

// ------------------------------------------------------------------ الطبقات
const bgC = canvasLayer('bg'); const bg = bgC.getContext('2d');
const world = el('div', 'layer');
const screensL = el('div', 'layer', world);
const scenesL = el('div', 'layer', world);
const scrimTop = el('div', 'scrim');
const scrimBot = el('div', 'scrim');
const capL = el('div', 'layer');
const fxC = canvasLayer('fx'); const fx = fxC.getContext('2d');
const darkO = el('div', 'layer'); css(darkO, { background: '#000', pointerEvents: 'none' });
const flashO = el('div'); flashO.id = 'flash';
el('div').id = 'vignette';

// ------------------------------------------------------------------ تخطيط حسب الوضع
const LY = PROMO ? {
  titleY: 128, titleSize: 96, titleMaxW: W - 90,
  scrimTopH: 560, scrimBotH: 360,
  logoSize: 172, logoY: 860, tagY: 1010, tag1: 76, tag2: 56,
  pillSize: 46, pillY: 1790,
  base: { cx: 660, cy: 1434, s: 0.455, vx: W / 2, vy: 1170 },
  lockY: 1700, lockSize: 62,
  split: { y0: 0, d: 92, badge: 180, badgeY: 650, word: 164, wordY: 800, emblemY: 1150, emR: 116, sub: 56, subY: 1420, cx: 0.25 },
  iconSize: 520, iconY: 760, logo2Size: 132, logo2Y: 1250, slogan1: 76, slogan2: 92, sloganY: 1385,
  shake: 1,
} : {
  titleY: 64, titleSize: 76, titleMaxW: W - 70,
  scrimTopH: 420, scrimBotH: 320,
  logoSize: 140, logoY: 820, tagY: 950, tag1: 64, tag2: 46,
  pillSize: 40, pillY: 1800,
  base: { cx: 660, cy: 1434, s: 0.68, vx: W / 2, vy: 1130 },
  lockY: 1250, lockSize: 52,
  split: { y0: 1140, d: 52, badge: 116, badgeY: 1236, word: 118, wordY: 1380, emblemY: 1532, emR: 78, sub: 40, subY: 1700, cx: 0.25 },
  iconSize: 440, iconY: 740, logo2Size: 110, logo2Y: 1140, slogan1: 64, slogan2: 78, sloganY: 1262,
  shake: 0.6,
};

// مستطيلات العناصر داخل اللقطات (بكسل اللقطة الأصلية 1320×2868)
const R = {
  homeCreateBtn: [112, 2432, 1096, 148], homeLogo: [244, 430, 824, 129], homeTag: [351, 602, 616, 50],
  code: [340, 459, 639, 215], team1: [676, 827, 594, 537], team2: [50, 827, 594, 537],
  cats: [[466, 1473, 388, 233], [466, 1734, 388, 232], [50, 1734, 387, 232]],
  cellsX: [[60, 355], [388, 623], [655, 992], [1023, 1258]],
  cellsY: [[899, 1038], [1072, 1211], [1245, 1386], [1419, 1559], [1592, 1733]],
  timerTxt: [548, 560, 224, 64], timerBar: [48, 648, 1224, 18],
  btnJ: [48, 1235, 597, 204], btnB: [674, 1235, 597, 204],
  modal: [50, 499, 1220, 1869], answer: [112, 1541, 1096, 104],
  rteam1: [676, 1684, 531, 417], rteam2: [113, 1684, 531, 417], plus: [790, 1972, 300, 76],
};
const ROWCOL = ['green', 'blue', 'gold', 'orange', 'red'];

// ------------------------------------------------------------------ مكوّن شاشة التطبيق
class Screen {
  constructor(file, opt = {}) {
    this.file = SHOTS + file;
    this.root = el('div', 'scr-root', screensL);
    if (PROMO) this.bezel = el('div', 'bezel', this.root);
    this.vp = el('div', 'scr-vp', this.root);
    if (opt.under) { this.under = el('img', 'scr-img', this.vp); this.under.src = SHOTS + opt.under; }
    this.img = el('img', 'scr-img', this.vp); this.img.src = this.file;
    this.ov = el('div', 'abs', this.vp); css(this.ov, { width: SW + 'px', height: SH + 'px' });
    this.sheen = el('div', 'sheen', this.vp);
    css(this.sheen, { display: 'none' });
    this.cam = null;
  }
  /** نسخة مقصوصة من اللقطة نفسها فوق مكانها تمامًا، لتحريك عنصر من الواجهة الحقيقية. */
  crop(r, rad = 0, parent = null, ox = 0, oy = 0, fill = null) {
    const [x, y, w, h] = r;
    if (fill) { // يسدّ مكان العنصر الأصلي حتى لا يظهر مكرّرًا عند تحريك النسخة
      const f = el('div', 'abs', parent || this.ov);
      css(f, { left: x - ox + 'px', top: y - oy + 'px', width: w + 'px', height: h + 'px', background: fill, borderRadius: rad + 'px' });
    }
    const d = el('div', 'crop', parent || this.ov);
    css(d, { left: x - ox + 'px', top: y - oy + 'px', width: w + 'px', height: h + 'px',
      backgroundImage: `url("${this.file}")`, backgroundPosition: `${-x}px ${-y}px`,
      backgroundSize: `${SW}px ${SH}px`, borderRadius: rad + 'px' });
    return d;
  }
  apply(c) {
    this.cam = c;
    if (!vis(this.root, !!c && (c.op ?? 1) > 0.002)) return;
    const rx = c.rx || 0, ry = c.ry || 0, rz = c.rz || 0;
    const tr = (Math.abs(rx) > 0.02 || Math.abs(ry) > 0.02)
      ? `translate(${c.vx}px,${c.vy}px) perspective(${c.persp || 2600}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${c.s}) translate(${-c.cx}px,${-c.cy}px)`
      : `translate(${c.vx}px,${c.vy}px) rotate(${rz}deg) scale(${c.s}) translate(${-c.cx}px,${-c.cy}px)`;
    css(this.root, { transform: tr, opacity: String(c.op ?? 1) });
    const f = [];
    if ((c.blur || 0) > 0.05) f.push(`blur(${c.blur.toFixed(2)}px)`);
    if ((c.bright ?? 1) < 0.999) f.push(`brightness(${c.bright.toFixed(3)})`);
    css(this.vp, { filter: f.length ? f.join(' ') : 'none' });
    if (c.sheen != null && c.sheen > 0 && c.sheen < 1) {
      css(this.sheen, { display: '', transform: `translateX(${lerp(-70, 70, c.sheen)}%)` });
    } else css(this.sheen, { display: 'none' });
  }
}
/** تحويل نقطة من إحداثيات اللقطة إلى إحداثيات الفيديو (تقريب ثنائي الأبعاد). */
function toView(c, sx, sy) {
  if (!c) return [W / 2, H / 2];
  const a = ((c.rz || 0) * Math.PI) / 180, dx = (sx - c.cx) * c.s, dy = (sy - c.cy) * c.s;
  return [c.vx + dx * Math.cos(a) - dy * Math.sin(a), c.vy + dx * Math.sin(a) + dy * Math.cos(a)];
}
function rectView(c, r) {
  const [x, y, w, h] = r; const a = toView(c, x, y), b = toView(c, x + w, y + h);
  return [a[0], a[1], b[0] - a[0], b[1] - a[1]];
}
const camAt = (cam, t, base) => cam(t) || base;

// ------------------------------------------------------------------ نقرة (touch hotspot)
function makeTap(parent, x, y) {
  const dot = el('div', 'ripple', parent), ring = el('div', 'ripple', parent);
  return { dot, ring, x, y };
}
function updTap(tp, t, t0, rgb = RGB.white, R0 = 250) {
  const dt = t - t0;
  if (vis(tp.dot, dt > -0.14 && dt < 0.42)) {
    const a = dt < 0 ? ease.outCubic(clamp((dt + 0.14) / 0.14)) : 1 - clamp(dt / 0.42);
    const r = 46 * (dt < 0 ? 0.6 + 0.4 * a : 1 - 0.3 * clamp(dt / 0.42));
    css(tp.dot, { left: tp.x - r + 'px', top: tp.y - r + 'px', width: 2 * r + 'px', height: 2 * r + 'px',
      background: `rgba(${rgb},${(0.55 * a).toFixed(3)})`, boxShadow: `0 0 40px rgba(${rgb},${(0.6 * a).toFixed(3)})` });
  }
  if (vis(tp.ring, dt >= 0 && dt < 0.75)) {
    const p = ease.outCubic(clamp(dt / 0.7)); const r = 50 + R0 * p;
    css(tp.ring, { left: tp.x - r + 'px', top: tp.y - r + 'px', width: 2 * r + 'px', height: 2 * r + 'px',
      border: `${(12 * (1 - p) + 2).toFixed(1)}px solid rgba(${rgb},${(0.9 * (1 - p)).toFixed(3)})` });
  }
}

// ------------------------------------------------------------------ العناوين المتحركة
class Title {
  /** lines: [[ [نص, نمط], ... ], ...] */
  constructor(lines, o = {}) {
    this.o = Object.assign({ y: LY.titleY, size: LY.titleSize, sizes: null, lh: 1.16, parent: capL, maxW: LY.titleMaxW, stagger: 0.06 }, o);
    this.box = el('div', 'title', this.o.parent);
    css(this.box, { top: this.o.y + 'px', width: W + 'px' });
    this.words = [];
    lines.forEach((ln, li) => {
      const line = el('div', 'tline', this.box);
      const fs = this.o.sizes ? this.o.sizes[li] : this.o.size;
      css(line, { fontSize: fs + 'px', lineHeight: String(this.o.lh) });
      ln.forEach(([txt, cls], wi) => {
        const s = el('span', 'word w-' + (cls || 'white'), line, txt);
        const grad = ['gold', 'purple', 'cyan', 'green', 'red'].includes(cls);
        s.style.marginLeft = (wi < ln.length - 1 ? fs * 0.24 : 0) - (grad ? fs * 0.06 : 0) + 'px';
        s._glow = cls === 'gold' ? 'rgba(247,201,72,.55)' : cls === 'green' ? 'rgba(39,174,96,.7)' : cls === 'red' ? 'rgba(231,76,60,.7)'
          : cls === 'purple' ? 'rgba(168,85,247,.7)' : cls === 'cyan' ? 'rgba(56,189,248,.7)' : null;
        this.words.push(s);
      });
      line._fs = fs; line._el = line;
    });
    this.lines = [...this.box.children];
  }
  fit() {
    for (const line of this.lines) {
      const w = line.scrollWidth;
      if (w > this.o.maxW) css(line, { fontSize: (line._fs * this.o.maxW / w).toFixed(1) + 'px' });
    }
  }
  update(t, tin, tout, extra = {}) {
    if (!vis(this.box, t >= tin - 0.05 && t <= tout + 0.6)) return;
    const n = this.words.length;
    this.words.forEach((w, i) => {
      const d = t - tin - i * this.o.stagger;
      const sp = spring(d, 2.3, 0.48);
      const a = clamp(d / 0.12);
      const blIn = (1 - clamp(d / 0.22)) * 14;
      const od = t - tout - (n - 1 - i) * 0.03;
      const xo = ease.inCubic(clamp(od / 0.22));
      const y = (1 - sp) * 80 - xo * 70;
      const s = (0.62 + 0.38 * sp) * (1 + (extra.pulse || 0) * 0.035);
      const op = a * (1 - xo);
      const bl = blIn + xo * 10;
      const f = [];
      if (bl > 0.1) f.push(`blur(${bl.toFixed(2)}px)`);
      if (w._glow) f.push(`drop-shadow(0 0 ${18 + 16 * (extra.pulse || 0)}px ${w._glow})`, 'drop-shadow(0 5px 0 rgba(0,0,0,.35))');
      css(w, { transform: `translateY(${y.toFixed(2)}px) scale(${s.toFixed(4)})`, opacity: op.toFixed(3), filter: f.length ? f.join(' ') : 'none' });
    });
  }
}

// ------------------------------------------------------------------ حبة نص (pill)
function makePill(html, size, y, parent = capL) {
  const p = el('div', 'pill', parent);
  p.innerHTML = html;
  css(p, { fontSize: size + 'px', top: y + 'px', padding: `${size * 0.32}px ${size * 0.8}px` });
  return p;
}
function updPill(p, t, tin, tout) {
  if (!vis(p, t >= tin && t <= tout + 0.3)) return;
  const sp = spring(t - tin, 2.4, 0.5), xo = ease.inCubic(prog(t, tout, tout + 0.25));
  css(p, { transform: `translate(-50%, ${((1 - sp) * 60 + xo * 40).toFixed(2)}px) scale(${(0.7 + 0.3 * sp) * (1 - 0.2 * xo)})`,
    opacity: (clamp((t - tin) / 0.1) * (1 - xo)).toFixed(3) });
}

// ------------------------------------------------------------------ الشعار
function makeLogo(parent, size) {
  const box = el('div', 'logo', parent);
  css(box, { width: W + 'px', fontSize: size + 'px' });
  const bomb = el('span', 'emoji', box, '💣');
  const j = el('span', 'lg-j', box, 'جاوب');
  const o = el('span', 'lg-o', box, 'أو');
  const b = el('span', 'lg-b', box, 'بادل');
  css(bomb, { fontSize: size * 0.8 + 'px', marginLeft: size * 0.16 + 'px' });
  css(j, { marginLeft: size * 0.2 + 'px' });
  css(o, { fontSize: size * 0.58 + 'px', marginLeft: size * 0.2 + 'px', transform: 'none' });
  return { box, bomb, j, o, b };
}
function fitLogo(lg, size, maxW) {
  const w = lg.bomb.getBoundingClientRect().right - lg.b.getBoundingClientRect().left;
  if (w <= maxW) return;
  const s = (size * maxW) / w;
  css(lg.box, { fontSize: s + 'px' });
  css(lg.bomb, { fontSize: s * 0.8 + 'px', marginLeft: s * 0.16 + 'px' });
  css(lg.j, { marginLeft: s * 0.2 + 'px' });
  css(lg.o, { fontSize: s * 0.58 + 'px', marginLeft: s * 0.2 + 'px' });
}
function measure(e) {
  const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, w: r.width, h: r.height };
}

// ------------------------------------------------------------------ الجسيمات والكونفيتي والحلقات
const bursts = [], confs = [], rings = [], lines = [];
function addBurst(o) {
  const r = rng(o.seed || 1); const ps = [];
  for (let i = 0; i < o.n; i++) {
    const a = (o.angle ?? 0) + (r() - 0.5) * (o.spread ?? Math.PI * 2);
    ps.push({ a, v: lerp(o.v[0], o.v[1], Math.pow(r(), 0.7)), life: lerp(o.life[0], o.life[1], r()),
      size: lerp(o.size[0], o.size[1], r()), col: o.colors[Math.floor(r() * o.colors.length)], tw: r() * 6.28 });
  }
  bursts.push(Object.assign({ drag: 2.4, g: 0, streak: false }, o, { ps }));
}
function drawBurst(b, t) {
  const dt = t - b.t0; if (dt < 0 || dt > b.life[1]) return;
  const k = b.drag, e = Math.exp(-k * dt), d = (1 - e) / k, gy = b.g * (dt / k - d / k);
  for (const p of b.ps) {
    if (dt > p.life) continue;
    const x = b.x + Math.cos(p.a) * p.v * d, y = b.y + Math.sin(p.a) * p.v * d + gy;
    const f = 1 - dt / p.life, s = p.size * (0.35 + 0.65 * f) * (0.85 + 0.15 * Math.sin(dt * 40 + p.tw));
    fx.fillStyle = p.col;
    if (b.streak) {
      const vx = Math.cos(p.a) * p.v * e, vy = Math.sin(p.a) * p.v * e + (b.g * (1 - e)) / k;
      fx.globalAlpha = f * 0.9; fx.strokeStyle = p.col; fx.lineWidth = s; fx.lineCap = 'round';
      fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x - vx * 0.035, y - vy * 0.035); fx.stroke();
    }
    fx.globalAlpha = f * 0.28; fx.beginPath(); fx.arc(x, y, s * 2.8, 0, 6.2832); fx.fill();
    fx.globalAlpha = f; fx.beginPath(); fx.arc(x, y, s, 0, 6.2832); fx.fill();
  }
}
const CONF_COLS = [COL.gold, COL.orange, COL.purple, COL.cyan, COL.green, COL.red, '#ffffff', '#f472b6'];
function addConfetti(o) {
  const r = rng(o.seed || 3); const ps = [];
  for (let i = 0; i < o.n; i++) {
    const a = o.angle + (r() - 0.5) * o.spread;
    ps.push({ a, v: lerp(o.v[0], o.v[1], r()), w: lerp(12, 24, r()) * (o.scale || 1), h: lerp(7, 13, r()) * (o.scale || 1),
      col: CONF_COLS[Math.floor(r() * CONF_COLS.length)], spin: (r() - 0.5) * 14, flip: 5 + r() * 9, ph: r() * 6.28,
      sway: 20 + r() * 50, swayF: 2 + r() * 3, life: lerp(o.life[0], o.life[1], r()), round: r() < 0.18 });
  }
  confs.push(Object.assign({ drag: 1.7, g: 1100 }, o, { ps }));
}
function drawConfetti(c, t) {
  const dt = t - c.t0; if (dt < 0 || dt > c.life[1]) return;
  const k = c.drag, e = Math.exp(-k * dt), d = (1 - e) / k, gy = c.g * (dt / k - d / k);
  for (const p of c.ps) {
    if (dt > p.life) continue;
    const x = c.x + Math.cos(p.a) * p.v * d + Math.sin(dt * p.swayF + p.ph) * p.sway * clamp(dt * 1.5);
    const y = c.y + Math.sin(p.a) * p.v * d + gy;
    const al = 1 - clamp((dt - (p.life - 0.45)) / 0.45);
    fx.save(); fx.globalAlpha = al; fx.translate(x, y); fx.rotate(p.ph + p.spin * dt);
    fx.scale(1, Math.cos(p.ph * 3 + p.flip * dt)); fx.fillStyle = p.col;
    if (p.round) { fx.beginPath(); fx.arc(0, 0, p.h * 0.7, 0, 6.2832); fx.fill(); } else fx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    fx.restore();
  }
}
function addRing(o) { rings.push(Object.assign({ dur: 0.6, w: 26, r0: 40, r1: 700, col: '#ffffff', fill: false }, o)); }
function drawRing(rg, t) {
  const dt = t - rg.t0; if (dt < 0 || dt > rg.dur) return;
  const p = dt / rg.dur, e = ease.outCubic(p), r = lerp(rg.r0, rg.r1, e);
  fx.globalAlpha = (1 - p) * (rg.alpha ?? 1); fx.strokeStyle = rg.col; fx.lineWidth = rg.w * (1 - p) + 1.5;
  fx.beginPath(); fx.ellipse(rg.x, rg.y, r, r * (rg.squash || 1), 0, 0, 6.2832); fx.stroke();
}
/** خطوط سرعة: شعاعية من مركز أو رأسية للانتقالات. */
function addLines(o) { lines.push(Object.assign({ n: 60, dur: 0.6, col: '#ffffff', alpha: 0.55, mode: 'radial', seed: 9, len: 340, width: 5, r0: 220 }, o)); }
function drawLines(L, t) {
  const dt = t - L.t0; if (dt < 0 || dt > L.dur) return;
  const p = dt / L.dur, A = Math.sin(Math.PI * Math.sqrt(p)) * L.alpha;
  const r = rng(L.seed); fx.strokeStyle = L.col; fx.lineCap = 'round';
  for (let i = 0; i < L.n; i++) {
    const ang = r() * 6.2832, sp = 0.6 + r() * 0.9, len = L.len * (0.4 + r()), w = L.width * (0.35 + r()), ph = r(), aa = 0.35 + 0.65 * r();
    fx.globalAlpha = A * aa; fx.lineWidth = w;
    if (L.mode === 'radial') {
      const rr = L.r0 + ((dt * sp * 2600 + ph * 1400) % 1500);
      fx.beginPath(); fx.moveTo(L.x + Math.cos(ang) * rr, L.y + Math.sin(ang) * rr);
      fx.lineTo(L.x + Math.cos(ang) * (rr + len), L.y + Math.sin(ang) * (rr + len)); fx.stroke();
    } else { // رأسية: تتحرك للأعلى بسرعة
      const x = ph * W, y = H + 200 - ((dt * sp * 5200 + ang * 400) % (H + 600)) * (L.dir || 1);
      fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x, y + len * 1.6); fx.stroke();
    }
  }
}

// ------------------------------------------------------------------ الخلفية: توهج + كلمات عائمة بتأثير بارالاكس
const FLOAT_WORDS = ['جاوب', 'بادل', 'صح', 'غلط', 'نقاط', 'دبل', 'جاوب', 'بادل'];
const floaters = [];
{
  const r = rng(77); const sc = W / 1080;
  for (let i = 0; i < 54; i++) {
    const depth = [0.35, 0.65, 1][i % 3];
    const emo = i % 11 === 10;
    floaters.push({ w: emo ? (i % 2 ? '✅' : '🔄') : FLOAT_WORDS[Math.floor(r() * FLOAT_WORDS.length)], emo,
      x: r() * W, ph: r() * (H + 400), sp: 26 + r() * 40, size: (30 + r() * 58) * (0.55 + depth * 0.75) * sc, depth,
      a: (0.045 + r() * 0.045) * (0.55 + depth * 0.5), rot: (r() - 0.5) * 0.25, sw: r() * 6.28, tint: r() });
  }
}
const WHIPS = [T(7.9), T(11.6), T(15.75), T(24), T(32), T(40), T(49.8)];
function bgScroll(t) { let s = 0; for (const w of WHIPS) s += 520 * ease.inOutCubic(prog(t, w - 0.2, w + 0.45)); return s; }
function glow(x, y, r, rgb, a) {
  if (a <= 0.002) return;
  const g = bg.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.35})`); g.addColorStop(1, `rgba(${rgb},0)`);
  bg.fillStyle = g; bg.fillRect(0, 0, W, H);
}
function drawBg(t, shake) {
  bg.globalAlpha = 1; bg.globalCompositeOperation = 'source-over';
  bg.fillStyle = COL.bg; bg.fillRect(0, 0, W, H);
  const be = beatEnv(t);
  const sc = (name) => { const [a, b] = TL.scenes[name]; return clamp((t - T(a) + 0.3) / 0.6) * (1 - clamp((t - T(b) + 0.3) / 0.6)); };
  const intro = sc('intro'), room = sc('room'), board = sc('board'), ques = sc('question'), res = sc('result'), out = sc('outro');
  const fadeIn = clamp(t / 0.5);
  // توهج بنفسجي أساسي يتنفس مع الإيقاع
  glow(W * 0.5, H * 0.42, W * 1.15, RGB.purple, (0.34 + 0.12 * be) * fadeIn * (intro + out * 1.1 + 0.55 * (room + board + ques + res)));
  glow(W * 0.15, H * 0.15, W * 0.9, RGB.cyan, 0.16 * (room + out + intro * 0.6));
  glow(W * 0.85, H * 0.82, W * 0.9, RGB.purple, 0.18 * (room + board));
  glow(W * 0.5, H * 0.55, W * 0.95, RGB.gold, (0.15 + 0.06 * be) * (board + res * 1.3));
  glow(W * 0.1, H * 0.7, W * 0.8, RGB.green, 0.16 * ques);
  glow(W * 0.9, H * 0.7, W * 0.8, RGB.red, 0.16 * ques);
  // الكلمات العائمة
  const scroll = bgScroll(t);
  bg.textAlign = 'center'; bg.textBaseline = 'middle'; bg.direction = 'rtl';
  for (const f of floaters) {
    const span = H + 400;
    const y = H + 200 - ((f.ph + (f.sp * t + scroll) * f.depth) % span);
    const x = f.x + Math.sin(t * 0.6 + f.sw) * 14 * f.depth + shake[0] * f.depth * 0.5;
    bg.save(); bg.translate(x, y + shake[1] * f.depth * 0.5); bg.rotate(f.rot);
    if (f.emo) { bg.globalAlpha = f.a * 1.6; bg.font = `${f.size * 0.8}px "Apple Color Emoji"`; bg.fillText(f.w, 0, 0); }
    else {
      bg.globalAlpha = f.a * (1 + 0.5 * be * f.depth);
      bg.fillStyle = f.tint < 0.18 ? COL.purple : f.tint < 0.3 ? COL.cyan : '#ffffff';
      bg.font = `900 ${f.size.toFixed(1)}px Tajawal`; bg.fillText(f.w, 0, 0);
    }
    bg.restore();
  }
  bg.globalAlpha = 1;
}

// ------------------------------------------------------------------ الومضات والهزّات
const FLASHES = [
  { b: 4, a: 0.72, k: 7, c: '255,255,255' }, { b: 1, a: 0.18, k: 9, c: RGB.orange }, { b: 7.95, a: 0.3, k: 9, c: '255,255,255' },
  { b: 11.75, a: 0.18, k: 10, c: RGB.cyan }, { b: 15.85, a: 0.22, k: 10, c: '255,255,255' },
  { b: 24, a: 0.95, k: 5, c: '255,255,255' }, { b: 32, a: 0.9, k: 5, c: '255,255,255' },
  { b: 33, a: 0.16, k: 9, c: RGB.green }, { b: 34, a: 0.4, k: 8, c: '255,255,255' }, { b: 35, a: 0.16, k: 9, c: RGB.red },
  { b: 36, a: 0.16, k: 9, c: RGB.green }, { b: 37, a: 0.16, k: 9, c: RGB.red }, { b: 38, a: 0.16, k: 9, c: RGB.green },
  { b: 39, a: 0.16, k: 9, c: RGB.red }, { b: 40, a: 0.55, k: 6, c: RGB.gold }, { b: 43, a: 0.22, k: 8, c: RGB.gold },
  { b: 50, a: 0.7, k: 5, c: '230,210,255' }, { b: 52, a: 0.35, k: 6, c: '255,255,255' },
  { b: 12, a: 0.12, k: 10, c: '255,255,255' },
];
const SHAKES = [
  { b: 4, a: 30, k: 6 }, { b: 1, a: 8, k: 9 }, { b: 9, a: 7, k: 8 }, { b: 12.1, a: 8, k: 8 }, { b: 16.3, a: 9, k: 8 }, { b: 20, a: 5, k: 10 },
  { b: 24, a: 18, k: 7 }, { b: 29.5, a: 6, k: 10 }, { b: 32, a: 36, k: 5 }, { b: 33, a: 7, k: 9 }, { b: 34, a: 16, k: 8 },
  { b: 35, a: 7, k: 9 }, { b: 36, a: 7, k: 9 }, { b: 37, a: 7, k: 9 }, { b: 38, a: 7, k: 9 }, { b: 39, a: 7, k: 9 },
  { b: 40, a: 14, k: 7 }, { b: 43, a: 8, k: 9 }, { b: 50, a: 22, k: 6 }, { b: 52, a: 10, k: 8 },
];
function shakeAt(t) {
  let x = 0, y = 0, r = 0;
  for (const s of SHAKES) {
    const dt = t - T(s.b); if (dt < 0 || dt > 1.2) continue;
    const a = s.a * Math.exp(-dt * s.k) * LY.shake;
    x += a * (Math.sin(dt * 71 + s.b) * 0.6 + Math.sin(dt * 133 + 2 * s.b) * 0.4);
    y += a * (Math.sin(dt * 83 + 1.7 * s.b) * 0.6 + Math.sin(dt * 117 + 0.3 * s.b) * 0.4);
    r += a * 0.02 * Math.sin(dt * 59 + s.b);
  }
  // اهتزاز متصاعد أثناء البناء قبل الضربة
  const bu = prog(t, T(30), T(31.75)); if (bu > 0 && t < T(31.75)) { const a = 5 * bu * bu * LY.shake; x += a * Math.sin(t * 97); y += a * Math.sin(t * 89 + 1); }
  return [x, y, r];
}

// ================================================================== بناء المشاهد
let S = {}, INTRO = {}, ROOM = {}, BOARD = {}, QUES = {}, SPLIT = {}, RES = {}, OUT = {};

function buildAll() {
  // ---------------- الشاشات
  S.home = new Screen('01-home.png');
  S.lobby = new Screen('02-lobby.png');
  S.board = new Screen('03-board.png');
  S.question = new Screen('04-question.png');
  S.result = new Screen('05-result.png', { under: '04-question.png' });
  css(S.result.under, { filter: 'brightness(0.2)' });

  // ---------------- المقدمة
  INTRO.layer = el('div', 'layer', scenesL);
  INTRO.rays = el('div', 'rays', INTRO.layer);
  INTRO.logo = makeLogo(INTRO.layer, LY.logoSize);
  css(INTRO.logo.box, { top: LY.logoY - LY.logoSize * 0.6 + 'px' });
  INTRO.tag = new Title([[['اختار', 'gold'], ['سرًّا', 'gold']], [['جاوب', 'white'], ['أو', 'white'], ['بادل', 'white'], ['نقاط', 'white'], ['خصمك!', 'white']]],
    { y: LY.tagY, sizes: [LY.tag1, LY.tag2], parent: INTRO.layer, stagger: 0.045 });

  // ---------------- مشهد الغرفة
  ROOM.title = new Title([[['أنشئ', 'white'], ['غرفة', 'white']], [['وادعُ', 'gold'], ['أصحابك', 'gold']]]);
  ROOM.pill = makePill('<span class="emoji">👥</span><span>كل فريق يلعب من جهازه</span>', LY.pillSize, LY.pillY);
  ROOM.createBtn = S.home.crop(R.homeCreateBtn, 44, null, 0, 0, COL.panel);
  ROOM.tap = makeTap(S.home.ov, 660, 2506);
  ROOM.code = S.lobby.crop(R.code, 70);
  ROOM.team1 = S.lobby.crop(R.team1, 46, null, 0, 0, COL.bg);
  ROOM.team2 = S.lobby.crop(R.team2, 46, null, 0, 0, COL.bg);
  ROOM.cats = R.cats.map((r) => { const c = S.lobby.crop(r, 40); c._t = el('div', 'tint', c); return c; });

  // ---------------- لوحة الأسئلة
  BOARD.title = new Title([[['اختر', 'white'], ['السؤال', 'white'], ['بالنقاط', 'gold']]]);
  BOARD.pill = makePill('<span>من</span><b style="color:#27ae60">100</b><span>إلى</span><b style="color:#e74c3c">500</b><span>نقطة</span>', LY.pillSize, LY.pillY - (PROMO ? 0 : 380));
  BOARD.cells = [];
  R.cellsY.forEach((ry, r) => R.cellsX.forEach((rx, c) => {
    const d = S.board.crop([rx[0], ry[0], rx[1] - rx[0], ry[1] - ry[0]], 26, null, 0, 0, r === 0 && c === 1 ? COL.bg : null);
    d._t = el('div', 'tint', d); d._r = r; d._col = c;
    BOARD.cells.push(d);
  }));
  BOARD.sel = BOARD.cells[1]; // أعلام دول — 100
  BOARD.tap = makeTap(S.board.ov, 505, 968);

  // ---------------- السؤال
  QUES.title = new Title([[['جاوب…', 'green'], ['أو', 'white'], ['بادل!', 'red']]]);
  QUES.btnJ = S.question.crop(R.btnJ, 46);
  QUES.btnB = S.question.crop(R.btnB, 46);
  // المؤقت: نعيد رسمه بنفس تنسيق التطبيق ليعدّ تنازليًا
  QUES.timerTxt = el('div', 'patch', S.question.ov);
  css(QUES.timerTxt, { left: R.timerTxt[0] + 'px', top: R.timerTxt[1] + 'px', width: R.timerTxt[2] + 'px', height: R.timerTxt[3] + 'px',
    background: COL.bg, fontSize: '39px', color: 'rgba(255,255,255,.5)', fontWeight: '500', gap: '10px', direction: 'rtl' });
  QUES.timerTxt.innerHTML = '<span class="emoji" style="font-size:40px">⏱️</span><b style="color:#f7c948;font-weight:700;font-variant-numeric:tabular-nums">52</b><span>ثانية</span>';
  QUES.timerNum = QUES.timerTxt.querySelector('b');
  QUES.bar = el('div', 'abs', S.question.ov);
  css(QUES.bar, { left: R.timerBar[0] + 'px', top: R.timerBar[1] + 'px', width: R.timerBar[2] + 'px', height: R.timerBar[3] + 'px', borderRadius: '9px', background: '#1a1a30', overflow: 'hidden' });
  QUES.fill = el('div', 'abs', QUES.bar);
  css(QUES.fill, { left: 'auto', right: '0', height: '100%', borderRadius: '9px', background: 'linear-gradient(to left, #f7c948, #27ae60)' });
  // لافتة القفل
  QUES.lock = el('div', 'lockbadge', scenesL);
  css(QUES.lock, { fontSize: LY.lockSize + 'px' });
  QUES.lock.innerHTML = `<svg width="${LY.lockSize * 1.25}" height="${LY.lockSize * 1.45}" viewBox="0 0 100 116">
    <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
    <path class="shackle" d="M26 56 V36 a24 24 0 0 1 48 0 V56" fill="none" stroke="#e5e7eb" stroke-width="12" stroke-linecap="round"/>
    <rect x="10" y="50" width="80" height="62" rx="14" fill="url(#lg)"/>
    <circle cx="50" cy="76" r="9" fill="#7c2d12"/><rect x="46" y="78" width="8" height="18" rx="4" fill="#7c2d12"/></svg>
    <span>قرارك سرّي</span>`;
  QUES.shackle = QUES.lock.querySelector('.shackle');
  QUES.dark = el('div', 'layer', scenesL); css(QUES.dark, { background: '#000', opacity: '0' });

  // ---------------- التقسيم الدرامي: جاوب مقابل بادل
  const sp = LY.split;
  SPLIT.layer = el('div', 'layer', scenesL);
  const mkSide = (cls, emoji, word, subs) => {
    const s = el('div', 'side ' + cls, SPLIT.layer);
    el('div', 'stripes', s);
    const c = el('div', 'sidec', SPLIT.layer);
    const badge = el('span', 'badge', c); css(badge, { width: sp.badge + 'px', height: sp.badge + 'px' });
    const em = el('span', 'emoji', badge, emoji); css(em, { fontSize: sp.badge * 0.62 + 'px' });
    const big = el('span', 'big', c, word); css(big, { fontSize: sp.word + 'px', lineHeight: '1.05', marginTop: sp.word * 0.06 + 'px' });
    const subWrap = el('div', '', SPLIT.layer); css(subWrap, { position: 'absolute', textAlign: 'center', whiteSpace: 'nowrap' });
    const subEls = subs.map((tx) => { const e = el('span', 'sub', subWrap, tx); css(e, { fontSize: sp.sub + 'px', lineHeight: '1.25' }); return e; });
    return { s, c, badge, big, subWrap, subEls };
  };
  SPLIT.J = mkSide('green', '✅', 'جاوب', ['جاوب صح…', 'والنقاط لك']);
  SPLIT.B = mkSide('red', '🔄', 'بادل', ['خصمك يجاوب…', 'وإذا غلط', 'تزيد نقاطك']);
  SPLIT.svg = el('div', 'layer', SPLIT.layer);
  SPLIT.svg.innerHTML = `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible">
    <polyline class="bolt2" fill="none" stroke="rgba(247,201,72,.55)" stroke-width="${PROMO ? 26 : 18}" stroke-linejoin="round"/>
    <polyline class="bolt" fill="none" stroke="#fff" stroke-width="${PROMO ? 9 : 6}" stroke-linejoin="round"/></svg>`;
  SPLIT.bolt = SPLIT.svg.querySelector('.bolt'); SPLIT.bolt2 = SPLIT.svg.querySelector('.bolt2');
  css(SPLIT.svg, { filter: 'drop-shadow(0 0 14px #fff) drop-shadow(0 0 30px rgba(247,201,72,.9))' });
  SPLIT.em = el('div', 'emblem', SPLIT.layer);
  const er = sp.emR;
  css(SPLIT.em, { width: 2 * er + 'px', height: 2 * er + 'px' });
  SPLIT.em.innerHTML = `<svg width="${2 * er}" height="${2 * er}" viewBox="-100 -100 200 200" style="left:0;top:0">
    <g class="arrows">
      <path d="M -66 -30 A 72 72 0 0 1 52 -50" fill="none" stroke="#a855f7" stroke-width="15" stroke-linecap="round"/>
      <path d="M 40 -72 L 70 -44 L 30 -32 Z" fill="#a855f7"/>
      <path d="M 66 30 A 72 72 0 0 1 -52 50" fill="none" stroke="#38bdf8" stroke-width="15" stroke-linecap="round"/>
      <path d="M -40 72 L -70 44 L -30 32 Z" fill="#38bdf8"/>
    </g></svg><b style="font-size:${er * 0.72}px">أو</b>`;
  SPLIT.arrows = SPLIT.em.querySelector('.arrows');

  // ---------------- النتيجة
  RES.title = new Title([[['اعرف', 'white'], ['النتيجة', 'white'], ['فورًا', 'gold']]]);
  const [mx, my, mw, mh] = R.modal;
  RES.modal = el('div', 'abs', S.result.ov);
  css(RES.modal, { left: mx + 'px', top: my + 'px', width: mw + 'px', height: mh + 'px', transformOrigin: '50% 45%' });
  RES.modalBg = S.result.crop(R.modal, 60, RES.modal, mx, my);
  css(RES.modalBg, { boxShadow: '0 40px 120px rgba(0,0,0,.7)' });
  RES.answer = S.result.crop(R.answer, 22, RES.modal, mx, my);
  RES.team2 = S.result.crop(R.rteam2, 34, RES.modal, mx, my, COL.panel);
  RES.team1 = S.result.crop(R.rteam1, 34, RES.modal, mx, my, COL.panel);
  // عدّاد النقاط بنفس تنسيق التطبيق: <bdi dir=ltr>+N</bdi> نقطة
  RES.plus = el('div', 'patch', RES.team1);
  const [px, py, pw, ph] = R.plus;
  css(RES.plus, { left: px - R.rteam1[0] + 'px', top: py - R.rteam1[1] + 'px', width: pw + 'px', height: ph + 'px',
    background: '#131d3a', fontSize: '60px', fontWeight: '900', color: '#f7c948', direction: 'rtl', gap: '0.25em' });
  RES.plus.innerHTML = '<bdi dir="ltr" style="font-variant-numeric:tabular-nums">+100</bdi><span>نقطة</span>';
  RES.plusNum = RES.plus.querySelector('bdi');

  // ---------------- الخاتمة
  OUT.layer = el('div', 'layer', scenesL);
  OUT.rays = el('div', 'rays', OUT.layer);
  OUT.rings = [0, 1, 2].map(() => el('div', 'ring', OUT.layer));
  OUT.icon = el('div', 'icon', OUT.layer);
  const ic = el('img', '', OUT.icon); ic.src = ICON;
  OUT.iconSheen = el('div', 'sheen', OUT.icon);
  css(OUT.icon, { width: LY.iconSize + 'px', height: LY.iconSize + 'px', left: (W - LY.iconSize) / 2 + 'px', top: LY.iconY - LY.iconSize / 2 + 'px' });
  OUT.logo = makeLogo(OUT.layer, LY.logo2Size);
  css(OUT.logo.box, { top: LY.logo2Y - LY.logo2Size * 0.6 + 'px' });
  OUT.slogan = new Title([[['تحدّوا', 'white'], ['بعض…', 'white']], [['والأذكى', 'gold'], ['يكسب', 'gold']]],
    { y: LY.sloganY, sizes: [LY.slogan1, LY.slogan2], parent: OUT.layer, stagger: 0.07 });

  // ---------------- الأغطية المتدرجة
  css(scrimTop, { top: '0', height: LY.scrimTopH + 'px',
    background: PROMO ? 'linear-gradient(to bottom, rgba(7,7,26,.97) 0%, rgba(7,7,26,.9) 50%, rgba(7,7,26,0) 100%)'
      : 'linear-gradient(to bottom, rgba(7,7,26,.99) 0%, rgba(7,7,26,.97) 58%, rgba(7,7,26,.6) 78%, rgba(7,7,26,0) 100%)' });
  css(scrimBot, { bottom: '0', height: LY.scrimBotH + 'px',
    background: 'linear-gradient(to top, rgba(7,7,26,.92) 0%, rgba(7,7,26,.6) 45%, rgba(7,7,26,0) 100%)' });
}

/** يُستدعى بعد تحميل الخطوط: قياسات تعتمد على عرض النص. */
function layoutAll() {
  for (const t of [INTRO.tag, ROOM.title, BOARD.title, QUES.title, RES.title, OUT.slogan]) t.fit();
  fitLogo(INTRO.logo, LY.logoSize, W - (PROMO ? 110 : 70));
  fitLogo(OUT.logo, LY.logo2Size, W - (PROMO ? 150 : 90));
  const lg = INTRO.logo;
  INTRO.m = { bomb: measure(lg.bomb), j: measure(lg.j), o: measure(lg.o), b: measure(lg.b), box: measure(lg.box) };
  const left = INTRO.m.b.x - INTRO.m.b.w / 2, right = INTRO.m.bomb.x + INTRO.m.bomb.w / 2;
  INTRO.m.cx = (left + right) / 2; INTRO.m.cy = INTRO.m.j.y; INTRO.m.width = right - left;
  css(lg.box, { transformOrigin: `${INTRO.m.cx}px ${INTRO.m.cy - (LY.logoY - LY.logoSize * 0.6)}px` });
  const rs = PROMO ? 1700 : 1400;
  css(INTRO.rays, { width: rs + 'px', height: rs + 'px', left: INTRO.m.cx - rs / 2 + 'px', top: INTRO.m.cy - rs / 2 + 'px' });
  if (!PROMO) setupMatchCut();
  const ol = OUT.logo;
  OUT.m = { bomb: measure(ol.bomb), j: measure(ol.j), o: measure(ol.o), b: measure(ol.b) };
  const ors = PROMO ? 1900 : 1500;
  css(OUT.rays, { width: ors + 'px', height: ors + 'px', left: W / 2 - ors / 2 + 'px', top: LY.iconY - ors / 2 + 'px' });
  for (const p of [ROOM.pill, BOARD.pill]) css(p, { left: '50%' });
  // التقسيم
  const sp = LY.split;
  const subW = (sd) => Math.max(...sd.subEls.map((e) => e.getBoundingClientRect().width));
  const maxSub = W * 0.5 - (PROMO ? 70 : 40);
  for (const sd of [SPLIT.J, SPLIT.B]) {
    const w = subW(sd);
    if (w > maxSub) for (const e of sd.subEls) css(e, { fontSize: (sp.sub * maxSub / w).toFixed(1) + 'px' });
    sd.cw = sd.c.getBoundingClientRect().width; sd.ch = sd.c.getBoundingClientRect().height;
    sd.sw = sd.subWrap.getBoundingClientRect().width; sd.sh = sd.subWrap.getBoundingClientRect().height;
  }
  SPLIT.lockW = QUES.lock.getBoundingClientRect().width;
  SPLIT.lockH = QUES.lock.getBoundingClientRect().height;
  RES.plusW = RES.plus.getBoundingClientRect().width;
  setupFx();
}

// قطع مطابق (نسخة المتجر): كل جزء من الشعار ينتقل إلى مكان نظيره في شعار الشاشة الرئيسية الحقيقية
const HOME_LOGO_INK = { bomb: [1009.5, 499, 113], j: [765.5, 494.5, 275], o: [549.5, 487.5, 63], b: [360.5, 494.5, 221] };
function setupMatchCut() {
  const cx = document.createElement('canvas').getContext('2d');
  const hc = { ...LY.base };
  INTRO.match = {};
  for (const k of ['bomb', 'j', 'o', 'b']) {
    const e = INTRO.logo[k], cs = getComputedStyle(e), fs = parseFloat(cs.fontSize);
    const lh = e.getBoundingClientRect().height;
    cx.font = k === 'bomb' ? `${fs}px "Apple Color Emoji"` : `900 ${fs}px Tajawal`;
    const m = cx.measureText(e.textContent);
    const half = (lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2;
    const inkTop = half + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
    const inkBot = half + m.fontBoundingBoxAscent + m.actualBoundingBoxDescent;
    const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const offX = (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.width / 2;
    const offY = (inkTop + inkBot) / 2 - lh / 2;
    const [sx, sy, sw] = HOME_LOGO_INK[k];
    const [tx, ty] = toView(hc, sx, sy);
    const kk = (sw * hc.s) / inkW;
    const c = INTRO.m[k];
    INTRO.match[k] = { k: kk, dx: tx - (c.x + kk * offX), dy: ty - (c.y + kk * offY) };
  }
  // الشعار النصي الفرعي ينكمش إلى مكان نظيره في الشاشة (اختار سراً – ...)
  const tb = INTRO.tag.box, tr = tb.getBoundingClientRect(), st = stage.getBoundingClientRect();
  const tw = Math.max(...INTRO.tag.lines.map((l) => l.getBoundingClientRect().width));
  const [hx, hy] = toView(hc, 659, 625.5);
  const tcx = tr.left - st.left + tr.width / 2, tcy = tr.top - st.top + tr.height / 2;
  INTRO.tagMatch = { k: (604 * hc.s) / tw, dx: hx - tcx, dy: hy - tcy };
  css(tb, { transformOrigin: `${tcx}px ${tr.height / 2}px` });
  // غطاء مؤقت فوق شعار الشاشة حتى يصل شعارنا، ثم يتلاشيان معًا
  const [x, y, w, h] = R.homeLogo;
  INTRO.cover = el('div', 'abs', S.home.ov);
  css(INTRO.cover, { left: x - 30 + 'px', top: y - 30 + 'px', width: w + 60 + 'px', height: h + 60 + 'px', background: COL.bg, borderRadius: '30px' });
}

// ================================================================== الكاميرات (دوال نقية في t)
const B0 = LY.base;
function camHome(t) {
  if (PROMO) {
    if (t < T(7.85) || t > T(12.95)) return null;
    const a = T(7.95), p = ease.outExpo(prog(t, a, a + 0.8)), sp = spring(t - a, 1.5, 0.42);
    const c = { ...B0, rx: 58 * (1 - sp), rz: -12 * (1 - sp), vy: B0.vy + 1750 * (1 - p), s: B0.s * (0.84 + 0.16 * p) };
    c.vy += Math.sin((t - a) * 2.1) * 7; c.ry = Math.sin((t - a) * 1.35) * 5 * p;
    c.sheen = prog(t, a + 0.35, a + 1.2);
    const r = ease.inOutCubic(prog(t, T(11.4), T(12.6)));
    c.vx -= 320 * r; c.s *= 1 - 0.24 * r; c.ry += 40 * r; c.bright = 1 - 0.6 * r;
    c.op = 1 - ease.inQuad(prog(t, T(12.15), T(12.9)));
    return c;
  }
  const mcB = E.matchCut;
  if (t < T(mcB + 0.05) || t > T(12.05)) return null;
  const f = ease.outCubic(prog(t, T(mcB + 0.1), T(mcB + 0.9)));
  const c = { ...B0, s: B0.s * (1.06 - 0.06 * f), op: f };
  const z = ease.inOutCubic(prog(t, T(8.3), T(9.5)));
  c.s = lerp(c.s, 0.8, z); c.cy = lerp(B0.cy, 2300, z); c.vy = lerp(B0.vy, 1466, z);
  const x = ease.inCubic(prog(t, T(11.35), T(11.95)));
  c.vy -= 2100 * x; c.blur = 6 * x;
  return c;
}
function camLobby(t) {
  if (t < T(11.45) || t > T(16.1)) return null;
  const a = T(E.lobbyIn), p = ease.outExpo(prog(t, a, a + 0.8));
  let c;
  if (PROMO) {
    const sp = spring(t - a, 1.5, 0.42);
    c = { ...B0, rx: 50 * (1 - sp), rz: 9 * (1 - sp), vy: B0.vy + 1850 * (1 - p), s: B0.s * (0.84 + 0.16 * p) };
    c.sheen = prog(t, a + 0.3, a + 1.1);
    const z = ease.inOutCubic(prog(t, T(12.6), T(13.4)));
    c.ry = Math.sin((t - a) * 1.3) * 4 * (1 - z) * p;
    c.s = lerp(c.s, 0.74, z); c.cy = lerp(B0.cy, 1150, z); c.vy = lerp(c.vy, 1180, z);
  } else {
    c = { ...B0, vy: B0.vy + 2000 * (1 - p) };
    const z = ease.inOutCubic(prog(t, T(12.6), T(13.4)));
    c.s = lerp(B0.s, 0.72, z); c.cy = lerp(B0.cy, 1100, z); c.vy = lerp(c.vy, 794, z);
  }
  const x = ease.inCubic(prog(t, T(15.6), T(16.05)));
  c.vy -= 2400 * x; c.blur = 5 * x;
  return c;
}
function camBoard(t) {
  if (t < T(15.6) || t > T(24.02)) return null;
  const a = T(E.boardIn), p = ease.outExpo(prog(t, a, a + 0.75));
  const rest = PROMO ? { cx: 660, cy: 1030, s: 0.75, vx: W / 2, vy: 1170 } : { cx: 660, cy: 1030, s: 0.72, vx: W / 2, vy: 801 };
  const c = { ...rest, vy: rest.vy + 2300 * (1 - p), rx: PROMO ? 28 * (1 - spring(t - a, 1.7, 0.5)) : 0 };
  if (PROMO) c.sheen = prog(t, a + 0.3, a + 1.1);
  const z = ease.inOutCubic(prog(t, T(20.3), T(22.2)));
  const zs = PROMO ? 1.35 : 1.1, zvy = PROMO ? 1150 : 1000;
  c.s = lerp(rest.s, zs, z); c.cx = lerp(660, 505, z); c.cy = lerp(1030, 968, z); c.vy = lerp(c.vy, zvy, z);
  const zz = ease.inExpo(prog(t, T(E.cellZoom), T(24)));
  c.s *= 1 + 9 * zz; c.blur = 10 * zz;
  return c;
}
function camQuestion(t) {
  const end = PROMO ? T(32.4) : T(40.1);
  if (t < T(23.95) || t > end) return null;
  const a = T(24), p = ease.outExpo(prog(t, a, a + 0.7));
  const rest = PROMO ? { cx: 660, cy: 890, s: 0.75, vx: W / 2, vy: 1110 } : { cx: 660, cy: 890, s: 0.72, vx: W / 2, vy: 700 };
  const c = { ...rest, s: rest.s * (1 + 1.8 * (1 - p)), blur: 14 * (1 - p) };
  const b = ease.inOutCubic(prog(t, T(30), T(31.75)));
  if (PROMO) { c.s = lerp(c.s, 0.86, b); c.cy = lerp(890, 1250, b); c.vy = lerp(1110, 1260, b); }
  else { c.s = lerp(c.s, 0.78, b); c.cy = lerp(890, 1000, b); c.vy = lerp(700, 760, b); }
  if (!PROMO) { const x = prog(t, T(39.55), T(40)); c.op = 1 - x; }
  return c;
}
function camResult(t) {
  if (t < T(39.4) || t > T(50.3)) return null;
  const rest = PROMO ? { cx: 660, cy: 1434, s: 0.72, vx: W / 2, vy: 1190 } : { cx: 660, cy: 1434, s: 0.72, vx: W / 2, vy: 973 };
  const c = { ...rest };
  const z = ease.inOutSine(prog(t, T(41), T(49.5)));
  c.s = lerp(rest.s, rest.s * 1.045, z);
  if (!PROMO) c.op = prog(t, T(39.55), T(40));
  const x = ease.inCubic(prog(t, T(E.resultOut), T(50.1)));
  c.s *= 1 - 0.35 * x; c.op = (c.op ?? 1) * (1 - x); c.blur = 8 * x;
  return c;
}

// ================================================================== المؤثرات المرتبطة بالأحداث
function setupFx() {
  const m = INTRO.m;
  // ظهور القنبلة بانفجار صغير
  addRing({ t0: T(E.bomb), x: m.cx, y: m.bomb.y, r0: 30, r1: PROMO ? 420 : 340, w: 18, col: COL.orange, dur: 0.5 });
  addBurst({ t0: T(E.bomb), x: m.cx, y: m.bomb.y, n: 36, v: [250, 900], life: [0.3, 0.7], size: [2, 6], drag: 3, g: 200,
    colors: [COL.gold, COL.orange, '#fff'], streak: true, seed: 5 });
  // صدمة الشعار
  addRing({ t0: T(4), x: m.cx, y: m.cy, r0: 60, r1: PROMO ? 980 : 820, w: 34, col: '#ffffff', dur: 0.7, squash: 0.55 });
  addRing({ t0: T(4) + 0.07, x: m.cx, y: m.cy, r0: 40, r1: PROMO ? 760 : 640, w: 22, col: COL.purple, dur: 0.8, squash: 0.55 });
  addRing({ t0: T(4) + 0.14, x: m.cx, y: m.cy, r0: 30, r1: PROMO ? 600 : 500, w: 16, col: COL.cyan, dur: 0.85, squash: 0.55 });
  addBurst({ t0: T(4), x: m.cx, y: m.cy, n: 110, v: [500, 2100], life: [0.5, 1.3], size: [3, 9], drag: 2.6, g: 500,
    colors: [COL.purple, COL.cyan, COL.gold, '#fff', '#fff'], streak: true, seed: 11 });
  addBurst({ t0: T(4.25), x: INTRO.m.o.x, y: INTRO.m.o.y, n: 26, v: [200, 700], life: [0.3, 0.6], size: [2, 5], colors: ['#fff', COL.gold], seed: 12 });
  addLines({ t0: T(4), dur: 0.5, x: m.cx, y: m.cy, n: 70, alpha: 0.5, seed: 4, r0: 260 });
  // انتقالات (خطوط رأسية)
  for (const [b, s] of [[7.9, 21], [11.55, 22], [15.7, 23]]) addLines({ t0: T(b), dur: 0.55, mode: 'v', n: 46, alpha: 0.35, len: 260, width: 4, seed: s });
  // نبض كود الغرفة
  const lobbyRest = camLobby(T(13.5)) || B0;
  const cc = toView(lobbyRest, 660, 566);
  E.codePulse.forEach((b, i) => addBurst({ t0: T(b), x: cc[0], y: cc[1], n: 22, v: [300, 900], life: [0.35, 0.7], size: [2, 6],
    colors: [COL.gold, COL.orange, '#fff'], seed: 30 + i, drag: 3 }));
  const t1 = toView(lobbyRest, 973, 1095), t2 = toView(lobbyRest, 347, 1095);
  addBurst({ t0: T(14), x: t1[0], y: t1[1] - 120, n: 18, v: [200, 700], life: [0.3, 0.6], size: [2, 5], colors: [COL.green, '#fff'], seed: 41 });
  addBurst({ t0: T(14.5), x: t2[0], y: t2[1] - 120, n: 18, v: [200, 700], life: [0.3, 0.6], size: [2, 5], colors: [COL.green, '#fff'], seed: 42 });
  // لوحة: شرارات الصفوف
  const brest = camBoard(T(19.5));
  R.cellsY.forEach((ry, r) => {
    const y = (ry[0] + ry[1]) / 2;
    R.cellsX.forEach((rx, c) => {
      const p = toView(brest, (rx[0] + rx[1]) / 2, y);
      addBurst({ t0: T(E.rows[r]) + c * 0.045, x: p[0], y: p[1], n: 9, v: [120, 420], life: [0.25, 0.5], size: [2, 4.5],
        colors: [COL[ROWCOL[r]], '#fff'], seed: 100 + r * 4 + c, drag: 3 });
    });
  });
  const tp = toView(camBoard(T(20)), 505, 968);
  addBurst({ t0: T(20), x: tp[0], y: tp[1], n: 30, v: [250, 900], life: [0.3, 0.7], size: [2, 6], colors: [COL.gold, COL.green, '#fff'], seed: 150 });
  addLines({ t0: T(23.1), dur: 0.9, x: W / 2, y: PROMO ? 1150 : 1000, n: 90, alpha: 0.6, r0: 120, seed: 151, len: 420 });
  addLines({ t0: T(24), dur: 0.45, x: W / 2, y: H * 0.5, n: 60, alpha: 0.4, r0: 300, seed: 152 });
  // الضربة: التقسيم
  const sp = LY.split, cyS = sp.emblemY;
  addLines({ t0: T(32), dur: 0.8, x: W / 2, y: cyS, n: 110, alpha: 0.7, r0: sp.emR + 20, seed: 160, len: 520, width: 7 });
  addBurst({ t0: T(32), x: W / 2, y: cyS, n: 120, v: [600, 2400], life: [0.4, 1.1], size: [3, 9], drag: 2.4, g: 300,
    colors: [COL.green, COL.red, COL.gold, '#fff'], streak: true, seed: 161 });
  addRing({ t0: T(32), x: W / 2, y: cyS, r0: sp.emR, r1: PROMO ? 1100 : 800, w: 30, col: '#fff', dur: 0.6 });
  addRing({ t0: T(34), x: W / 2, y: cyS, r0: sp.emR, r1: PROMO ? 800 : 600, w: 20, col: COL.gold, dur: 0.5 });
  addLines({ t0: T(34), dur: 0.5, x: W / 2, y: cyS, n: 60, alpha: 0.45, r0: sp.emR + 20, seed: 162 });
  E.splitHits.forEach((b, i) => { if (b !== 34) addLines({ t0: T(b), dur: 0.35, x: W / 2, y: cyS, n: 34, alpha: 0.28, r0: sp.emR + 30, seed: 170 + i, len: 300 }); });
  addLines({ t0: T(39.45), dur: 0.6, mode: 'v', n: 46, alpha: 0.35, len: 260, width: 4, seed: 180 });
  // النتيجة: كونفيتي من مدفعين + انفجار من النافذة
  const rc = camResult(T(41)) || B0;
  const top = toView(rc, 660, 640);
  addConfetti({ t0: T(41), x: -20, y: H * 0.78, angle: -Math.PI * 0.33, spread: 0.55, n: 95, v: [1500, 2600], life: [2.6, 4.0], seed: 201, scale: PROMO ? 1.6 : 1.3 });
  addConfetti({ t0: T(41), x: W + 20, y: H * 0.78, angle: -Math.PI * 0.67, spread: 0.55, n: 95, v: [1500, 2600], life: [2.6, 4.0], seed: 202, scale: PROMO ? 1.6 : 1.3 });
  addConfetti({ t0: T(41.05), x: top[0], y: top[1], angle: -Math.PI / 2, spread: 2.4, n: 70, v: [600, 1500], life: [2.2, 3.4], seed: 203, scale: PROMO ? 1.4 : 1.2 });
  const pc = toView(rc, 940, 1985);
  addBurst({ t0: T(43), x: pc[0], y: pc[1], n: 40, v: [250, 1000], life: [0.35, 0.8], size: [2, 6], colors: [COL.gold, COL.orange, '#fff'], seed: 210 });
  // الخاتمة
  for (let i = 0; i < 3; i++) addRing({ t0: T(50) + i * 0.16, x: W / 2, y: LY.iconY, r0: LY.iconSize * 0.45, r1: LY.iconSize * (1.5 + i * 0.35), w: 18 - i * 4, col: i % 2 ? COL.cyan : COL.purple, dur: 0.9 });
  addBurst({ t0: T(50), x: W / 2, y: LY.iconY, n: 90, v: [500, 1700], life: [0.5, 1.2], size: [3, 8], drag: 2.4, g: 250, colors: [COL.purple, COL.cyan, COL.gold, '#fff'], streak: true, seed: 220 });
  addLines({ t0: T(50), dur: 0.6, x: W / 2, y: LY.iconY, n: 70, alpha: 0.5, r0: LY.iconSize * 0.55, seed: 221 });
  addBurst({ t0: T(52), x: W / 2, y: LY.sloganY + 80, n: 40, v: [300, 1000], life: [0.4, 0.9], size: [2, 5], colors: [COL.gold, '#fff'], seed: 222 });
}

// شرر فتيل القنبلة: انبعاث مستمر حتمي
function bombState(t) {
  const m = INTRO.m, tb = T(E.bomb);
  let sc = 1.9 * spring(t - tb, 2.0, 0.33);
  const mv = ease.inOutCubic(prog(t, T(2.55), T(4) - 0.04));
  const dx = (m.cx - m.bomb.x) * (1 - mv), dy = 0;
  sc = lerp(sc, 1, mv);
  const dt = t - T(4);
  if (dt > 0) sc *= 1 + 0.22 * Math.exp(-dt * 9) * Math.cos(dt * 30);
  const rot = (-14 * Math.sin((t - tb) * 7.5) * Math.exp(-(t - tb) * 1.6)) * (1 - mv) + (dt > 0 ? 8 * bounce(dt, 3, 6) : 0);
  return { dx, dy, sc, rot };
}
function bombTip(t) {
  const m = INTRO.m, st = bombState(t), a = (st.rot * Math.PI) / 180;
  const ox = 0.3 * m.bomb.w * st.sc, oy = -0.36 * m.bomb.h * st.sc;
  return [m.bomb.x + st.dx + ox * Math.cos(a) - oy * Math.sin(a), m.bomb.y + st.dy + ox * Math.sin(a) + oy * Math.cos(a)];
}
function drawFuse(t, op) {
  const t0 = T(E.bomb) + 0.08, t1 = PROMO ? T(7.6) : T(E.matchCut + 0.3);
  if (t < t0 || t > t1 + 0.5 || op <= 0) return;
  const rate = 70, life = 0.42;
  const j0 = Math.max(0, Math.floor((t - life - t0) * rate)), j1 = Math.floor((Math.min(t, t1) - t0) * rate);
  for (let j = j0; j <= j1; j++) {
    const te = t0 + j / rate, dt = t - te; if (dt < 0 || dt > life) continue;
    const [x0, y0] = bombTip(te);
    const a = -Math.PI / 2 + (hash(j, 1) - 0.5) * 2.6, v = 120 + hash(j, 2) * 380;
    const x = x0 + Math.cos(a) * v * dt, y = y0 + Math.sin(a) * v * dt + 420 * dt * dt;
    const f = 1 - dt / life;
    fx.globalAlpha = f * op; fx.fillStyle = hash(j, 3) < 0.5 ? '#ffd166' : '#ff8c42';
    fx.beginPath(); fx.arc(x, y, (2 + 3 * hash(j, 4)) * f + 0.6, 0, 6.2832); fx.fill();
  }
  const [tx, ty] = bombTip(t);
  const fl = 0.75 + 0.25 * Math.sin(t * 53) * Math.sin(t * 31);
  const g = fx.createRadialGradient(tx, ty, 0, tx, ty, 70 * fl);
  g.addColorStop(0, `rgba(255,240,180,${0.95 * op})`); g.addColorStop(0.3, `rgba(255,170,60,${0.5 * op})`); g.addColorStop(1, 'rgba(255,120,0,0)');
  fx.globalAlpha = 1; fx.fillStyle = g; fx.beginPath(); fx.arc(tx, ty, 70 * fl, 0, 6.2832); fx.fill();
}

// ================================================================== تحديث المشاهد
function wordFly(t, side) {
  // side=+1 جاوب من اليمين، -1 بادل من اليسار
  const p = prog(t, T(E.wordsFly), T(4));
  const pre = 1 - ease.inQuart(p);
  const dt = t - T(4);
  let x = side * W * 1.05 * pre, sx = 1 + 0.55 * Math.pow(p, 3) * (p < 1 ? 1 : 0), sy = 1 - 0.12 * Math.pow(p, 3) * (p < 1 ? 1 : 0);
  if (dt >= 0) {
    x = side * 34 * bounce(dt, 2.2, 7);
    const q = 0.24 * Math.exp(-dt * 11) * Math.cos(dt * 32);
    sx = 1 - q; sy = 1 + q;
  }
  return { x, sx, sy, vis: t >= T(E.wordsFly) };
}
function updIntro(t) {
  const end = PROMO ? T(8.15) : T(E.matchCut + 1.6);
  if (!vis(INTRO.layer, t < end)) return;
  const lg = INTRO.logo, m = INTRO.m, be = beatEnv(t);
  // القنبلة
  const bs = bombState(t);
  const mc = PROMO ? 0 : ease.inOutCubic(prog(t, T(E.matchCut), T(E.matchCut + 1)));
  const pre = (k) => { if (mc <= 0) return ''; const q = INTRO.match[k]; return `translate(${(q.dx * mc).toFixed(2)}px,${(q.dy * mc).toFixed(2)}px) scale(${lerp(1, q.k, mc).toFixed(4)}) `; };
  css(lg.bomb, { transform: pre('bomb') + `translate(${bs.dx.toFixed(2)}px,${bs.dy}px) rotate(${bs.rot.toFixed(2)}deg) scale(${Math.max(0, bs.sc).toFixed(4)})`,
    opacity: t < T(E.bomb) ? '0' : '1' });
  // الكلمتان
  for (const [e, side, k] of [[lg.j, 1, 'j'], [lg.b, -1, 'b']]) {
    const w = wordFly(t, side);
    css(e, { transform: pre(k) + `translateX(${w.x.toFixed(2)}px) scale(${w.sx.toFixed(4)},${w.sy.toFixed(4)})`, opacity: w.vis ? '1' : '0' });
  }
  const ao = spring(t - T(E.ao), 2.6, 0.36);
  css(lg.o, { transform: pre('o') + `rotate(${(-28 * (1 - ao)).toFixed(2)}deg) scale(${Math.max(0, ao).toFixed(4)})`, opacity: t < T(E.ao) ? '0' : '1' });
  // حركة الشعار كاملًا
  let tr = `scale(${(1 + 0.03 * be).toFixed(4)})`, op = 1, blur = 0;
  if (PROMO) {
    const xo = ease.inCubic(prog(t, T(7.45), T(8.1)));
    tr = `scale(${(1 + 0.03 * be + 1.3 * xo).toFixed(4)})`; op = 1 - xo; blur = 14 * xo;
  } else {
    // قطع مطابق: كل جزء يستقر فوق نظيره في الشاشة الرئيسية ثم يتلاشى مع الغطاء
    tr = `scale(${(1 + 0.03 * be * (1 - mc)).toFixed(4)})`;
    const fo = prog(t, T(E.matchCut + 1), T(E.matchCut + 1.5));
    op = 1 - fo;
    css(INTRO.cover, { opacity: (1 - fo).toFixed(3) });
  }
  css(lg.box, { transform: tr, opacity: op.toFixed(3), filter: blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : 'none' });
  // الأشعة
  const ra = ease.outCubic(prog(t, T(4), T(4) + 0.5)) * (1 - prog(t, PROMO ? T(7.4) : T(E.matchCut - 0.2), PROMO ? T(8) : T(E.matchCut + 0.5)));
  if (vis(INTRO.rays, ra > 0.01)) css(INTRO.rays, { opacity: (ra * (0.75 + 0.25 * be)).toFixed(3), transform: `rotate(${(t * 14).toFixed(2)}deg) scale(${(0.8 + 0.2 * ra).toFixed(3)})` });
  INTRO.tag.update(t, T(E.tagline), PROMO ? T(7.35) : 99);
  if (!PROMO) {
    const q = INTRO.tagMatch, mc = ease.inOutCubic(prog(t, T(E.matchCut), T(E.matchCut + 1)));
    css(INTRO.tag.box, { transform: `translate(${(q.dx * mc).toFixed(2)}px,${(q.dy * mc).toFixed(2)}px) scale(${lerp(1, q.k, mc).toFixed(4)})`,
      opacity: (1 - clamp((mc - 0.45) / 0.5)).toFixed(3) });
  }
}
function updRoom(t) {
  ROOM.title.update(t, T(E.roomTitle), T(15.55), { pulse: beatEnv(t) });
  updPill(ROOM.pill, t, T(14.1), T(15.55));
  // زر إنشاء غرفة: ضغطة + نقرة
  const pr = pulse(t - T(E.tapCreate), 7, 0.06);
  css(ROOM.createBtn, { transform: `scale(${(1 - 0.06 * pr).toFixed(4)})`, boxShadow: `0 0 ${(70 * pr).toFixed(1)}px rgba(247,201,72,${(0.8 * pr).toFixed(3)})` });
  updTap(ROOM.tap, t, T(E.tapCreate), RGB.white, 300);
  // كود الغرفة ينبض بتوهج ذهبي
  const cp = sumPulses(t, E.codePulse, 5) + 0.25 * clamp((t - T(12.8)) / 0.4);
  css(ROOM.code, { transform: `scale(${(1 + 0.07 * Math.min(cp, 1.3)).toFixed(4)})`,
    boxShadow: `0 0 ${(30 + 90 * cp).toFixed(1)}px rgba(247,201,72,${Math.min(0.95, 0.25 + 0.6 * cp).toFixed(3)}), 0 0 ${(12 + 20 * cp).toFixed(1)}px rgba(255,107,53,.6)` });
  // بطاقتا الفريقين تقفزان بالتتابع
  for (const [e, b] of [[ROOM.team1, E.team1], [ROOM.team2, E.team2]]) {
    const dt = t - T(b), h = dt > 0 ? Math.max(0, Math.sin(Math.min(dt, 0.42) / 0.42 * Math.PI)) * 70 + 14 * bounce(dt - 0.42, 3, 7) * (dt > 0.42 ? 1 : 0) : 0;
    const g = pulse(dt, 3);
    css(e, { transform: `translateY(${(-h).toFixed(2)}px) scale(${(1 + 0.05 * g).toFixed(4)})`, boxShadow: `0 ${(h * 0.6).toFixed(1)}px ${(40 + 40 * g).toFixed(1)}px rgba(39,174,96,${(0.75 * g).toFixed(3)})` });
  }
  ROOM.cats.forEach((c, i) => {
    const g = pulse(t - T(E.cats[i]), 4);
    css(c, { transform: `scale(${(1 + 0.08 * g).toFixed(4)})`, boxShadow: `0 0 ${(60 * g).toFixed(1)}px rgba(247,201,72,${(0.85 * g).toFixed(3)})` });
    css(c._t, { background: `rgba(247,201,72,${(0.25 * g).toFixed(3)})` });
  });
}
function updBoard(t) {
  BOARD.title.update(t, T(16.1), T(22.4), { pulse: beatEnv(t) });
  updPill(BOARD.pill, t, T(17.2), T(20.05));
  const zSel = prog(t, T(20), T(20.4));
  for (const d of BOARD.cells) {
    const tl = T(E.rows[d._r]) + d._col * 0.045, dt = t - tl, rgb = RGB[ROWCOL[d._r]];
    const sp = dt > 0 ? spring(dt, 3, 0.35) : 0, g = pulse(dt, 4);
    const lit = dt > 0 ? 1 : 0;
    let sc = 1 + 0.16 * g * (dt > 0 ? 1 : 0) - 0.0 * sp;
    let glowA = 0.85 * g + 0.28 * lit, tintA = 0.5 * g + 0.08 * lit, blurR = 18 + 50 * g;
    if (d === BOARD.sel) {
      const pr = pulse(t - T(E.tapCell), 8, 0.05);
      sc *= 1 - 0.07 * pr;
      glowA = Math.max(glowA, 0.95 * zSel); tintA = Math.max(tintA, 0.3 * zSel); blurR = Math.max(blurR, 70 * zSel);
      const zz = prog(t, T(E.cellZoom) + 0.3, T(24));
      tintA = lerp(tintA, 1, ease.inQuad(zz));
      css(d, { transform: `scale(${sc.toFixed(4)})`, boxShadow: `0 0 ${blurR.toFixed(1)}px rgba(247,201,72,${glowA.toFixed(3)}), inset 0 0 0 ${(6 * zSel).toFixed(1)}px rgba(247,201,72,${zSel.toFixed(3)})` });
      css(d._t, { background: `rgba(${zz > 0 ? '255,255,255' : RGB.gold},${tintA.toFixed(3)})` });
      continue;
    }
    css(d, { transform: `scale(${sc.toFixed(4)})`, boxShadow: lit ? `0 0 ${blurR.toFixed(1)}px rgba(${rgb},${glowA.toFixed(3)})` : 'none' });
    css(d._t, { background: `rgba(${rgb},${tintA.toFixed(3)})` });
  }
  updTap(BOARD.tap, t, T(E.tapCell), RGB.white, 230);
}
function updQuestion(t) {
  QUES.title.update(t, T(24.3), T(31.6), { pulse: beatEnv(t) });
  // المؤقت يعد تنازليًا والشريط يفرغ
  const el2 = Math.max(0, t - T(24));
  const left = 52 - el2 * 2.6;
  QUES.timerNum.textContent = String(Math.max(0, Math.ceil(left)));
  css(QUES.fill, { width: ((left / 60) * 100).toFixed(3) + '%' });
  const tick = Math.exp(-((el2 * 2.6) % 1) / 2.6 * 10);
  css(QUES.timerTxt, { transform: `scale(${(1 + 0.08 * tick * (el2 > 0.1 ? 1 : 0)).toFixed(4)})` });
  // الزران ينبضان بالتناوب
  let pj = 0, pb = 0;
  E.btnPulse.forEach((b, i) => { const v = pulse(t - T(b), 6); if (i % 2 === 0) pj += v; else pb += v; });
  for (let k = 0; k < 8; k++) { const v = 0.75 * pulse(t - T(30 + k * 0.25), 12); if (k % 2 === 0) pj += v; else pb += v; }
  css(QUES.btnJ, { transform: `scale(${(1 + 0.07 * pj).toFixed(4)})`, boxShadow: `0 0 ${(20 + 80 * pj).toFixed(1)}px rgba(39,174,96,${Math.min(0.95, 0.9 * pj).toFixed(3)})`, zIndex: pj > pb ? '2' : '1' });
  css(QUES.btnB, { transform: `scale(${(1 + 0.07 * pb).toFixed(4)})`, boxShadow: `0 0 ${(20 + 80 * pb).toFixed(1)}px rgba(231,76,60,${Math.min(0.95, 0.9 * pb).toFixed(3)})`, zIndex: pb > pj ? '2' : '1' });
  // القفل
  const lt = T(E.lock), lockEnd = T(31.7);
  if (vis(QUES.lock, t >= lt && t < lockEnd + 0.3)) {
    const sp = spring(t - lt, 2.4, 0.42), xo = ease.inCubic(prog(t, lockEnd, lockEnd + 0.25));
    const cl = ease.outBack(prog(t, T(E.lockClick) - 0.08, T(E.lockClick)));
    QUES.shackle.setAttribute('transform', `translate(0 ${(-16 * (1 - cl)).toFixed(2)})`);
    const g = pulse(t - T(E.lockClick), 4);
    css(QUES.lock, { left: (W - SPLIT.lockW) / 2 + 'px', top: LY.lockY - SPLIT.lockH / 2 + 'px',
      transform: `scale(${((0.4 + 0.6 * sp) * (1 + 0.08 * g) * (1 - 0.3 * xo)).toFixed(4)}) rotate(${(-8 * (1 - sp)).toFixed(2)}deg)`,
      opacity: (clamp((t - lt) / 0.08) * (1 - xo)).toFixed(3), boxShadow: `0 0 ${(40 + 80 * g).toFixed(1)}px rgba(247,201,72,${(0.45 + 0.5 * g).toFixed(3)}), 0 18px 40px rgba(0,0,0,.5)` });
  }
  // تعتيم قبل الضربة
  const dk = 0.35 * ease.inQuad(prog(t, T(30), T(31.75))) + (t >= T(31.75) && t < T(32) ? 0.35 : 0);
  if (vis(QUES.dark, dk > 0.002 && t < T(32))) css(QUES.dark, { opacity: dk.toFixed(3) });
}
function polyStr(pts) { return 'polygon(' + pts.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`).join(',') + ')'; }
function lerpPts(a, b, x) { return a.map((p, i) => [lerp(p[0], b[i][0], x), lerp(p[1], b[i][1], x)]); }
function updSplit(t) {
  const t0 = T(E.drop), tEnd = T(40.05);
  if (!vis(SPLIT.layer, t >= t0 && t < tEnd)) return;
  const sp = LY.split, y0 = sp.y0, d = sp.d, mx = W / 2;
  const topX = mx + d, botX = mx - d;
  const leftR = [[0, y0], [topX, y0], [botX, H], [0, H]];
  const rightR = [[topX, y0], [W, y0], [W, H], [botX, H]];
  // الانبثاق من أزرار الشاشة الحقيقية
  const qc = camQuestion(T(31.99)) || B0;
  const rj = rectView(qc, R.btnJ), rb = rectView(qc, R.btnB);
  const rp = (r) => [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]];
  const ex = ease.outExpo(prog(t, t0, t0 + 0.32));
  const sw = ease.inOutCubic(prog(t, T(E.swap), T(E.swap) + 0.42));
  const out = ease.inCubic(prog(t, T(E.splitOut), T(40)));
  let gJ = lerpPts(rp(rj), leftR, ex), gB = lerpPts(rp(rb), rightR, ex);
  gJ = lerpPts(gJ, rightR, sw); gB = lerpPts(gB, leftR, sw);
  // الخروج: كل جهة تنزلق لطرفها
  const dirJ = sw > 0.5 ? 1 : -1;
  const offJ = dirJ * W * 0.75 * out, offB = -dirJ * W * 0.75 * out;
  const be = beatEnv(t), hits = sumPulses(t, E.splitHits, 7);
  const bright = 1 + 0.18 * hits;
  css(SPLIT.J.s, { clipPath: polyStr(gJ), transform: `translateX(${offJ.toFixed(1)}px)`, filter: `brightness(${bright.toFixed(3)})`, zIndex: '2' });
  css(SPLIT.B.s, { clipPath: polyStr(gB), transform: `translateX(${offB.toFixed(1)}px)`, filter: `brightness(${bright.toFixed(3)})`, zIndex: '1' });
  // المحتوى
  const ys = sp.y0 > 0 ? 0 : 0;
  const cxL = W * sp.cx - (PROMO ? 8 : 4), cxR = W * (1 - sp.cx) + (PROMO ? 8 : 4);
  const cIn = spring(t - t0 - 0.08, 2.2, 0.45);
  const midBoost = Math.sin(Math.PI * sw);
  [[SPLIT.J, cxL, cxR, offJ, 1], [SPLIT.B, cxR, cxL, offB, -1]].forEach(([sd, from, to, off, z]) => {
    const x = lerp(from, to, sw) + off;
    const sc = (0.3 + 0.7 * cIn) * (1 + 0.06 * hits + 0.1 * be) * (1 + 0.12 * midBoost * z);
    css(sd.c, { left: (x - sd.cw / 2).toFixed(1) + 'px', top: sp.badgeY - sp.badge / 2 + ys + 'px', transform: `scale(${sc.toFixed(4)})`,
      transformOrigin: '50% 60%', opacity: clamp((t - t0 - 0.05) / 0.1).toFixed(3), zIndex: z > 0 ? '4' : '3' });
    const si = spring(t - T(E.subs), 2.3, 0.5), sa = clamp((t - T(E.subs)) / 0.12);
    css(sd.subWrap, { left: (x - sd.sw / 2).toFixed(1) + 'px', top: sp.subY - sd.sh / 2 + 'px', opacity: sa.toFixed(3),
      transform: `translateY(${((1 - si) * 60).toFixed(2)}px) scale(${(0.7 + 0.3 * si).toFixed(4)})`, zIndex: '5' });
  });
  // البرق على الحد الفاصل
  const fr = Math.floor(t * 20), segs = 14, pts = [], pts2 = [];
  const bx0 = lerp(topX, topX, 0), visB = ex > 0.6 && out < 0.2 && sw < 0.02 || (sw > 0.98 && out < 0.2);
  for (let i = 0; i <= segs; i++) {
    const f = i / segs, x = lerp(topX, botX, f), y = lerp(y0, H, f);
    const j = (i === 0 || i === segs) ? 0 : (hash(fr * 31 + i, 5) - 0.5) * (PROMO ? 34 : 22);
    pts.push(`${(x + j).toFixed(1)},${y.toFixed(1)}`);
  }
  SPLIT.bolt.setAttribute('points', pts.join(' ')); SPLIT.bolt2.setAttribute('points', pts.join(' '));
  css(SPLIT.svg, { opacity: visB ? String((0.75 + 0.25 * Math.sin(t * 60)).toFixed(3)) : '0' });
  // شعار المبادلة في المنتصف
  const er = sp.emR, emIn = spring(t - t0 - 0.12, 2.4, 0.4), emOut = ease.inCubic(prog(t, T(E.splitOut) - 0.05, T(39.85)));
  const ang = t * 60 + 900 * ease.outCubic(prog(t, t0, t0 + 0.9)) + 540 * ease.inOutCubic(prog(t, T(E.swap) - 0.05, T(E.swap) + 0.5));
  css(SPLIT.em, { left: mx - er + 'px', top: sp.emblemY - er + 'px', transform: `scale(${(Math.max(0, emIn) * (1 + 0.12 * hits) * (1 - emOut)).toFixed(4)})`, zIndex: '6' });
  SPLIT.arrows.setAttribute('transform', `rotate(${ang.toFixed(2)})`);
}
function updResult(t) {
  RES.title.update(t, T(40.2), T(49.3), { pulse: beatEnv(t) });
  const t0 = T(E.resultIn);
  const sp = spring(t - t0, 1.9, 0.42);
  const op = clamp((t - t0) / 0.1);
  css(RES.modal, { transform: `perspective(2400px) rotateX(${(22 * (1 - sp)).toFixed(2)}deg) scale(${(0.3 + 0.7 * sp).toFixed(4)})`, opacity: op.toFixed(3) });
  css(S.result.img, { opacity: prog(t, T(41.5), T(42.2)).toFixed(3) });
  // العدّاد يتصاعد
  const [a, b] = E.count.map(T);
  const steps = 10; let k = 0;
  for (let i = 1; i <= steps; i++) if (t >= a + (b - a) * (1 - Math.cbrt(1 - i / steps))) k = i;
  RES.plusNum.textContent = '+' + k * 10;
  let tickP = 0; for (let i = 1; i <= steps; i++) tickP += pulse(t - (a + (b - a) * (1 - Math.cbrt(1 - i / steps))), 14);
  const fin = pulse(t - b, 4, 0.05);
  const gl = Math.min(1, 0.3 * tickP + fin) * (t >= a ? 1 : 0);
  css(RES.plus, { transform: `scale(${(1 + 0.08 * Math.min(1, tickP) + 0.32 * fin).toFixed(4)})`,
    textShadow: `0 0 ${(10 + 40 * gl).toFixed(1)}px rgba(247,201,72,${(0.3 + 0.7 * gl).toFixed(3)})`, zIndex: '3' });
  // صندوقا النقاط يرتدّان
  const [b1, b2] = E.teamsBounce.map(T);
  const s1 = bounce(t - b1, 2.4, 4.5), s2 = bounce(t - b2, 2.4, 5);
  const g1 = pulse(t - b1, 2.5) + 0.35 * fin;
  css(RES.team1, { transform: `scale(${(1 + 0.1 * s1).toFixed(4)}) translateY(${(-24 * Math.max(0, s1)).toFixed(2)}px)`, boxShadow: `0 0 ${(30 + 70 * g1).toFixed(1)}px rgba(247,201,72,${Math.min(0.9, 0.85 * g1).toFixed(3)})`, zIndex: '2' });
  css(RES.team2, { transform: `scale(${(1 + 0.06 * s2).toFixed(4)}) translateY(${(-14 * Math.max(0, s2)).toFixed(2)}px)` });
  const ag = pulse(t - T(E.answerGlow), 2.2);
  css(RES.answer, { transform: `scale(${(1 + 0.05 * ag).toFixed(4)})`, boxShadow: `0 0 ${(60 * ag).toFixed(1)}px rgba(39,174,96,${(0.9 * ag).toFixed(3)})` });
}
function updOutro(t) {
  const t0 = T(E.outroIn);
  if (!vis(OUT.layer, t >= t0 - 0.05)) return;
  const be = beatEnv(t);
  const sp = spring(t - t0, 2.0, 0.38);
  const fl = Math.sin((t - t0) * 1.6) * 8;
  css(OUT.icon, { transform: `translateY(${fl.toFixed(2)}px) rotate(${(-10 * (1 - sp)).toFixed(2)}deg) scale(${(lerp(2.4, 1, clamp(sp, 0, 1.2)) * (1 + 0.02 * be)).toFixed(4)})`,
    opacity: clamp((t - t0) / 0.12).toFixed(3), filter: `blur(${(12 * (1 - clamp((t - t0) / 0.2))).toFixed(2)}px)` });
  css(OUT.iconSheen, { transform: `translateX(${lerp(-60, 60, ease.inOutCubic(prog(t, T(52), T(53.2)))).toFixed(2)}%)` });
  const ra = ease.outCubic(prog(t, t0, t0 + 0.6));
  css(OUT.rays, { opacity: (ra * (0.8 + 0.2 * be)).toFixed(3), transform: `rotate(${(t * 10).toFixed(2)}deg)` });
  OUT.rings.forEach((r, i) => {
    const per = 1.45, ph = ((t - t0 - i * per / 3) % per + per) % per / per, on = t - t0 - (i * per) / 3 > 0;
    const rad = LY.iconSize * (0.55 + 0.75 * ease.outCubic(ph));
    css(r, { left: W / 2 - rad + 'px', top: LY.iconY - rad + 'px', width: 2 * rad + 'px', height: 2 * rad + 'px',
      border: `${(6 * (1 - ph) + 1).toFixed(1)}px solid rgba(${i % 2 ? RGB.cyan : RGB.purple},${(on ? 0.7 * (1 - ph) : 0).toFixed(3)})` });
  });
  // الشعار
  const lg = OUT.logo, l0 = T(E.outroLogo);
  css(lg.box, { opacity: t >= l0 - 0.1 ? '1' : '0', transform: `scale(${(1 + 0.02 * be).toFixed(4)})` });
  const bsp = spring(t - l0, 2.4, 0.38);
  css(lg.bomb, { transform: `scale(${Math.max(0, bsp).toFixed(4)}) rotate(${(-20 * (1 - bsp)).toFixed(2)}deg)` });
  for (const [e, side, dl] of [[lg.j, 1, 0.04], [lg.b, -1, 0.04]]) {
    const p = ease.outExpo(prog(t, l0 + dl, l0 + dl + 0.35));
    css(e, { transform: `translateX(${(side * W * 0.7 * (1 - p)).toFixed(2)}px)`, opacity: p > 0 ? '1' : '0' });
  }
  const ao = spring(t - l0 - 0.25, 2.6, 0.36);
  css(lg.o, { transform: `scale(${Math.max(0, ao).toFixed(4)})`, opacity: t >= l0 + 0.25 ? '1' : '0' });
  OUT.slogan.update(t, T(E.final) - 0.1, 99, { pulse: 0 });
}
function updScrims(t) {
  let a;
  if (PROMO) a = prog(t, T(7.95), T(8.4)) * (1 - prog(t, T(31.9), T(32))) + prog(t, T(39.8), T(40.2)) * (1 - prog(t, T(49.6), T(50)));
  else a = prog(t, T(E.matchCut + 1.2), T(E.matchCut + 1.8)) * (1 - prog(t, T(49.6), T(50)));
  a = clamp(a);
  css(scrimTop, { opacity: a.toFixed(3), display: a > 0.002 ? '' : 'none' });
  // غطاء سفلي للحبّات النصية
  let bA = 0;
  if (PROMO) bA = Math.max(prog(t, T(13.9), T(14.2)) * (1 - prog(t, T(15.5), T(15.8))), prog(t, T(17), T(17.3)) * (1 - prog(t, T(20), T(20.4))));
  else bA = prog(t, T(13.9), T(14.2)) * (1 - prog(t, T(15.5), T(15.8)));
  css(scrimBot, { opacity: bA.toFixed(3), display: bA > 0.002 ? '' : 'none' });
}
function flashAt(t) {
  let r = 0, g = 0, b = 0, a = 0;
  const add = (c, v) => { if (v <= 0.001) return; const [cr, cg, cb] = c.split(',').map(Number); const na = a + v * (1 - a); r = (r * a + cr * v * (1 - a)) / na; g = (g * a + cg * v * (1 - a)) / na; b = (b * a + cb * v * (1 - a)) / na; a = na; };
  for (const f of FLASHES) add(f.c, f.a * pulse(t - T(f.b), f.k, 0.02));
  // وميض يتصاعد أثناء التقريب داخل الخلية
  add('255,255,255', 0.85 * ease.inQuad(prog(t, T(23.3), T(24))) * (t < T(24) ? 1 : 0));
  if (t < 0.35) { /* بداية من الأسود */ }
  return [r, g, b, a];
}

// ================================================================== الرسم الرئيسي
function render(t) {
  t = Math.max(0, Math.min(DUR, t));
  const sh = shakeAt(t);
  drawBg(t, sh);
  css(world, { transform: `translate(${sh[0].toFixed(2)}px,${sh[1].toFixed(2)}px) rotate(${sh[2].toFixed(3)}deg)` });
  css(capL, { transform: `translate(${(sh[0] * 0.5).toFixed(2)}px,${(sh[1] * 0.5).toFixed(2)}px)` });

  S.home.apply(camHome(t));
  S.lobby.apply(camLobby(t));
  S.board.apply(camBoard(t));
  S.question.apply(camQuestion(t));
  S.result.apply(camResult(t));

  updIntro(t);
  updRoom(t);
  updBoard(t);
  updQuestion(t);
  updSplit(t);
  updResult(t);
  updOutro(t);
  updScrims(t);

  // طبقة المؤثرات
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
  fx.clearRect(0, 0, W, H);
  fx.setTransform(1, 0, 0, 1, sh[0], sh[1]);
  fx.globalCompositeOperation = 'lighter';
  // أثر الكلمتين الطائرتين
  if (t > T(E.wordsFly) && t < T(4) + 0.05) {
    const m = INTRO.m;
    for (const [side, word, rgb] of [[1, m.j, RGB.purple], [-1, m.b, RGB.cyan]]) {
      const w = wordFly(t, side), w2 = wordFly(t - 0.07, side);
      const xEdge = word.x + w.x + side * word.w * 0.45, len = Math.abs(w2.x - w.x) * 2.2;
      if (len < 4) continue;
      const g = fx.createLinearGradient(xEdge, 0, xEdge + side * len, 0);
      g.addColorStop(0, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`);
      fx.globalAlpha = 1; fx.fillStyle = g;
      for (let i = 0; i < 5; i++) { const hh = word.h * (0.08 + 0.05 * (i % 2)); fx.fillRect(Math.min(xEdge, xEdge + side * len), word.y - word.h * 0.32 + i * word.h * 0.16, len, hh); }
    }
  }
  const introOp = PROMO ? 1 - prog(t, T(7.4), T(7.9)) : 1 - prog(t, T(E.matchCut - 0.3), T(E.matchCut + 0.3));
  drawFuse(t, introOp);
  for (const L of lines) drawLines(L, t);
  for (const b of bursts) drawBurst(b, t);
  for (const r of rings) drawRing(r, t);
  fx.globalCompositeOperation = 'source-over';
  for (const c of confs) drawConfetti(c, t);
  fx.globalAlpha = 1;

  const [fr, fg, fb, fa] = flashAt(t);
  css(flashO, { background: `rgba(${fr | 0},${fg | 0},${fb | 0},${fa.toFixed(3)})`, display: fa > 0.002 ? '' : 'none' });
  // دخول من الأسود وخروج خفيف
  const dk = Math.max(1 - clamp(t / 0.35), 0);
  css(darkO, { opacity: dk.toFixed(3), display: dk > 0.002 ? '' : 'none' });
}

// ================================================================== التهيئة
async function init() {
  buildAll();
  const fonts = ['900 80px Tajawal', '700 80px Tajawal', '500 80px Tajawal'];
  await Promise.all(fonts.map((f) => document.fonts.load(f, 'جاوب أو بادل 0123456789+')));
  await document.fonts.ready;
  const imgs = [...document.images];
  await Promise.all(imgs.map((i) => (i.complete && i.naturalWidth ? i.decode().catch(() => {}) : new Promise((r) => { i.onload = () => i.decode().then(r, r); i.onerror = r; }))));
  // صور الخلفية للمقصوصات
  await Promise.all(Object.values(S).map((s) => new Promise((r) => { const im = new Image(); im.onload = () => im.decode().then(r, r); im.onerror = r; im.src = s.file; })));
  layoutAll();
  render(0);
  window.READY = {
    ok: imgs.every((i) => i.naturalWidth > 0) && fonts.every((f) => document.fonts.check(f, 'جاوب')),
    images: imgs.map((i) => [i.src.split('/').pop(), i.naturalWidth]),
    fonts: fonts.map((f) => [f, document.fonts.check(f, 'جاوب')]),
  };
}
window.render = render;
window.VIDEO = { W, H, DUR, MODE, BEAT };
// تشغيل تفاعلي في المتصفح عند الحاجة: ?play=1
init().then(() => {
  if (Q.get('play')) { const st = performance.now(); const loop = () => { render(((performance.now() - st) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); }
  else if (Q.get('t')) render(+Q.get('t'));
});
})();
