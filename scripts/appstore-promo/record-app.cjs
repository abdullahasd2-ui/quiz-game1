// App Store app preview: REAL screen recordings of the iPhone app's own build (apps/mobile web bundle, served locally),
// never stills. The filmed phone is 443×960 CSS px at 2× = exactly 886×1920, an accepted App Preview size for the
// 6.9"/6.7"/6.5"/6.3"/6.1" iPhones. Frames come from Chrome's screencast (every repaint, with its timestamp), so the
// motion is the app's own. Other players join from unfilmed phones, as real opponents would.
// Writes rec/<take>/frames/*.jpg + rec/<take>/frames.json (timestamps) + rec/<take>/marks.json (named moments).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:5180';
const DB = process.env.DB || 'promo';
// IPAD=1: an iPad (600×800 CSS px at 2× = 1200×1600, the iPad App Preview size) instead of the iPhone.
const IPAD = process.env.IPAD === '1';
const OUT = path.join(__dirname, IPAD ? 'rec-ipad' : 'rec');
const VW = IPAD ? 600 : 443;
const VH = IPAD ? 800 : 960;
// Supersampled: drawn at 3× and scaled down to the final size later, so text and edges come out razor sharp.
const SS = Number(process.env.SS || 3);
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RIGHT = Object.fromEntries(
  execSync(`PGPASSWORD=quiz psql -h /tmp -p 5434 -U quiz ${DB} -At -F '\t' -c "select text, options->>correct_index from questions"`)
    .toString().trim().split('\n').map((l) => l.split('\t')),
);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

(async () => {
  const browser = await chromium.launch();
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: SS, locale: 'ar', isMobile: true, hasTouch: true });
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
    await ctx.route(/fonts\.gstatic\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try { localStorage.setItem('jab:qa:seen', '1'); sessionStorage.setItem('jab:intro', '1'); } catch {}
      const s = document.createElement('style');
      // Only hides the desktop keyboard-shortcut hint and the text caret; nothing of the app's own UI is added.
      s.textContent = '[aria-haspopup="dialog"][title*="Ctrl+K"]{display:none!important} *{caret-color:transparent!important}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    });
    return p;
  };
  /** Films one page: every screencast frame is saved with its time; `mark` names moments for the editor. */
  async function film(p, take, fn) {
    const dir = path.join(OUT, take);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.join(dir, 'frames'), { recursive: true });
    const frames = [];
    const marks = {};
    const cdp = await p.context().newCDPSession(p);
    cdp.on('Page.screencastFrame', async (f) => {
      const name = `${String(frames.length).padStart(6, '0')}.png`;
      fs.writeFileSync(path.join(dir, 'frames', name), Buffer.from(f.data, 'base64'));
      frames.push({ f: name, t: f.metadata.timestamp });
      await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: VW * SS, maxHeight: VH * SS, everyNthFrame: 1 });
    const mark = (k) => { marks[k] = Date.now() / 1000; console.log('  mark', take, k); };
    mark('start');
    try { await fn(mark); } finally {
      mark('end');
      await wait(300);
      await cdp.send('Page.stopScreencast').catch(() => {});
      fs.writeFileSync(path.join(dir, 'frames.json'), JSON.stringify(frames));
      fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(marks, null, 1));
      console.log('filmed', take, frames.length, 'frames');
    }
  }
  const codeOf = async (p) => (await p.getByTestId('room-code').first().innerText()).trim();
  /** Smooth, finger-like scroll (many small steps), so the recording shows the page move. */
  const glide = async (p, dy, ms = 1200) => {
    const steps = Math.round(ms / 16);
    for (let i = 0; i < steps; i++) {
      const k = 0.5 - Math.cos(((i + 1) / steps) * Math.PI) / 2 - (0.5 - Math.cos((i / steps) * Math.PI) / 2);
      await p.evaluate((d) => scrollBy(0, d), dy * k);
      await wait(16);
    }
  };
  async function join(p, code, { team = 1, nick = 'نورة', teamName = 'النمور' } = {}) {
    await p.goto(BASE + '/');
    await wait(1400);
    await p.getByRole('button', { name: /عندي كود/ }).click();
    await wait(500);
    await p.locator('input[placeholder="• • • • • •"]').fill(code);
    await p.getByRole('button', { name: team ? /الفريق الثاني/ : /الفريق الأول/ }).click();
    await p.getByPlaceholder('مثال: سعد').fill(nick);
    if (teamName) await p.getByPlaceholder('مثال: الصقور').fill(teamName).catch(() => {});
    await p.getByRole('button', { name: /انضمام$/ }).last().click();
    await wait(1200);
  }
  async function answer(p, right = true) {
    const body = await p.locator('body').innerText();
    const q = Object.keys(RIGHT).find((t) => body.includes(t));
    const names = (await p.locator('button:visible').allInnerTexts()).map((t) => t.split('\n')[0].trim()).filter(Boolean);
    const r = q && RIGHT[q];
    const pick = right && r && names.includes(r) ? r : names.find((n) => n !== r && !/خروج|اللاعبون|التالي|⌨️|🔊|Enter|الاختصارات|جاوب|بادل|اقلب|اعكس/.test(n));
    if (pick) await p.getByRole('button', { name: pick, exact: true }).first().click({ timeout: 2000 }).catch(() => {});
  }
  const part = async (name, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    console.log('== part', name);
    try { await fn(); } catch (e) { console.error('!! part failed', name, e.message.split('\n')[0]); }
  };

  // ── Take 1: a whole team game, filmed on the host's phone from the home page to the winner ──
  await part('game', async () => {
    const A = await mk();
    const B = await mk();
    const C = await mk();
    await A.goto(BASE + '/');
    await wait(2500);
    await film(A, 'game', async (mark) => {
      mark('home');
      await wait(1600);
      await A.getByRole('button', { name: /أطوار إضافية/ }).click().catch(() => {});
      await A.evaluate(() => { const e = document.querySelector('#modes'); if (e) e.scrollIntoView({ block: 'start' }); });
      await A.evaluate(() => scrollTo(0, 0));
      mark('scroll');
      await glide(A, 700, 1500);
      await wait(900);
      mark('modes');
      await glide(A, 650, 1400);
      await wait(1200);
      await glide(A, -1350, 1200);
      await wait(400);
      mark('create');
      await A.locator('#modes button[aria-pressed]', { hasText: 'جاوب أو بادل' }).first().click();
      await A.locator('#create-name').click();
      await A.locator('#create-name').pressSequentially('الصقور', { delay: 110 });
      await wait(400);
      await A.getByRole('button', { name: /^إنشاء غرفة$/ }).click();
      await A.getByTestId('room-code').waitFor({ timeout: 8000 });
      mark('lobby');
      const code = await codeOf(A);
      await wait(1800);
      await join(B, code, { team: 1, nick: 'نورة', teamName: 'النمور' });
      mark('joined1');
      await wait(900);
      await join(C, code, { team: 0, nick: 'فهد', teamName: '' });
      mark('joined2');
      await wait(1500);
      mark('cats');
      for (const c of ['تاريخ', 'أعلام دول', 'سيارات']) {
        await A.getByRole('button', { name: new RegExp(c) }).first().click();
        await wait(450);
      }
      await A.getByRole('radio', { name: /45/ }).click().catch(() => {});
      await wait(600);
      await A.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
      await wait(1200);
      mark('start');
      await A.getByRole('button', { name: /ابدأ اللعبة/ }).click();
      await wait(2400);
      mark('board');
      await wait(1200);
      await A.locator('button', { hasText: /^300$/ }).first().click();
      await wait(1900);
      mark('choose');
      await wait(1400);
      await A.getByRole('button', { name: /بادل جواب الخصم/ }).click();
      mark('swapped');
      await wait(1200);
      await B.getByRole('button', { name: /أجاوب بنفسي/ }).click();
      await wait(1600);
      await answer(B, true);
      await wait(400);
      mark('result');
      await wait(3200);
      // Play the board out (quickly) so the game reaches its winner.
      for (let guard = 0; guard < 30; guard++) {
        const next = A.getByRole('button', { name: /التالي|النتيجة النهائية/ });
        if (await next.count()) { await next.first().click(); await wait(900); }
        if (await A.getByText(/الفائز|تعادل/).count() && !(await A.locator('button', { hasText: /^[1-5]00$/ }).count())) break;
        let picked = false;
        for (const p of [A, B]) {
          const cells = p.locator('button:not([disabled])', { hasText: /^[1-5]00$/ });
          if (await cells.count()) { await cells.first().click().catch(() => {}); picked = true; await wait(1100); break; }
        }
        if (!picked) { await wait(600); continue; }
        for (const p of [A, B]) await p.getByRole('button', { name: /أجاوب بنفسي/ }).click({ timeout: 2000 }).catch(() => {});
        await wait(900);
        if (guard === 1) mark('answer2');
        await answer(A, true);
        await answer(B, Math.random() < 0.4);
        await wait(1300);
        if (guard === 1) mark('result2');
      }
      mark('final');
      await wait(4200);
    });
    for (const p of [A, B, C]) await p.context().close();
  });

  // ── Take 2: «عدّها»: the host types answers against the clock ──
  await part('list', async () => {
    const A = await mk();
    const B = await mk();
    await A.goto(BASE + '/');
    await wait(1400);
    await A.locator('#modes button[aria-pressed]', { hasText: 'عدّها' }).first().click();
    await A.locator('#create-name').fill('الصقور');
    await A.getByRole('button', { name: /^إنشاء غرفة$/ }).click();
    await A.getByTestId('room-code').waitFor({ timeout: 8000 });
    await join(B, await codeOf(A), {});
    await wait(1200);
    await film(A, 'list', async (mark) => {
      await A.getByRole('button', { name: /ابدأ اللعبة/ }).click();
      await wait(1800);
      mark('pick');
      await A.getByRole('button', { name: /جغرافيا/ }).first().click();
      await wait(1800);
      mark('type');
      for (const w of 'السعودية مصر الإمارات قطر الكويت الأردن المغرب العراق عمان البحرين تونس الجزائر لبنان'.split(' ')) {
        await A.getByLabel('جوابك').pressSequentially(w, { delay: 45 });
        await A.getByLabel('جوابك').press('Enter');
        await wait(160);
      }
      mark('typed');
      await wait(1500);
    });
    await A.context().close();
    await B.context().close();
  });

  // ── Take 3: «اكتشف طريقة اللعب» playing itself (?tour=auto), the app's own interactive tour ──
  await part('tour', async () => {
    const A = await mk();
    await A.goto(BASE + '/');
    await wait(2000);
    await film(A, 'tour', async (mark) => {
      await A.evaluate(() => history.replaceState(null, '', '/?tour=auto'));
      await A.goto(BASE + '/?tour=auto');
      mark('tour');
      // Name each stage as it appears (for the sound design), until the round's result is up.
      let last = '';
      for (let i = 0; i < 400; i++) {
        const st = await A.evaluate(() => document.querySelector('.tour-root h2')?.textContent || (document.querySelector('.tour-final') ? 'final' : 'intro'));
        if (st !== last) { mark(`s:${st}`); last = st; }
        if (st === 'final') break;
        await wait(100);
      }
      await wait(3500);
    });
    await A.context().close();
  });

  await browser.close();
})();
