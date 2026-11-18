// Records the stream guide: the real site in test mode, with Arabic captions laid over each step.
// Writes one webm per page and marks.json (which part of which page goes where in the final cut).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || require('path').join(__dirname, 'out');
const BASE = process.env.BASE || 'http://localhost:3999';
const VIEW = { width: 1280, height: 720 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// How long each voice line is (seconds), from synth.py; a step lasts its line plus a breath.
const DUR = JSON.parse(fs.readFileSync(require('path').join(OUT, 'durations.json'), 'utf8'));

const CAPTION_CSS = `
  #guide-cap{position:fixed;inset-inline:0;bottom:22px;z-index:2147483647;display:flex;justify-content:center;pointer-events:none;font-family:Tajawal,system-ui,sans-serif}
  #guide-cap>div{max-width:1100px;display:flex;align-items:center;gap:14px;background:rgba(7,7,26,.93);border:2px solid #f7c948;border-radius:20px;padding:14px 26px;box-shadow:0 20px 60px -10px rgba(0,0,0,.9),0 0 40px -12px #f7c948;animation:capin .35s cubic-bezier(.2,.9,.3,1)}
  #guide-cap b.n{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:999px;background:linear-gradient(90deg,#ff6b35,#f7c948);color:#000;font:400 26px Lalezar,Tajawal,sans-serif}
  #guide-cap span{color:#fff;font-weight:800;font-size:27px;line-height:1.45}
  #guide-cap small{display:block;color:#ffffffb3;font-weight:700;font-size:19px}
  @keyframes capin{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
  [aria-haspopup="dialog"][title*="Ctrl+K"], [role="status"].fixed {display:none!important}
`;
async function prep(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jab:qa:seen', '1');
      sessionStorage.setItem('jab:intro', '1');
    } catch {}
  });
}
async function caption(page, n, text, sub = '') {
  await page.evaluate(
    ({ n, text, sub, css }) => {
      if (!document.getElementById('guide-css')) {
        const s = document.createElement('style');
        s.id = 'guide-css';
        s.textContent = css;
        document.head.appendChild(s);
      }
      document.getElementById('guide-cap')?.remove();
      const d = document.createElement('div');
      d.id = 'guide-cap';
      d.dir = 'rtl';
      d.innerHTML = `<div>${n ? `<b class="n">${n}</b>` : ''}<span>${text}${sub ? `<small>${sub}</small>` : ''}</span></div>`;
      document.body.appendChild(d);
    },
    { n, text, sub, css: CAPTION_CSS },
  );
}
async function card(page, title, lines) {
  await page.evaluate(
    ({ title, lines }) => {
      document.getElementById('guide-cap')?.remove();
      const d = document.createElement('div');
      d.id = 'guide-card';
      d.dir = 'rtl';
      d.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(120% 80% at 50% 0%,#2a1460,#07071a 65%);color:#fff;font-family:Tajawal,sans-serif;text-align:center';
      d.innerHTML =
        `<div style="font:400 64px Lalezar,Tajawal,sans-serif;background:linear-gradient(90deg,#38bdf8,#a855f7,#f472b6);-webkit-background-clip:text;color:transparent;line-height:1.3">${title}</div>` +
        lines.map((l) => `<div style="font-size:28px;font-weight:800;opacity:.92;max-width:1000px;line-height:1.5">${l}</div>`).join('');
      document.body.appendChild(d);
    },
    { title, lines },
  );
}
const clear = (page) => page.evaluate(() => { document.getElementById('guide-cap')?.remove(); document.getElementById('guide-card')?.remove(); });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const mk = async () => {
    const ctx = await browser.newContext({ viewport: VIEW, recordVideo: { dir: OUT, size: VIEW }, locale: 'ar' });
    const page = await ctx.newPage();
    await prep(page);
    return { ctx, page, t0: Date.now() };
  };
  const marks = [];
  const S = await mk(); // the streamer's page
  const at = (w) => (Date.now() - w.t0) / 1000;
  const seg = async (w, key, fn) => {
    const start = at(w);
    if (fn) await fn();
    const left = (DUR[key] + 1.1) - (at(w) - start);
    if (left > 0) await wait(left * 1000);
    marks.push({ key, who: w === S ? 'S' : w === B ? 'B' : 'T', start, end: at(w) });
  };
  let B = null;

  // Title
  await S.page.goto(`${BASE}/kick/quiz`);
  await wait(1800);
  await seg(S, 'title', () => card(S.page, 'جاوب أو بادل في البث', ['العب مع شات Kick: المشاهدين يدخلون ويجاوبون من الشات', 'شرح سريع لكل الخطوات 👇']));
  await clear(S.page);

  // 1. Channel name
  await seg(S, 's1', async () => {
    await caption(S.page, '1', 'اكتب اسم قناتك في Kick ثم «ابدأ البث»', 'أو اربط حسابك مرة وحدة ويبقى مربوط');
    await S.page.getByPlaceholder('streamer_name').fill('');
    await S.page.getByPlaceholder('streamer_name').pressSequentially('abdullahzx777', { delay: 120 });
  });
  await S.page.getByText('تجربة بدون Kick').click();
  await wait(1500);

  // 2. Broadcast screen link
  await seg(S, 's2', async () => {
    await caption(S.page, '2', 'انسخ رابط «شاشة البث» وحطه في OBS كمصدر متصفح', 'هذي الشاشة اللي يشوفها المشاهدين — وصفحتك هذي لك إنت بس');
    await S.page.getByRole('button', { name: 'نسخ الرابط' }).hover();
  });
  const code = await S.page.evaluate(() => JSON.parse(sessionStorage.getItem('kick-sync') || '{}').code);
  B = await mk();
  await B.page.goto(`${BASE}/kick/quiz/screen?code=${code}`);
  await wait(2500);

  // 3. Viewers join
  const chat = async (line) => {
    const box = S.page.getByPlaceholder('ali: دخول');
    await box.fill(line);
    await box.press('Enter');
    await wait(450);
  };
  await seg(B, 's3', async () => {
    await caption(B.page, '3', 'المشاهدين يكتبون «دخول» في الشات ويدخلون اللعبة', 'وكل لاعب نقاطه لحاله');
    for (const n of ['فهد', 'سارة', 'نواف', 'ريم']) await chat(`${n}: دخول`);
  });

  // 4. Setup on the streamer page
  await seg(S, 's4', async () => {
    await caption(S.page, '4', 'اختر «جاوب أو بادل» والفئات ووقت الإجابة، وبعدين «ابدأ اللعبة»');
    await S.page.mouse.wheel(0, 380);
    await wait(900);
    await S.page.getByRole('button', { name: /جاوب أو بادل/ }).first().click();
    for (const c of ['جغرافيا', 'كرة قدم', 'تاريخ']) {
      await wait(600);
      await S.page.getByRole('button', { name: new RegExp(`${c}$`) }).first().click();
    }
    await S.page.mouse.wheel(0, 600);
    await wait(800);
  });
  await S.page.getByRole('button', { name: /ابدأ اللعبة/ }).click();
  await wait(1500);

  // 5. Pick from the board on the broadcast screen
  await seg(B, 's5', async () => {
    await caption(B.page, '5', 'اختر السؤال من اللوحة في شاشة البث', 'كل سؤال له نقاط من 100 إلى 500');
    await wait(2500);
    const cells = B.page.locator('button:has-text("200"):not([disabled])');
    await cells.nth(0).click();
  });
  await wait(1200);

  // 6. The streamer answers first, in secret
  await seg(S, 's6', async () => {
    await S.page.mouse.wheel(0, -2000);
    await caption(S.page, '6', 'إنت أول: اختر جوابك — أو بادل مع واحد من المشاركين', 'اختيارك مخفي عن الشات');
    await wait(2500);
    await S.page.locator('button:has-text("أبوظبي")').first().click().catch(async () => S.page.locator('[data-hotkey="1"]').first().click());
  });
  await wait(800);

  // 7. Viewers choose 1 or 2
  await seg(B, 's7', async () => {
    await caption(B.page, '7', 'كل مشاهد يكتب 1 يجاوب بنفسه، أو 2 يبادل معك', 'لو بادل وجوابك صح ياخذ دبل — ولو غلط تنقص نقاطه');
    for (const l of ['فهد: 1', 'سارة: 2', 'نواف: 1', 'ريم: 2']) await chat(l);
  });
  await S.page.getByRole('button', { name: /اعرض الخيارات الآن/ }).click({ timeout: 1500 }).catch(() => {});
  await wait(1200);

  // 8. Answers
  await seg(B, 's8', async () => {
    await caption(B.page, '8', 'اللي كتب 1 يكتب رقم الجواب من 1 إلى 4، أو يكتب الجواب نفسه', 'والسؤال يخلص أول ما يجاوب الكل');
    await wait(3200);
    for (const l of ['فهد: أبوظبي', 'نواف: دبي']) await chat(l);
    await wait(1200);
  });
  await S.page.getByRole('button', { name: /أنهِ السؤال/ }).click({ timeout: 1500 }).catch(() => {});
  await wait(1500);

  // 9. Result
  await seg(B, 's9', async () => {
    await caption(B.page, '9', 'تطلع النتيجة والترتيب: مين جاوب صح، ومين بادل وكسب دبل', '🔥 وثلاث أجوبة صح ورا بعض = الثالث دبل');
  });

  // 10. Podium
  // Back to the board, then end the game from there (that is where the button is).
  await S.page.locator('[data-hotkey="go"]').first().click({ timeout: 3000 }).catch(() => {});
  await wait(1200);
  await S.page.getByRole('button', { name: 'إنهاء اللعبة وعرض الفائز' }).first().click({ timeout: 3000 }).catch(() => {});
  await wait(1500);
  await seg(B, 's10', async () => {
    await caption(B.page, '10', 'في النهاية يطلع الفائزين على منصة التتويج 🏆');
  });

  // End card
  await seg(B, 'end', () =>
    card(B.page, 'جاهز تبدأ البث؟', [
      '📖 التفاصيل والنقاط لكل طور في «طريقة اللعب»',
            '⌨️ Enter للخطوة التالية · ⚡ مركز الاختصارات تحت',
    ]),
  );

  const sv = await S.page.video().path();
  const bv = await B.page.video().path();
  await S.ctx.close();
  await B.ctx.close();
  await browser.close();
  fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify({ S: sv, B: bv, marks }, null, 1));
  console.log(JSON.stringify(marks));
})();
