// Films every take of the explainer through real input on the real app.
// Usage: node film/film.js            (needs the emulators running: npm run emulators)
// Output: out/clips/<take>/f*.jpg + timeline.json, and out/clips/index.js for the stage.

const fs = require('fs');
const path = require('path');
const { launch, login, ORIGIN } = require('./harness');
const { Recorder } = require('./recorder');
const seed = require('./seed');

const OUT = path.resolve(__dirname, '..', 'out', 'clips');
const WEEK = seed.WEEK;
// Study Tables is a day-view resource: slot ids end with the table's index.
const slot = (day, time, table) => `[data-slot-id="res-tables_${WEEK}_${day}_${time}_${table}"]`;
const block = (name) => `.booking-float:has-text("${name}")`;

async function center(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('not visible: ' + sel);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}

async function take(page, name, mouse, fn) {
  const rec = new Recorder(page, path.join(OUT, name));
  await rec.start();
  rec.mouse = { ...mouse };
  await page.mouse.move(mouse.x, mouse.y);
  rec.mark('mouse', mouse);
  await fn(rec);
  await rec.stop();
  console.log(`take ${name}: ${rec.frames.length} frames, ${rec.now().toFixed(1)}s`);
  return rec.mouse;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  await seed.main();
  const { browser, page } = await launch();
  let mouse = { x: 1100, y: 640 };

  // 1. Sign in with the shared access code.
  await page.goto(ORIGIN + '/');
  await page.waitForSelector('#loginPass');
  await page.waitForTimeout(600);
  mouse = await take(page, 'login', mouse, async (r) => {
    await r.hold(1.2);
    const f = await center(page, '#loginPass');
    await r.moveTo(f.x - 60, f.y, 1.1); await r.hold(0.2); await r.click();
    await r.hold(0.4);
    await r.type(seed.PASSWORD, 0.075);
    await r.hold(0.5);
    const btn = await center(page, '.login-box button');
    await r.moveTo(btn.x + 20, btn.y, 0.8); await r.hold(0.25); await r.click();
    await page.waitForSelector('.booking-float');
    await r.moveTo(1180, 118, 1.4);          // park in the empty header area
    await r.hold(5.0);
  });

  // 2. Read the day: resource menu, one column per table, the red line for now.
  mouse = await take(page, 'read', mouse, async (r) => {
    await r.rect('resourceSelect', page.locator('#resourceSelect'));
    await r.hold(1.0);
    const sel = await center(page, '#resourceSelect');
    await r.moveTo(sel.x + 40, sel.y + 2, 1.2);
    await r.hold(5.0);
    await r.moveTo(1180, 118, 1.4);
    await r.hold(14.0);
  });

  // 3. Book it: go to tomorrow, drag Table 2 from 2:00 to 4:00, name, note, save.
  mouse = await take(page, 'book', mouse, async (r) => {
    await r.rect('nextDay', page.locator('.btn-nav').nth(1));
    await r.hold(4.0);
    const next = await center(page, '.btn-nav >> nth=1');
    await r.moveTo(next.x, next.y, 1.3); await r.hold(0.4); await r.click();
    await page.waitForSelector(block('Ahmed Siddiqui'));
    await r.hold(2.6);
    const a = await center(page, slot(3, 14, 1));
    const b = await center(page, slot(3, 15.5, 1));
    await r.moveTo(a.x, a.b.y + 9, 1.4); await r.hold(0.5);
    await r.down();
    await r.moveTo(a.x, b.b.y + b.b.height - 7, 2.6);
    await r.hold(0.7);
    await r.up();
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    await r.hold(1.2);
    const nm = await center(page, '#bookName');
    await r.moveTo(nm.x - 80, nm.y, 0.9); await r.click(); await r.hold(0.3);
    await r.type('Samira Haddad');
    await r.hold(0.8);
    const nt = await center(page, '#bookNotes');
    await r.moveTo(nt.x - 80, nt.y - 10, 0.9); await r.click(); await r.hold(0.3);
    await r.type('Bringing a laptop; needs an outlet', 0.06);
    await r.hold(1.2);
    const sv = await center(page, '#btnSaveBooking');
    await r.moveTo(sv.x, sv.y, 1.0); await r.hold(0.3); await r.click();
    r.mark('saved');
    await page.waitForSelector('#bookingModal', { state: 'hidden' });
    await r.moveTo(1180, 118, 1.2);
    await r.hold(6.0);
  });

  // 3b. A quick look: hover a booking for its popover, then click for the full details.
  mouse = await take(page, 'hover', mouse, async (r) => {
    await r.hold(1.0);
    const bk = await center(page, block('Samira Haddad'));
    await r.moveTo(bk.x + 20, bk.b.y + 26, 1.4);
    await r.hold(4.2);
    await r.click();
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    const nt = await center(page, '#bookNotes');
    await r.moveTo(nt.x + 120, nt.y + 40, 1.0);   // rest beside the note, not on it
    await r.hold(4.5);
    const cancel = await center(page, '#bookingModal .modal-content button:not([class])');
    await r.moveTo(cancel.x, cancel.y, 0.9); await r.hold(0.3); await r.click();
    await page.waitForSelector('#bookingModal', { state: 'hidden' });
    await r.moveTo(1180, 118, 1.2);
    await r.hold(2.5);
  });

  // 4. Plans change: drag the booking from Table 2 at 2pm to Table 3 at 3pm, confirm.
  mouse = await take(page, 'move', mouse, async (r) => {
    // Logged before the pointer arrives, so the compositor can rebuild the browser's
    // drag image from a clean frame (headless Chromium never paints that image).
    await r.rect('dragSource', page.locator(block('Samira Haddad')));
    await r.hold(1.5);
    const bk = await center(page, block('Samira Haddad'));
    const tgt = await center(page, slot(3, 15, 2));
    await r.moveTo(bk.x, bk.b.y + 22, 1.4); await r.hold(0.6);
    await r.down();
    await r.moveTo(tgt.x, tgt.b.y + 22, 2.4);
    await r.hold(0.8);
    await r.up();
    await page.waitForSelector('#moveModal', { state: 'visible' });
    await r.hold(3.2);
    const mv = await center(page, '#moveModal .btn-success');
    await r.moveTo(mv.x, mv.y, 1.0); await r.hold(0.3); await r.click();
    r.mark('saved');
    await page.waitForSelector('#moveModal', { state: 'hidden' });
    await r.moveTo(1180, 118, 1.2);
    await r.hold(4.0);
  });

  // 4b. More time: drag the bottom edge of Benjamin Adler's booking from 12:00 to 12:30.
  mouse = await take(page, 'resize', mouse, async (r) => {
    await r.hold(1.5);
    const h = await center(page, `${block('Benjamin Adler')} .resize-handle`);
    const nextSlot = await center(page, slot(3, 12, 2));
    await r.moveTo(h.x, h.y, 1.5); await r.hold(0.6);
    await r.down();
    await r.moveTo(h.x, h.y + nextSlot.b.height, 1.8);
    await r.hold(0.8);
    await r.up();
    await page.waitForSelector('#resizeModal', { state: 'visible' });
    await r.hold(3.0);
    const up = await center(page, '#resizeModal .btn-success');
    await r.moveTo(up.x, up.y, 1.0); await r.hold(0.3); await r.click();
    r.mark('saved');
    await page.waitForSelector('#resizeModal', { state: 'hidden' });
    await r.moveTo(1180, 118, 1.2);
    await r.hold(3.5);
  });

  // 5. Open a booking: "Move to another day…" for dates not on screen.
  mouse = await take(page, 'details', mouse, async (r) => {
    await r.hold(0.8);
    const bk = await center(page, block('Samira Haddad'));
    await r.moveTo(bk.x - 30, bk.b.y + 18, 1.3); await r.hold(0.4); await r.click();
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    await r.rect('moveDay', page.locator('#btnReschedule'));
    const mv = await center(page, '#btnReschedule');
    await r.moveTo(mv.x - 10, mv.y + 36, 1.4);    // rest near the button without pressing it
    await r.hold(6.0);
    const cancel = await center(page, '#bookingModal .modal-content button:not([class])');
    await r.moveTo(cancel.x, cancel.y, 0.9); await r.hold(0.3); await r.click();
    await page.waitForSelector('#bookingModal', { state: 'hidden' });
    await r.moveTo(1180, 118, 1.2);
    await r.hold(3.0);
  });

  // 6. A patron cancels: open their booking, Delete, confirm. The confirm is the
  // browser's own dialog, which is drawn outside the page and can't be filmed;
  // it is accepted after the pause a person would take to read it.
  mouse = await take(page, 'delete', mouse, async (r) => {
    await r.hold(1.0);
    const bk = await center(page, block('Carmen Ruiz'));
    await r.moveTo(bk.x - 30, bk.b.y + 18, 1.4); await r.hold(0.4); await r.click();
    await page.waitForSelector('#bookingModal', { state: 'visible' });
    await r.rect('delete', page.locator('#btnDeleteBooking'));
    await r.hold(2.4);
    const del = await center(page, '#btnDeleteBooking');
    await r.moveTo(del.x, del.y, 1.1); await r.hold(0.5);
    page.once('dialog', async (d) => {
      r.mark('dialog', { message: d.message() });
      await new Promise((res) => setTimeout(res, 1800));
      r.mark('dialogAccept');
      await d.accept();
    });
    await r.click();
    await page.waitForSelector('#bookingModal', { state: 'hidden' });
    await page.waitForSelector(block('Carmen Ruiz'), { state: 'detached' });
    r.mark('deleted');
    await r.moveTo(1180, 118, 1.4);
    await r.hold(5.0);
  });

  // 7. Tip: Alt+N jumps to now (back to today) and highlights the next hour.
  mouse = await take(page, 'altn', mouse, async (r) => {
    await r.hold(1.2);
    r.mark('key', { ch: 'Alt+N' });
    await page.keyboard.press('Alt+KeyN');
    await r.hold(7.0);
  });

  // 8. Tip: a week-view resource (switched off camera; the native menu can't be filmed).
  await page.selectOption('#resourceSelect', 'res-study');
  await page.waitForSelector(block('Amara Okafor'));
  await page.waitForTimeout(800);
  mouse = await take(page, 'week', mouse, async (r) => { await r.hold(10.0); });

  await browser.close();

  // Index for the stage (paths relative to compose/stage.html).
  const clips = {};
  for (const name of fs.readdirSync(OUT)) {
    const tl = path.join(OUT, name, 'timeline.json');
    if (!fs.existsSync(tl)) continue;
    clips[name] = { dir: `../out/clips/${name}/`, ...JSON.parse(fs.readFileSync(tl, 'utf8')) };
  }
  fs.writeFileSync(path.join(OUT, 'index.js'), 'const CLIPS = ' + JSON.stringify(clips) + ';\n');
  console.log('wrote', Object.keys(clips).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
