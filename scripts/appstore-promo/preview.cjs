// node preview.cjs [times…]  (env CUT=master|store, VW, VH) → timeline-<cut>.json and pv/<cut>-<t>.jpg
const { chromium } = require('playwright');
const CUT = process.env.CUT || 'master', VW = +(process.env.VW || 1920), VH = +(process.env.VH || 1080);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: VW, height: VH } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`file://${__dirname}/stage.html?cut=${CUT}&shots=${process.env.SHOTS || 'site'}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const tl = await p.evaluate(() => window.TIMELINE);
  require('fs').writeFileSync(`${__dirname}/timeline-${CUT}.json`, JSON.stringify(tl, null, 1));
  console.log(CUT, 'total', tl.total.toFixed(2), tl.scenes.map((s) => `${s.key}@${s.start.toFixed(1)}`).join(' '));
  require('fs').mkdirSync(`${__dirname}/pv`, { recursive: true });
  for (const t of process.argv.slice(2).map(Number)) { await p.evaluate((t) => window.render(t), t); await p.screenshot({ path: `${__dirname}/pv/${CUT}-${VW}x${VH}-${t}.jpg`, type: 'jpeg', quality: 80 }); }
  if (errs.length) console.log('ERR', errs);
  await b.close();
})();
