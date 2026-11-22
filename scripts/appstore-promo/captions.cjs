// Caption overlays for the App Store app preview: transparent 886×1920 PNGs, Arabic text on a soft dark band, set
// at the bottom (or the top where the app's buttons sit low). Text only: nothing that looks like app UI.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'fonts.css'), 'utf8');
const OUT = path.join(__dirname, 'captions');
const CAPS = {
  c1: { big: 'جاوب أو بادل', small: 'لعبة أسئلة جماعية مع أصحابك' },
  c2: { big: 'أطوار لعب مختلفة', small: 'اختر الطور اللي يناسبكم' },
  c3: { big: 'أنشئ غرفة', small: 'سمّ فريقك وابدأ' },
  c4: { big: 'أصحابك ينضمون بالكود', small: 'كل واحد من جواله' },
  c5: { big: 'اختاروا الفئات', small: 'تاريخ، أعلام، سيارات وغيرها', top: true },
  c6: { big: 'جاوب… أو بادل!', small: 'خذ جواب الخصم إذا تشك بجوابك' },
  c7: { big: 'النقاط على طول', small: 'وتعرف مين جاوب صح', top: true },
  c8: { big: 'طور «عدّها»', small: 'اكتب أكبر عدد من الأجوبة قبل الوقت' },
  c9: { big: 'مين بيفوز؟', small: 'جاوب أو بادل' },
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 886, height: 1920 } });
  for (const [k, c] of Object.entries(CAPS)) {
    await p.setContent(`<html dir="rtl"><head><style>${FONT_CSS}
      html,body{margin:0;background:transparent;width:886px;height:1920px;overflow:hidden}
      .band{position:absolute;left:0;right:0;${c.top ? 'top:0;padding:150px 50px 120px;background:linear-gradient(180deg,rgba(8,6,24,.92),rgba(8,6,24,.75) 60%,transparent)' : 'bottom:0;padding:130px 50px 120px;background:linear-gradient(0deg,rgba(8,6,24,.94),rgba(8,6,24,.78) 60%,transparent)'};text-align:center}
      .big{font-family:Lalezar;font-size:96px;line-height:1.15;color:#fff;text-shadow:0 6px 24px rgba(0,0,0,.6)}
      .big b{color:#f7c948;font-weight:400}
      .small{font-family:Tajawal,sans-serif;font-weight:800;font-size:44px;color:rgba(255,255,255,.88);margin-top:14px}
      </style></head><body><div class="band"><div class="big">${c.big.replace('بادل', '<b>بادل</b>')}</div><div class="small">${c.small}</div></div></body></html>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `${k}.png`), omitBackground: true });
    console.log('caption', k);
  }
  await b.close();
})();
