// Captures the real stream game in test mode: high-resolution screenshots of each step plus the positions
// of the parts the camera zooms into (shots/<name>.jpg + shots/shots.json).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'shots');
const BASE = process.env.BASE || 'http://localhost:3999';
const VIEW = { width: 1280, height: 720 };
const DSF = 2;
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};

async function mk(browser) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, locale: 'ar' });
  await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
  await ctx.route(/fonts\.gstatic\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jab:qa:seen', '1');
      sessionStorage.setItem('jab:intro', '1');
    } catch {}
  });
  // no floating helper buttons / toasts in the shots
  await page.addInitScript(() => {
    const s = document.createElement('style');
    s.textContent = '[aria-haspopup="dialog"][title*="Ctrl+K"],[role="status"].fixed{display:none!important} *{caret-color:transparent!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
  });
  return page;
}

async function box(loc) {
  const b = await loc.first().boundingBox().catch(() => null);
  if (!b) return null;
  return b;
}

async function shot(page, name, boxes = {}, full = false) {
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  const scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const b = {};
  for (const [k, loc] of Object.entries(boxes)) {
    const r = await box(loc);
    if (r) b[k] = full ? { x: r.x + scroll.x, y: r.y + scroll.y, w: r.width, h: r.height } : { x: r.x, y: r.y, w: r.width, h: r.height };
    else console.warn('no box', name, k);
  }
  const size = full ? await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })) : { ...VIEW, w: VIEW.width, h: VIEW.height };
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 92, fullPage: full });
  meta[name] = { w: size.w, h: size.h, dsf: DSF, boxes: b };
  console.log('shot', name, Object.keys(b).join(','));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const S = await mk(browser);

  // 1. start: the channel name
  await S.goto(`${BASE}/kick/quiz`);
  await wait(1500);
  const nameBox = S.getByPlaceholder('streamer_name');
  await nameBox.fill('');
  await shot(S, 'start', { input: nameBox, go: S.getByRole('button', { name: /ابدأ البث/ }), title: S.locator('h1').first() });
  await nameBox.fill('abdullahzx777');
  await shot(S, 'start-typed', { input: nameBox, go: S.getByRole('button', { name: /ابدأ البث/ }) });

  // 2. test mode: the streamer's control page
  await S.getByText('تجربة بدون Kick').click();
  await wait(1800);
  await shot(S, 'control', { link: S.getByRole('button', { name: 'نسخ الرابط' }) }, true);
  const code = await S.evaluate(() => JSON.parse(sessionStorage.getItem('kick-sync') || '{}').code);

  // the broadcast screen (what viewers see in OBS)
  const B = await mk(browser);
  await B.goto(`${BASE}/kick/quiz/screen?code=${code}`);
  await wait(2500);
  await shot(B, 'screen-lobby', { join: B.getByText(/دخول/).first() });

  // 3. viewers join from the chat
  const chat = async (line) => {
    const inp = S.getByPlaceholder('ali: دخول');
    await inp.fill(line);
    await inp.press('Enter');
    await wait(500);
  };
  for (const n of ['فهد', 'سارة', 'نواف', 'ريم']) await chat(`${n}: دخول`);
  await wait(800);
  await shot(B, 'screen-joined', { players: B.getByText('المشاركون').first(), top: B.getByText(/أفضل/).first() });

  // 4. setup: mode, categories, answer time
  await S.getByRole('button', { name: /جاوب أو بادل/ }).first().click();
  for (const c of ['جغرافيا', 'كرة قدم', 'تاريخ']) {
    await S.getByRole('button', { name: new RegExp(`${c}$`) }).first().click();
    await wait(250);
  }
  await S.getByRole('button', { name: /^30 ث$/ }).first().click().catch(() => {});
  await shot(
    S,
    'setup',
    {
      mode: S.getByRole('button', { name: /جاوب أو بادل/ }).first(),
      modes: S.getByText('اختر الطور').first(),
      cats: S.getByRole('button', { name: /جغرافيا$/ }).first(),
      cat1: S.getByRole('button', { name: /تاريخ$/ }).first(),
      cat3: S.getByRole('button', { name: /كرة قدم$/ }).first(),
      time: S.getByRole('button', { name: /^30 ث$/ }).first(),
      start: S.getByRole('button', { name: /ابدأ اللعبة/ }).first(),
    },
    true,
  );
  await S.getByRole('button', { name: /ابدأ اللعبة/ }).click();
  await wait(2500);

  // 5. the board on the broadcast screen
  await shot(B, 'board', { cell: B.locator('button:has-text("200"):not([disabled])').first() });
  await B.locator('button:has-text("200"):not([disabled])').first().click();
  await wait(1800);

  // 6. the streamer answers first, in secret
  await shot(B, 'screen-wait', { mic: B.getByText(/الستريمر يختار/).first() });
  await S.evaluate(() => scrollTo(0, 0));
  await wait(400);
  await shot(S, 'secret', { q: S.getByText('ما هي عاصمة الإمارات؟').first(), opt: S.locator('button:has-text("أبوظبي")').first() });
  await S.locator('button:has-text("أبوظبي")').first().click();
  await wait(1200);

  // 7. viewers choose 1 (answer) or 2 (swap)
  await shot(S, 'choose', { rule: S.getByText(/اكتبوا 1/).first() });
  for (const l of ['فهد: 1', 'سارة: 2', 'نواف: 1', 'ريم: 2']) await chat(l);
  await wait(600);
  await shot(B, 'screen-choose', { players: B.getByText(/أفضل/).first() });
  await S.getByRole('button', { name: /اعرض الخيارات الآن/ }).click({ timeout: 2000 }).catch(() => {});
  await wait(1500);

  // 8. answers: the number or the answer itself
  await shot(B, 'options', { q: B.getByText('ما هي عاصمة الإمارات؟').first(), opts: B.locator('button:has-text("أبوظبي"), div:has-text("أبوظبي")').last() });
  await chat('فهد: أبوظبي');
  await wait(300);
  await chat('نواف: دبي');
  await wait(2500);

  // 9. the result
  await shot(B, 'result', {
    q: B.getByText('ما هي عاصمة الإمارات؟').first(),
    right: B.getByText('أبوظبي').first(),
    verdict: B.getByText(/الستريمر جاوب/).first(),
    board: B.getByText(/أفضل/).first(),
  });

  // 10. podium
  await S.locator('[data-hotkey="go"]').first().click({ timeout: 3000 }).catch(() => {});
  await wait(1200);
  await S.getByRole('button', { name: 'إنهاء اللعبة وعرض الفائز' }).first().click({ timeout: 3000 }).catch(() => {});
  await wait(2500);
  await shot(B, 'podium', { winner: B.getByText(/الفائز/).first() });

  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1));
  await browser.close();
})();
