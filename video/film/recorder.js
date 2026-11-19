// Real-time capture of a Playwright page via the Chrome DevTools screencast.
// Frames arrive whenever Chromium paints, each with a timestamp; compose.py later
// resamples them onto an exact 30 fps timeline. We also log the (invisible in
// headless) mouse position and click/key events, so the compositor can draw a
// cursor and the audio script can place a sound on every real action.

const fs = require('fs');
const path = require('path');

class Recorder {
  constructor(page, dir) {
    this.page = page; this.dir = dir; this.frames = []; this.events = []; this.t0 = null;
    fs.mkdirSync(dir, { recursive: true });
  }

  now() { return (Date.now() - this.t0) / 1000; }

  async start() {
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.t0 = Date.now();
    let n = 0;
    this.cdp.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
      // Prefer Chromium's own paint timestamp over our receipt time.
      const t = metadata && metadata.timestamp ? metadata.timestamp - this.t0 / 1000 : this.now();
      const name = `f${String(n++).padStart(6, '0')}.jpg`;
      fs.writeFileSync(path.join(this.dir, name), Buffer.from(data, 'base64'));
      this.frames.push({ t, name });
      try { await this.cdp.send('Page.screencastFrameAck', { sessionId }); } catch (_) {}
    });
    const vp = this.page.viewportSize();
    // No maxWidth/maxHeight: frames come at the forced device scale (see harness.js).
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
    this.mouse = { x: vp.width / 2, y: vp.height / 2 };
    // Align the page's performance clock with ours, for the cursor log.
    const n0 = Date.now();
    this.perf0 = await this.page.evaluate(() => performance.now());
    this.perfAt = ((n0 + Date.now()) / 2 - this.t0) / 1000;
    this.cssToSrc = null;
  }

  mark(type, extra = {}) { this.events.push({ t: this.now(), type, ...extra }); }

  // Log an element's box (CSS px) so the compositor can ring it.
  async rect(name, locator) {
    const b = await locator.boundingBox();
    this.events.push({ t: this.now(), type: 'rect', name, box: [b.x, b.y, b.width, b.height] });
    return b;
  }

  // Smooth, eased mouse travel. Duration in seconds; logged every step.
  async moveTo(x, y, dur = 0.8) {
    const { x: x0, y: y0 } = this.mouse;
    const steps = Math.max(2, Math.round(dur * 60));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const nx = x0 + (x - x0) * e, ny = y0 + (y - y0) * e;
      await this.page.mouse.move(nx, ny);
      this.mouse = { x: nx, y: ny };
      this.mark('mouse', { x: nx, y: ny });
      await this.page.waitForTimeout(1000 / 60);
    }
  }

  async down() { this.mark('down', this.mouse); await this.page.mouse.down(); }
  async up() { this.mark('up', this.mouse); await this.page.mouse.up(); }
  async click() { await this.down(); await this.page.waitForTimeout(90); await this.up(); }
  async hold(sec) { await this.page.waitForTimeout(sec * 1000); }

  async type(text, perChar = 0.085) {
    for (const ch of text) {
      this.mark('key', { ch });
      await this.page.keyboard.type(ch);
      await this.page.waitForTimeout(perChar * 1000 * (ch === ' ' ? 1.6 : 0.8 + Math.random() * 0.5));
    }
  }

  async stop() {
    await this.cdp.send('Page.stopScreencast');
    await this.page.waitForTimeout(300);
    // Cursor shapes for this take, mapped onto the take's clock. The shape in force
    // when the take starts is carried in at t=0.
    const log = await this.page.evaluate(() => window.__cursorLog || []);
    const toT = (pt) => this.perfAt + (pt - this.perf0) / 1000;
    let carried = null;
    for (const c of log) {
      const t = toT(c.t);
      if (t < 0) { carried = c; continue; }
      this.events.push({ t, type: 'cursor', c: c.c, tag: c.tag });
    }
    if (carried) this.events.push({ t: 0, type: 'cursor', c: carried.c, tag: carried.tag });
    this.events.sort((a, b) => a.t - b.t);
    const vp = this.page.viewportSize();
    fs.writeFileSync(path.join(this.dir, 'timeline.json'), JSON.stringify({ frames: this.frames, events: this.events, duration: this.now(), cssToSrc: 1920 / vp.width }));
  }
}

module.exports = { Recorder };
