// Renders the stage frame by frame.
//   node compose/render.js --stills 3,20.5,48   -> out/stills/t003.00.png ...
//   node compose/render.js                       -> out/picture.mp4 (silent, exact frame count)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const OUT = path.resolve(__dirname, '..', 'out');
const STAGE = 'file://' + path.resolve(__dirname, 'stage.html');

(async () => {
  const args = process.argv.slice(2);
  const stillsArg = args.includes('--stills') ? args[args.indexOf('--stills') + 1] : null;
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('[stage]', e.message); process.exitCode = 1; });
  await page.goto(STAGE);
  const ready = await page.evaluate(() => window.STAGE_READY);
  console.log(ready.fonts.join(' | '));
  if (!ready.allLoaded) throw new Error('caption fonts did not load; refusing to render');
  const fps = await page.evaluate(() => SCRIPT.fps);
  const total = ready.total;

  if (stillsArg) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const t of stillsArg.split(',').map(Number)) {
      await page.evaluate((x) => window.renderAt(x), t);
      const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
      await page.screenshot({ path: f });
      console.log(f);
    }
    await browser.close();
    return;
  }

  const frames = Math.round(total * fps);
  console.log(`rendering ${frames} frames (${total}s at ${fps} fps)`);
  const out = path.join(OUT, 'picture.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((x) => window.renderAt(x), i / fps);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})().catch((e) => { console.error(e); process.exit(1); });
