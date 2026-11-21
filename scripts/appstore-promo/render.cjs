// Renders stage.html frame by frame (env CUT, VW, VH, FPS=30, JOBS) into render-<cut>-<w>x<h>/part*.mp4 (near-lossless).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const CUT = process.env.CUT || 'master', VW = +(process.env.VW || 1920), VH = +(process.env.VH || 1080), FPS = +(process.env.FPS || 30), JOBS = +(process.env.JOBS || 6);
const out = path.join(__dirname, `render-${CUT}-${VW}x${VH}`);
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(__dirname, `timeline-${CUT}.json`), 'utf8'));
  const frames = Math.round(tl.total * FPS), per = Math.ceil(frames / JOBS);
  const browser = await chromium.launch(); const t0 = Date.now();
  await Promise.all(Array.from({ length: JOBS }, async (_, j) => {
    const a = j * per, b = Math.min(frames, a + per);
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    await page.goto(`file://${__dirname}/stage.html?cut=${CUT}&shots=${process.env.SHOTS || 'site'}`);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))));
    await page.waitForTimeout(500);
    const file = path.join(out, `part${j}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    if ((await new Promise((r) => ff.on('close', r))) !== 0) throw new Error('ffmpeg ' + j);
  }));
  await browser.close();
  fs.writeFileSync(path.join(out, 'list.txt'), Array.from({ length: JOBS }, (_, j) => `file 'part${j}.mp4'`).join('\n'));
  console.log('done', CUT, VW + 'x' + VH, ((Date.now() - t0) / 1000) | 0, 's');
})();
