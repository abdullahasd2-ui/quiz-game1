const { chromium } = require('playwright');
(async () => {
  const times = process.argv.slice(2).map(Number);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + __dirname + '/stage.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800);
  const tl = await p.evaluate(() => window.TIMELINE);
  require('fs').writeFileSync(__dirname + '/timeline.json', JSON.stringify(tl, null, 1));
  console.log('total', tl.total.toFixed(2), tl.scenes.map((s) => `${s.key}@${s.start.toFixed(1)}`).join(' '));
  for (const t of times) { await p.evaluate((t) => window.render(t), t); await p.screenshot({ path: `${__dirname}/pv/${t}.jpg`, type: 'jpeg', quality: 70 }); }
  if (errs.length) console.log('ERR', errs.slice(0, 5));
  await b.close();
})();
