// Kick promo: captures the real Kick pages in test mode («تجربة بدون Kick»: the streamer types the chat lines, exactly
// as they would arrive from the Kick chat). The streamer's page at 1280×900 and the broadcast screen (OBS) at 1920×1080.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:4000';
const OUT = path.join(__dirname, 'shots');
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RIGHT = Object.fromEntries(
  execSync(`PGPASSWORD=quiz psql -h /tmp -p 5434 -U quiz ${process.env.DB || 'promo'} -At -F '\t' -c "select text, options->>correct_index from questions"`).toString().trim().split('\n').map((l) => l.split('\t')),
);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const meta = {};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  try { Object.assign(meta, JSON.parse(fs.readFileSync(path.join(OUT, 'shots.json'), 'utf8'))); } catch {}
  const browser = await chromium.launch();
  const mk = async (w, h, dpr) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'ar' });
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
    await ctx.route(/fonts\.gstatic\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try { localStorage.setItem('jab:qa:seen', '1'); sessionStorage.setItem('jab:intro', '1'); } catch {}
      const s = document.createElement('style');
      s.textContent = '[aria-haspopup="dialog"][title*="Ctrl+K"]{display:none!important} *{caret-color:transparent!important} [data-sonner-toaster]{display:none!important} video{display:none!important}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    });
    return p;
  };
  const shot = async (p, name, boxes = {}, full = false) => {
    await wait(600);
    const vp = p.viewportSize();
    const b = {};
    for (const [k, loc] of Object.entries(boxes)) {
      const r = await loc.first().boundingBox().catch(() => null);
      if (r) b[k] = { x: r.x, y: r.y, w: r.width, h: r.height };
      else console.warn('  no box', name, k);
    }
    await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 92, fullPage: full });
    meta[name] = { w: vp.width, h: vp.height, boxes: b };
    fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1));
    console.log('shot', name);
  };
  const part = async (name, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    console.log('== part', name);
    try { await fn(); } catch (e) { console.error('!! part failed', name, e.message.split('\n')[0]); }
  };

  /** Opens the stream in test mode on the streamer's page, and its broadcast screen. */
  async function open(variant) {
    const S = await mk(1280, 900, 1.5);
    await S.goto(BASE + '/kick/quiz');
    await wait(1500);
    await S.getByPlaceholder('streamer_name').fill('abdullah');
    if (!variant) await shot(S, 'k-start', { name: S.getByPlaceholder('streamer_name') });
    await S.getByText('تجربة بدون Kick').first().click();
    await wait(1500);
    const code = await S.evaluate(() => JSON.parse(sessionStorage.getItem('kick-sync') || '{}').code);
    const B = await mk(1920, 1080, 1);
    await B.goto(`${BASE}/kick/quiz/screen?code=${code}`);
    await wait(2000);
    const box = S.getByPlaceholder('ali: دخول');
    const chat = async (line) => { await box.fill(line); await box.press('Enter'); await wait(250); };
    if (variant) await S.getByRole('button', { name: new RegExp(variant) }).first().click();
    return { S, B, chat };
  }
  const go = (S) => S.locator('[data-hotkey="go"]').first().click({ timeout: 3000 }).catch(() => {});
  const VIEWERS = ['فهد', 'سارة', 'نواف', 'ريم', 'خالد', 'هند', 'ماجد'];

  // ── The classic: «جاوب أو بادل» from the lobby to the podium ──
  await part('swap', async () => {
    const { S, B, chat } = await open(null);
    await shot(S, 'k-host-lobby');
    await shot(B, 'k-screen-lobby0');
    for (const v of VIEWERS) await chat(`${v}: دخول`);
    await wait(800);
    await shot(B, 'k-screen-lobby');
    await S.mouse.wheel(0, 500);
    await wait(500);
    await shot(S, 'k-host-modes');
    for (const c of ['جغرافيا', 'كرة قدم', 'تاريخ']) await S.getByRole('button', { name: new RegExp(`${c}$`) }).first().click().catch(() => {});
    await S.getByRole('button', { name: /ابدأ اللعبة/ }).first().click();
    await wait(1500);
    await shot(B, 'k-screen-board');
    await B.locator('button:has-text("200"):not([disabled])').first().click();
    await wait(1500);
    await S.mouse.wheel(0, -3000);
    await wait(400);
    await shot(S, 'k-host-streamer');
    // The streamer answers first, in secret.
    const body = await S.locator('body').innerText();
    const q = Object.keys(RIGHT).find((t) => body.includes(t));
    const right = q && RIGHT[q];
    await S.getByRole('button', { name: right, exact: false }).first().click({ timeout: 2000 }).catch(() => S.locator('[data-hotkey="1"]').first().click());
    await wait(1000);
    await shot(B, 'k-screen-choose');
    for (const [i, v] of VIEWERS.entries()) await chat(`${v}: ${i % 3 === 1 ? 2 : 1}`);
    await wait(500);
    await shot(B, 'k-screen-choose2');
    await S.getByRole('button', { name: /اعرض الخيارات الآن/ }).click({ timeout: 2000 }).catch(() => {});
    await wait(1200);
    await shot(B, 'k-screen-answer');
    // Viewers answer by number or by typing the answer.
    const opts = await B.locator('body').innerText();
    for (const [i, v] of VIEWERS.entries()) {
      if (i % 3 === 1) continue;
      await chat(`${v}: ${i % 2 ? right : i === 4 ? '3' : String(1 + ((i + 1) % 4))}`);
    }
    await wait(400);
    await shot(B, 'k-screen-answer2');
    await S.getByRole('button', { name: /أنهِ السؤال/ }).click({ timeout: 1500 }).catch(() => {});
    await wait(1800);
    await shot(B, 'k-screen-result');
    await shot(S, 'k-host-result');
    // A few more questions, then the podium.
    for (let k = 0; k < 2; k++) {
      await go(S); await wait(900);
      await B.locator('button:not([disabled])', { hasText: /^[1-5]00$/ }).first().click().catch(() => {});
      await wait(1200);
      await S.locator('[data-hotkey="1"]').first().click().catch(() => {});
      await wait(600);
      for (const v of VIEWERS) await chat(`${v}: 1`);
      await go(S); await wait(900);
      for (const v of VIEWERS) await chat(`${v}: ${1 + Math.floor(Math.random() * 4)}`);
      await go(S); await wait(1500);
    }
    await shot(B, 'k-screen-result2');
    await go(S); await wait(800);
    await S.getByRole('button', { name: 'إنهاء اللعبة وعرض الفائز' }).first().click({ timeout: 3000 }).catch(() => {});
    await wait(2500);
    await shot(B, 'k-screen-podium');
    await S.context().close(); await B.context().close();
  });

  // ── «عدّها»: the chat types as many answers as it can ──
  await part('list', async () => {
    const { S, B, chat } = await open('عدّها');
    for (const v of VIEWERS) await chat(`${v}: دخول`);
    await S.getByRole('button', { name: /ابدأ اللعبة/ }).first().click();
    await wait(1500);
    await S.getByRole('button', { name: /جغرافيا/ }).first().click().catch(() => go(S));
    await wait(1800);
    await shot(B, 'k-list-q');
    const words = 'السعودية مصر الإمارات قطر الكويت الأردن المغرب العراق عمان البحرين تونس الجزائر لبنان فرنسا ألمانيا إسبانيا البرازيل الأرجنتين الهلال النصر الاتحاد الأهلي ميسي رونالدو الرياض جدة دبي القاهرة'.split(' ');
    for (const [i, w] of words.entries()) await chat(`${VIEWERS[i % VIEWERS.length]}: ${w}`);
    await wait(600);
    await shot(B, 'k-list-live');
    await shot(S, 'k-list-host');
    await S.context().close(); await B.context().close();
  });

  await browser.close();
  console.log('done', Object.keys(meta).length);
})();
