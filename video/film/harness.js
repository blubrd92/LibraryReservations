// Opens the REAL app (the repo's index.html, app.js, utils.js, styles.css, unmodified
// on disk) in headless Chromium, wired to the local Firebase emulators.
//
// Three things differ from production, all at the network layer, none in the UI:
//  1. The Firebase SDK and marked are served from npm copies of the same packages,
//     because this filming machine can't reach the gstatic/jsdelivr CDNs.
//     Firebase is the exact version the app pins (8.10.1).
//  2. app.js is shimmed in memory: the project id becomes an offline "demo-" id and
//     the SDK is pointed at the emulators, so filming can never touch real data.
//  3. The browser's clock starts at a fixed moment, so "today" is always the same.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const NM = path.resolve(__dirname, '..', 'node_modules');
const FONTS = path.resolve(__dirname, '..', 'fonts');
const CACHE = path.resolve(__dirname, '..', '.cache');
const ORIGIN = 'http://127.0.0.1:4711'; // routed in-process; nothing listens here

// Tuesday Dec 1, 2026, 10:40am Pacific.
const FILM_NOW = '2026-12-01T10:40:00-08:00';

const CDN = {
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js': 'firebase/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js': 'firebase/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js': 'firebase/firebase-firestore.js',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js': 'marked/lib/marked.umd.js',
};

function fontEnv() {
  fs.mkdirSync(CACHE, { recursive: true });
  const conf = fs.readFileSync(path.join(FONTS, 'fonts.conf'), 'utf8')
    .replace('FONTDIR', FONTS).replace('CACHEDIR', path.join(CACHE, 'fontconfig'));
  const out = path.join(CACHE, 'fonts.conf');
  fs.writeFileSync(out, conf);
  return { ...process.env, FONTCONFIG_FILE: out };
}

function shimAppJs(src) {
  const anchor = 'const auth = firebase.auth();';
  if (!src.includes(anchor) || !src.includes('projectId: "libraryscheduler-faf2f"')) {
    throw new Error('app.js shim anchors not found; update harness.js');
  }
  return src
    .replace('projectId: "libraryscheduler-faf2f"', 'projectId: "demo-library-reservations"')
    .replace(anchor, anchor +
      ' db.useEmulator("127.0.0.1", 8080);' +
      ' auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });');
}

async function launch({ width = 1440, height = 810, scale = 4 / 3, now = FILM_NOW } = {}) {
  // The page is fulfilled in-process, so Chromium treats it as public and would
  // block its calls to the loopback emulators. That check is irrelevant here.
  const browser = await chromium.launch({ env: fontEnv(), args: [
    '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests',
    // The DevTools screencast ignores a context deviceScaleFactor and sends CSS-pixel
    // frames; forcing the scale at launch gets true 1920x1080 frames of a 1440x810 page.
    `--force-device-scale-factor=${scale}`,
  ] });
  const context = await browser.newContext({
    viewport: { width, height },
    timezoneId: 'America/Los_Angeles', locale: 'en-US',
  });
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (CDN[url]) {
      return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(NM, CDN[url])) });
    }
    if (url.startsWith(ORIGIN)) {
      let p = new URL(url).pathname;
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      let body = fs.readFileSync(file);
      const type = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
      if (p === '/app.js') body = shimAppJs(body.toString('utf8'));
      return route.fulfill({ contentType: type, body });
    }
    if (url.startsWith('http://127.0.0.1:8080') || url.startsWith('http://127.0.0.1:9099')) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date(now) });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  return { browser, context, page };
}

async function login(page, password) {
  await page.goto(ORIGIN + '/');
  await page.fill('#loginPass', password);
  await page.click('.login-box button');
  await page.waitForSelector('.booking-float');
}

module.exports = { launch, login, ORIGIN, FILM_NOW };
