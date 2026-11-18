// Captures the main game (not the Kick pages): two phones playing a real room, team «الصقور» against «النمور»,
// plus the home page on a laptop. Writes shots/<name>.jpg and shots/shots.json (sizes + element boxes).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3999';
const OUT = path.join(__dirname, 'shots');
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};
// the right option of every question (from the local database), so the rest of the game plays like real teams
const RIGHT = Object.fromEntries(require('child_process').execSync(`psql -h /tmp -p 5434 -U quiz quiz -At -F '\t' -c "select text, options->>correct_index from questions"`).toString().trim().split('\n').map((l) => l.split('\t')));
let seed = +(process.env.SEED || 5);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const mk = async (desktop) => {
    const ctx = await browser.newContext(
      desktop
        ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'ar' }
        : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'ar', isMobile: true, hasTouch: true },
    );
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
    await ctx.route(/fonts\.gstatic\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try { localStorage.setItem('jab:qa:seen', '1'); sessionStorage.setItem('jab:intro', '1'); } catch {}
      const s = document.createElement('style');
      // the floating shortcuts button and the caret stay out of the shots
      s.textContent = '[aria-haspopup="dialog"][title*="Ctrl+K"]{display:none!important} *{caret-color:transparent!important}';
      document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    });
    return p;
  };
  const shot = async (p, name, boxes = {}) => {
    await p.evaluate(() => document.fonts.ready);
    await wait(700);
    const vp = p.viewportSize();
    const b = {};
    for (const [k, loc] of Object.entries(boxes)) {
      const r = await loc.first().boundingBox().catch(() => null);
      if (r) b[k] = { x: r.x, y: r.y, w: r.width, h: r.height };
      else console.warn('no box', name, k);
    }
    await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 92 });
    meta[name] = { w: vp.width, h: vp.height, boxes: b };
    console.log('shot', name, Object.keys(b).join(','));
  };
  const scrollTo = async (p, sel, off = 70) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); if (e) scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, off]); await wait(600); };

  // ---- the site on a laptop ----
  const D = await mk(true);
  await D.goto(BASE + '/');
  await wait(1800);
  await shot(D, 'd-hero', { title: D.locator('h1').first(), start: D.getByRole('button', { name: /ابدأ اللعب/ }), how: D.getByRole('button', { name: /^📖 طريقة اللعب$/ }) });
  await scrollTo(D, '#modes');
  await shot(D, 'd-modes', { modes: D.locator('#modes'), swap: D.getByRole('button', { name: /جاوب أو بادل بادل/ }) });
  await D.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.innerText.includes('من التاريخ')); scrollTo(0, h.getBoundingClientRect().top + scrollY - 120); });
  await wait(600);
  await shot(D, 'd-cats', { title: D.getByText('من التاريخ إلى الإيموجي'), chips: D.getByRole('button', { name: /جغرافيا/ }) });
  await D.evaluate(() => scrollTo(0, 0));
  await D.getByRole('button', { name: /^📖 طريقة اللعب$/ }).click();
  await wait(900);
  await shot(D, 'd-how', { swap: D.getByText(/بادل:/).first() });

  // ---- two phones ----
  const A = await mk(false), B = await mk(false);
  await A.goto(BASE + '/');
  await wait(1500);
  await shot(A, 'a-home', { title: A.locator('h1').first(), start: A.getByRole('button', { name: /ابدأ اللعب/ }) });
  await A.getByRole('button', { name: /ابدأ اللعب/ }).click();
  await wait(900);
  await A.locator('#create-name').fill('الصقور');
  await scrollTo(A, '#play-panel', 20);
  await shot(A, 'a-create', { name: A.locator('#create-name'), go: A.getByRole('button', { name: /^إنشاء غرفة$/ }), device: A.getByRole('button', { name: /جوال/ }) });
  await A.getByRole('button', { name: /^إنشاء غرفة$/ }).click();
  await wait(1600);
  const code = (await A.locator('body').innerText()).match(/\b[A-Z0-9]{6}\b/)?.[0];
  await shot(A, 'a-lobby', { code: A.getByText(code).first(), qr: A.locator('svg, canvas, img[alt*="QR"]').first(), wait: A.getByText(/في انتظار انضمام/) });

  await B.goto(BASE + '/');
  await wait(1200);
  await B.getByRole('button', { name: /عندي كود/ }).click();
  await wait(600);
  await B.getByRole('button', { name: /الفريق الثاني/ }).click();
  await B.locator('input[placeholder="• • • • • •"]').fill(code);
  await B.getByPlaceholder('مثال: سعد').fill('نورة');
  await B.getByPlaceholder('مثال: الصقور').fill('النمور');
  await scrollTo(B, '#play-panel', 20);
  await shot(B, 'b-join', { code: B.locator('input[placeholder="• • • • • •"]'), go: B.getByRole('button', { name: /انضمام$/ }).last(), team: B.getByRole('button', { name: /الفريق الثاني/ }) });
  await B.getByRole('button', { name: /انضمام$/ }).last().click();
  await wait(1800);
  await shot(B, 'b-lobby', {});
  await shot(A, 'a-lobby2', { teams: A.getByText('النمور').first(), host: A.getByText('الصقور').first() });

  for (const c of ['جغرافيا', 'كرة قدم', 'تاريخ', 'أعلام دول']) {
    await A.getByRole('button', { name: new RegExp(c) }).first().click();
    await wait(200);
  }
  await A.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await wait(600);
  await shot(A, 'a-cats', {
    geo: A.getByRole('button', { name: /جغرافيا/ }),
    foot: A.getByRole('button', { name: /كرة قدم/ }),
    hist: A.getByRole('button', { name: /تاريخ/ }),
    flags: A.getByRole('button', { name: /أعلام دول/ }),
    time: A.getByRole('button', { name: /60 ثانية/ }),
    start: A.getByRole('button', { name: /ابدأ اللعبة/ }),
  });
  await A.getByRole('button', { name: /ابدأ اللعبة/ }).click();
  await wait(2200);

  // ---- the first question, played for the camera: Falcons swap, Tigers answer right → Falcons ×2 ----
  await shot(A, 'a-board', { cell: A.locator('button', { hasText: /^200$/ }).first(), grid: A.locator('button', { hasText: /^100$/ }).first(), turn: A.getByText(/دورك/).first(), score: A.getByText('VS').first() });
  await shot(B, 'b-board', {});
  await A.locator('button', { hasText: /^200$/ }).first().click();
  await wait(1800);
  await shot(A, 'a-choose', { q: A.getByText('ما هي عاصمة الإمارات؟'), swap: A.getByRole('button', { name: /بادل جواب الخصم/ }), answer: A.getByRole('button', { name: /أجاوب بنفسي/ }), timer: A.getByText(/الوقت المتبقي/) });
  await shot(B, 'b-choose', { q: B.getByText('ما هي عاصمة الإمارات؟'), swap: B.getByRole('button', { name: /بادل جواب الخصم/ }), answer: B.getByRole('button', { name: /أجاوب بنفسي/ }) });
  await A.getByRole('button', { name: /بادل جواب الخصم/ }).click();
  await wait(500);
  await shot(A, 'a-swapped', { card: A.getByText(/اخترت المبادلة/).first() });
  await B.getByRole('button', { name: /أجاوب بنفسي/ }).click();
  await wait(1500);
  await shot(B, 'b-options', { opts: B.getByRole('button', { name: 'أبوظبي' }), all: B.getByRole('button', { name: 'دبي' }) });
  await B.getByRole('button', { name: 'أبوظبي' }).first().click();
  await wait(400);
  await shot(B, 'b-picked', { opts: B.getByRole('button', { name: 'أبوظبي' }) });
  await wait(1500);
  await shot(A, 'a-result', { right: A.getByText('أبوظبي').first(), plus: A.getByText(/\+400/).first(), zero: A.getByText(/^0 نقطة$/).first(), title: A.getByText('نتيجة الجولة') });
  await shot(B, 'b-result', {});

  // ---- the rest of the board, quickly, to reach the final screen ----
  const pages = { A, B };
  let guard = 0;
  while (guard++ < 40) {
    const next = A.getByRole('button', { name: /التالي|النتيجة النهائية/ });
    if (await next.count()) { await next.first().click(); await wait(1200); }
    const final = await A.getByText(/الفائز|فاز|تعادل/).count();
    if (final && !(await A.locator('button', { hasText: /^[1-5]00$/ }).count())) break;
    // whoever's turn picks the first open cell
    for (const p of [A, B]) {
      const cell = p.locator('button:not([disabled])', { hasText: /^[1-5]00$/ });
      if (await cell.count()) { await cell.first().click().catch(() => {}); await wait(900); break; }
    }
    for (const p of [A, B]) await p.getByRole('button', { name: /أجاوب بنفسي/ }).click({ timeout: 2500 }).catch(() => {});
    await wait(900);
    for (const [p, skill] of [[A, 0.62], [B, 0.55]]) {
      const body = await p.locator('body').innerText();
      const q = Object.keys(RIGHT).find((t) => body.includes(t));
      const names = (await p.locator('button:visible').allInnerTexts()).map((t) => t.trim()).filter((t) => t && !/خروج|اللاعبون|التالي|⌨️|🔊|Enter|الاختصارات/.test(t));
      if (!q || names.length < 2) continue;
      const right = RIGHT[q];
      const pick = rnd() < skill && names.includes(right) ? right : names.find((n) => n !== right) || names[0];
      await p.getByRole('button', { name: pick, exact: true }).first().click({ timeout: 1500 }).catch(() => {});
    }
    await wait(1600);
  }
  await wait(1500);
  await shot(A, 'a-final', { win: A.getByText(/الفائز|فاز|تعادل/).first() });
  await shot(B, 'b-final', {});
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message); fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1)); process.exit(1); });
