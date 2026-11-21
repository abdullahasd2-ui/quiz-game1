// Renders stage.html frame by frame (30 fps, 1080x1920) in parallel chunks, each piped into its own mp4.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const FPS = +(process.env.FPS || 60), JOBS = +(process.env.JOBS || 4);
const out = path.join(__dirname, 'render');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const tl = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));
  const frames = Math.round(tl.total * FPS);
  const per = Math.ceil(frames / JOBS);
  const browser = await chromium.launch();
  const t0 = Date.now();
  await Promise.all(Array.from({ length: JOBS }, async (_, j) => {
    const a = j * per, b = Math.min(frames, a + per);
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto('file://' + path.join(__dirname, 'stage.html'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r))))));
    await page.waitForTimeout(500);
    const file = path.join(out, `part${j}.mp4`), tmp = file.replace('.mp4', '.tmp.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      await page.evaluate((t) => window.render(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % 300 === 0) console.log(`job ${j}: frame ${f}/${b} (${((Date.now() - t0) / 1000) | 0}s)`);
    }
    ff.stdin.end();
    const code = await new Promise((r) => ff.on('close', r));
    if (code !== 0) throw new Error('ffmpeg failed ' + j);
    fs.renameSync(tmp, file);
  }));
  await browser.close();
  fs.writeFileSync(path.join(out, 'list.txt'), Array.from({ length: JOBS }, (_, j) => `file 'part${j}.mp4'`).join('\n'));
  console.log('done', ((Date.now() - t0) / 1000) | 0, 's');
})();
