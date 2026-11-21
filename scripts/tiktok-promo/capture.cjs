// TikTok promo: captures the whole main game (never the Kick pages) from a local server with the full question bank.
// Phones are 390×844 @3x, the TV is 1280×720 @2x. Writes shots/<name>.jpg and shots/shots.json (sizes + element boxes).
// Each part plays a real room; a part that fails is logged and the others still run.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const BASE = process.env.BASE || 'http://localhost:4000';
const DB = process.env.DB || 'promo';
const OUT = path.join(__dirname, 'shots');
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const meta = {};
const RIGHT = Object.fromEntries(
  execSync(`PGPASSWORD=quiz psql -h /tmp -p 5434 -U quiz ${DB} -At -F '\t' -c "select text, options->>correct_index from questions"`)
    .toString().trim().split('\n').map((l) => l.split('\t')),
);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  try { Object.assign(meta, JSON.parse(fs.readFileSync(path.join(OUT, 'shots.json'), 'utf8'))); } catch {}
  const browser = await chromium.launch();
  const mk = async (kind = 'phone') => {
    const ctx = await browser.newContext(
      kind === 'tv'
        ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, locale: 'ar' }
        : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'ar', isMobile: true, hasTouch: true },
    );
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: FONT_CSS }));
    await ctx.route(/fonts\.gstatic\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try { localStorage.setItem('jab:qa:seen', '1'); sessionStorage.setItem('jab:intro', '1'); } catch {}
      const s = document.createElement('style');
      s.textContent = '[aria-haspopup="dialog"][title*="Ctrl+K"]{display:none!important} *{caret-color:transparent!important} [data-sonner-toaster]{display:none!important}';
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
      else console.warn('  no box', name, k);
    }
    await p.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 92 });
    meta[name] = { w: vp.width, h: vp.height, boxes: b };
    fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(meta, null, 1));
    console.log('shot', name, Object.keys(b).join(','));
  };
  const scrollTo = async (p, sel, off = 70) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); if (e) scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, off]); await wait(600); };
  const codeOf = async (p) => (await p.getByTestId('room-code').first().innerText()).trim();

  /** Host makes a room from the home page. */
  async function create(p, { variant = 'جاوب أو بادل', extra = false, solo = false, tv = false, name = 'الصقور' } = {}) {
    await p.goto(BASE + '/');
    await wait(1400);
    if (extra) await p.getByRole('button', { name: /أطوار إضافية/ }).click();
    await p.locator('#modes button[aria-pressed]', { hasText: variant }).first().click();
    if (solo) await p.getByRole('button', { name: /^🙋 فردي/ }).click();
    if (tv) await p.getByRole('button', { name: /تلفاز/ }).first().click();
    if (!tv) await p.locator('#create-name').fill(name);
    await p.getByRole('button', { name: tv ? /إنشاء غرفة للتلفاز/ : /^إنشاء غرفة$/ }).click();
    await p.getByTestId('room-code').waitFor({ timeout: 8000 });
    await wait(800);
    return codeOf(p);
  }
  /** A phone joins with the code: a team (0/1), or solo with only a name. */
  async function join(p, code, { team = 1, nick = 'نورة', teamName = 'النمور', solo = false } = {}) {
    await p.goto(`${BASE}/?code=${code}${solo ? '&solo=1' : ''}`);
    await wait(1200);
    if (!solo) await p.getByRole('button', { name: team ? /الفريق الثاني/ : /الفريق الأول/ }).click();
    await p.getByPlaceholder('مثال: سعد').fill(nick);
    if (!solo && teamName) await p.getByPlaceholder('مثال: الصقور').fill(teamName).catch(() => {});
    await p.getByRole('button', { name: /انضمام$/ }).last().click();
    await wait(1500);
  }
  async function pickCats(p, names, sec = '45') {
    for (const c of names) { await p.getByRole('button', { name: new RegExp(c) }).first().click(); await wait(150); }
    await p.getByRole('radio', { name: new RegExp(sec) }).click().catch(() => {});
  }
  const start = async (p) => { await p.getByRole('button', { name: /ابدأ اللعبة/ }).click(); await wait(2200); };
  /** Answer the question on the screen right (or wrong). */
  async function answer(p, right = true) {
    const body = await p.locator('body').innerText();
    const q = Object.keys(RIGHT).find((t) => body.includes(t));
    const names = (await p.locator('button:visible').allInnerTexts()).map((t) => t.split('\n')[0].trim()).filter(Boolean);
    const r = q && RIGHT[q];
    const pick = right && r && names.includes(r) ? r : names.find((n) => n !== r && !/خروج|اللاعبون|التالي|⌨️|🔊|Enter|الاختصارات|جاوب|بادل|اقلب|اعكس/.test(n));
    if (pick) await p.getByRole('button', { name: pick, exact: true }).first().click({ timeout: 2000 }).catch(() => {});
    return r;
  }
  const part = async (name, fn) => {
    if (ONLY && !ONLY.includes(name)) return;
    console.log('== part', name);
    try { await fn(); } catch (e) { console.error('!! part failed', name, e.message.split('\n')[0]); }
  };

  // ── 1. The home page ──
  await part('home', async () => {
    const A = await mk();
    await A.goto(BASE + '/');
    await wait(1800);
    await shot(A, 'home-hero', { title: A.locator('h1').first(), start: A.getByRole('button', { name: /ابدأ اللعب/ }) });
    await A.getByRole('button', { name: /أطوار إضافية/ }).click();
    await scrollTo(A, '#modes', 10);
    await shot(A, 'home-modes', { modes: A.locator('#modes') });
    await A.evaluate(() => scrollBy(0, 520));
    await wait(500);
    await shot(A, 'home-modes2', {});
    await scrollTo(A, '#play-panel', 10);
    await A.getByRole('button', { name: /^🙋 فردي/ }).click();
    await wait(300);
    await shot(A, 'home-solo', { solo: A.getByRole('button', { name: /^🙋 فردي/ }), teams: A.getByRole('button', { name: /^👥 فريقين/ }), tv: A.getByRole('button', { name: /تلفاز/ }).first() });
    await A.getByRole('button', { name: /^👥 فريقين/ }).click();
    await A.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => e.innerText.includes('فئات') || e.innerText.includes('من التاريخ')); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 90); });
    await wait(600);
    await shot(A, 'home-cats', {});
    await A.context().close();
  });

  // ── 2. A full team game: create, join (3 players), categories, board, swap, answer, picture question, final ──
  await part('teams', async () => {
    const A = await mk(), B = await mk(), C = await mk();
    const code = await create(A, {});
    await scrollTo(A, '#play-panel', 10).catch(() => {});
    await A.evaluate(() => scrollTo(0, 0));
    await shot(A, 'lobby-wait', { code: A.getByTestId('room-code'), qr: A.locator('figure').first() });
    await B.goto(`${BASE}/?code=${code}`);
    await wait(1200);
    await B.getByRole('button', { name: /الفريق الثاني/ }).click();
    await B.getByPlaceholder('مثال: سعد').fill('نورة');
    await B.getByPlaceholder('مثال: الصقور').fill('النمور');
    await scrollTo(B, '#play-panel', 10);
    await shot(B, 'join', { code: B.locator('input[placeholder="• • • • • •"]'), team: B.getByRole('button', { name: /الفريق الثاني/ }), go: B.getByRole('button', { name: /انضمام$/ }).last() });
    await B.getByRole('button', { name: /انضمام$/ }).last().click();
    await wait(1500);
    await join(C, code, { team: 0, nick: 'فهد', teamName: '' });
    await wait(800);
    await shot(A, 'lobby-full', { teams: A.getByText('النمور').first() });
    await pickCats(A, ['جغرافيا', 'كرة قدم', 'تاريخ', 'أعلام دول', 'سيارات', 'اكتشف الصورة'], '45');
    await A.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await wait(500);
    await shot(A, 'cats', { start: A.getByRole('button', { name: /ابدأ اللعبة/ }), time: A.getByRole('radio', { name: /45/ }) });
    await A.evaluate(() => scrollTo(0, 0));
    await wait(300);
    await shot(A, 'cats-top', {});
    // Play with three of them (so the game reaches its end).
    for (const c of ['تاريخ', 'أعلام دول', 'سيارات']) await A.getByRole('button', { name: new RegExp(c) }).first().click();
    await start(A);
    await shot(A, 'board', { cell: A.locator('button', { hasText: /^300$/ }).first(), row5: A.locator('button', { hasText: /^500$/ }).first() });
    await A.locator('button', { hasText: /^300$/ }).first().click();
    await wait(1800);
    await shot(A, 'choose', { swap: A.getByRole('button', { name: /بادل جواب الخصم/ }), answer: A.getByRole('button', { name: /أجاوب بنفسي/ }), q: A.locator('.text-\\[17px\\]').first() });
    await shot(C, 'member-vote', {});
    await A.getByRole('button', { name: /بادل جواب الخصم/ }).click();
    await wait(500);
    await shot(A, 'swapped', {});
    await B.getByRole('button', { name: /أجاوب بنفسي/ }).click();
    await wait(1500);
    await shot(B, 'options', { timer: B.locator('[role="timer"]').first() });
    await answer(B, true);
    await wait(500);
    await shot(B, 'picked', {});
    await wait(1600);
    await shot(A, 'result', { plus: A.getByText(/\+/).first() });
    await shot(B, 'result-b', {});
    // The rest of the board; on the way, the picture question and a streak.
    let pic = 0;
    for (let guard = 0; guard < 30; guard++) {
      const next = A.getByRole('button', { name: /التالي|النتيجة النهائية/ });
      if (await next.count()) { await next.first().click(); await wait(1300); }
      if (await A.getByText(/الفائز|تعادل/).count() && !(await A.locator('button', { hasText: /^[1-5]00$/ }).count())) break;
      let picker = null;
      for (const p of [A, B]) {
        const cells = p.locator('button:not([disabled])', { hasText: /^[1-5]00$/ });
        if (await cells.count()) {
          picker = p;
          // the picture category column first (it is the last column), to film it
          const n = await cells.count();
          await cells.nth(pic < 2 ? n - 1 : 0).click().catch(() => {});
          await wait(1500);
          break;
        }
      }
      if (!picker) { await wait(800); continue; }
      for (const p of [A, B]) await p.getByRole('button', { name: /أجاوب بنفسي/ }).click({ timeout: 2500 }).catch(() => {});
      await wait(1300);
      const img = await A.locator('main img').count();
      if (img && pic < 2) {
        await shot(A, pic ? 'picture2' : 'picture', {});
        pic++;
      }
      await answer(A, true);
      await answer(B, Math.random() < 0.5);
      await wait(1800);
      if (img && pic <= 2 && !meta['picture-result']) await shot(A, 'picture-result', {});
      const streak = await A.getByText(/الجاية دبل/).count();
      if (streak && !meta.streak) await shot(A, 'streak', { fire: A.getByText(/الجاية دبل/).first() });
    }
    await wait(1500);
    await shot(A, 'final', { win: A.getByText(/الفائز|تعادل/).first() });
    for (const p of [A, B, C]) await p.context().close();
  });

  // ── 3. The other modes: one question screen each ──
  for (const [key, variant, extra] of [
    ['flip', 'جاوب أو اقلب', false],
    ['triple', 'جاوب أو بادل أو اعكس', false],
  ]) {
    await part(key, async () => {
      const A = await mk(), B = await mk();
      const code = await create(A, { variant, extra });
      await join(B, code, {});
      await pickCats(A, ['جغرافيا', 'كرة قدم', 'تاريخ']);
      await start(A);
      await A.locator('button', { hasText: /^200$/ }).first().click();
      await wait(1800);
      await shot(A, `${key}-choose`, {});
      await A.context().close();
      await B.context().close();
    });
  }

  await part('list', async () => {
    const A = await mk(), B = await mk();
    const code = await create(A, { variant: 'عدّها' });
    await join(B, code, {});
    await wait(1500);
    await shot(A, 'list-lobby', {});
    await A.getByRole('button', { name: /ابدأ اللعبة/ }).click();
    await wait(1800);
    await shot(A, 'list-pick', {});
    await A.getByRole('button', { name: /جغرافيا/ }).first().click();
    await wait(1800);
    const words = ('السعودية مصر الإمارات قطر الكويت الأردن المغرب العراق عمان البحرين تونس الجزائر لبنان سوريا اليمن ليبيا السودان فلسطين فرنسا ألمانيا إسبانيا إيطاليا البرازيل الأرجنتين اليابان الصين الهند تركيا روسيا أمريكا كندا '
      + 'الرياض جدة مكة المدينة الدمام القاهرة الإسكندرية دبي أبوظبي الدوحة عمّان بيروت بغداد دمشق إسطنبول أنقرة إزمير أنطاليا بورصة طرابزون قونية لندن باريس مدريد روما برلين طوكيو '
      + 'النيل الفرات دجلة الأمازون آسيا أفريقيا أوروبا الهادي الأطلسي الهندي').split(' ');
    for (const w of words) {
      await A.getByLabel('جوابك').fill(w);
      await A.getByLabel('جوابك').press('Enter');
      await wait(120);
    }
    for (const w of words.slice(0, 6)) { await B.getByLabel('جوابك').fill(w); await B.getByLabel('جوابك').press('Enter'); await wait(200); }
    await wait(800);
    await shot(A, 'list-play', {});
    await A.context().close();
    await B.context().close();
  });

  await part('hide', async () => {
    const A = await mk(), B = await mk();
    const code = await create(A, { variant: 'خبّي أو اكشف', extra: true });
    await join(B, code, {});
    await pickCats(A, ['جغرافيا', 'كرة قدم', 'تاريخ']);
    await A.getByRole('button', { name: /ابدأ اللعبة/ }).click();
    await wait(2000);
    await shot(A, 'hide-hide', {});
    await A.locator('main button').filter({ hasText: /^4$/ }).first().click().catch(() => {});
    await wait(1500);
    await shot(B, 'hide-guess', {});
    await A.context().close();
    await B.context().close();
  });

  await part('solo', async () => {
    const A = await mk(), B = await mk(), C = await mk();
    const code = await create(A, { solo: true, name: 'علي' });
    await join(B, code, { solo: true, nick: 'سارة' });
    await join(C, code, { solo: true, nick: 'فهد' });
    await wait(800);
    await shot(A, 'solo-lobby', {});
    await pickCats(A, ['جغرافيا', 'كرة قدم', 'تاريخ']);
    await start(A);
    await A.locator('button', { hasText: /^200$/ }).first().click();
    await wait(1600);
    await B.getByRole('button', { name: /بادل/ }).first().click();
    await wait(400);
    await shot(B, 'solo-swap', {});
    for (const p of [A, B, C]) await p.context().close();
  });

  await part('tv', async () => {
    const T = await mk('tv'), A = await mk(), B = await mk();
    const code = await create(T, { tv: true });
    await shot(T, 'tv-lobby', {});
    await join(A, code, { team: 0, nick: 'سعد', teamName: 'الصقور' });
    await join(B, code, { team: 1, nick: 'نورة', teamName: 'النمور' });
    await wait(1200);
    await pickCats(T, ['جغرافيا', 'كرة قدم', 'تاريخ', 'أعلام دول']);
    await start(T);
    await shot(T, 'tv-board', {});
    await T.locator('button', { hasText: /^200$/ }).first().click();
    await wait(1800);
    await shot(T, 'tv-question', {});
    for (const p of [T, A, B]) await p.context().close();
  });

  await browser.close();
  console.log('done', Object.keys(meta).length, 'shots');
})();
