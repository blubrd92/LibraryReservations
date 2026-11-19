// Deterministic frame renderer. renderAt(t) draws the frame at time t (seconds)
// from SCRIPT (script.js) and the recorded clips (CLIPS, written by film/film.js).
// Nothing animates on its own: every opacity, position and zoom is a pure
// function of t, so render.js can step through frames at any speed.

const SRC_W = 1920, SRC_H = 1080;          // recorded frame size (1440x810 CSS px at 4/3)
const CSS_TO_SRC = 4 / 3;
const CARD = { x: 48, y: 48, w: 1536, h: 864 };
const FIT = CARD.w / SRC_W;                 // 0.8

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => 0.5 - Math.cos(Math.PI * clamp(k, 0, 1)) / 2;        // sine in-out
const smooth = (t, a, b) => ease((t - a) / (b - a));
const fadeWindow = (t, from, to, f = 0.45) => Math.min(smooth(t, from, from + f), 1 - smooth(t, to - f, to));

// ---- scene timeline ----
const SCENES = [];
(function layout() {
  let at = 0;
  for (const s of SCRIPT.scenes) { SCENES.push({ ...s, start: at }); at += s.dur; }
  SCRIPT.total = at;
})();

function sceneAt(t) {
  let i = SCENES.length - 1;
  while (i > 0 && SCENES[i].start > t) i--;
  return i;
}

// ---- clip helpers ----
function frameFor(clip, ct) {
  const fr = clip.frames;
  let lo = 0, hi = fr.length - 1;
  if (ct <= fr[0].t) return fr[0];
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fr[mid].t <= ct) lo = mid; else hi = mid - 1; }
  return fr[lo];
}

function mouseAt(clip, ct) {
  let last = null;
  for (const e of clip.events) {
    if (e.t > ct) break;
    if (e.x !== undefined) last = e;
  }
  return last;
}

function clicksNear(clip, ct, span = 0.6) {
  return clip.events.filter((e) => e.type === 'down' && e.t <= ct && ct - e.t < span);
}

// Camera keyframes: { t, z, cx, cy } in scene time; cx/cy are focus points in
// recorded-frame pixels. Holds before the first and after the last key.
function cameraAt(keys, st) {
  if (!keys || !keys.length) return { z: 1, cx: SRC_W / 2, cy: SRC_H / 2 };
  if (st <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (st <= b.t) {
      const k = ease((st - a.t) / (b.t - a.t));
      return { z: a.z + (b.z - a.z) * k, cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k };
    }
  }
  return keys[keys.length - 1];
}

function camTransform(cam) {
  const s = FIT * cam.z;
  const tx = clamp(CARD.w / 2 - cam.cx * s, CARD.w - SRC_W * s, 0);
  const ty = clamp(CARD.h / 2 - cam.cy * s, CARD.h - SRC_H * s, 0);
  return { s, tx, ty };
}

// ---- drawing ----
const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="32" height="32"><path d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L17.8 14.2 Z" fill="#fff" stroke="#1d252e" stroke-width="1.4" stroke-linejoin="round"/></svg>';

function stepsHTML(active) {
  if (!active) return '';
  const items = SCRIPT.steps.map((label, i) => {
    const n = i + 1, cls = n === active ? 'on' : n < active ? 'done' : '';
    return `<div class="step ${cls}"><div class="dot">${n < active ? '✓' : n}</div><div class="lbl">${label}</div></div>`;
  }).join('');
  return `<div class="steps"><h3>${SCRIPT.stepsTitle}</h3><div class="rail"></div>${items}</div>`;
}

function captionsHTML(list, st) {
  return (list || []).map((c) => {
    const o = fadeWindow(st, c.from, c.to);
    if (o <= 0) return '';
    const dy = (1 - o) * 10;
    return `<div class="line" style="opacity:${o.toFixed(3)};transform:translateY(${dy.toFixed(2)}px)">${c.text}</div>`;
  }).join('');
}

function tipsHTML(list, st) {
  return (list || []).map((c) => {
    const o = fadeWindow(st, c.from, c.to, 0.5);
    if (o <= 0) return '';
    const p = c.pos || { right: 364, bottom: 196 };   // inside the footage card's lower right
    const dy = (1 - o) * 14;
    return `<div class="tip" style="right:${p.right}px;bottom:${p.bottom}px;opacity:${o.toFixed(3)};transform:translateY(${dy.toFixed(2)}px)"><div class="k">Tip</div><div class="t">${c.text}</div></div>`;
  }).join('');
}

function ringsHTML(list, st, clip) {
  // Rings come from element boxes the recorder logged (CSS px), converted to
  // recorded-frame pixels and drawn inside the camera so they track the zoom.
  return (list || []).map((r) => {
    const o = fadeWindow(st, r.from, r.to, 0.4);
    if (o <= 0) return '';
    const ev = clip.events.find((e) => e.type === 'rect' && e.name === r.src);
    if (!ev) throw new Error('no logged box for ring ' + r.src);
    const [x, y, w, h] = ev.box.map((v) => v * CSS_TO_SRC);
    return `<div class="ring" style="left:${x - 8}px;top:${y - 8}px;width:${w + 16}px;height:${h + 16}px;opacity:${o.toFixed(3)}"></div>`;
  }).join('');
}

// The browser's drag image. Headless Chromium never paints it (it is drawn outside
// the page), so it is rebuilt here from real pixels: the dragged booking cut from a
// frame taken before the drag (scene.ghost names the box the recorder logged),
// semi-transparent, held at the exact point the pointer grabbed it, following the
// logged pointer from the moment the drag moves until the drop.
function ghostHTML(scene, clip, ct) {
  if (!scene.ghost) return { html: '', images: [] };
  const box = clip.events.find((e) => e.type === 'rect' && e.name === scene.ghost);
  if (!box) throw new Error('no logged box for drag image ' + scene.ghost);
  const down = clip.events.find((e) => e.type === 'down' && e.t > box.t);
  const up = clip.events.find((e) => e.type === 'up' && e.t > down.t);
  const m = mouseAt(clip, ct);
  if (!m || ct <= down.t || ct >= up.t) return { html: '', images: [] };
  // Chrome starts a drag only once the pointer has moved a few pixels.
  if (Math.hypot(m.x - down.x, m.y - down.y) < 4) return { html: '', images: [] };
  const [bx, by, bw, bh] = box.box.map((v) => v * CSS_TO_SRC);
  const gx = (m.x - down.x) * CSS_TO_SRC + bx, gy = (m.y - down.y) * CSS_TO_SRC + by;
  const src = clip.dir + frameFor(clip, box.t).name;
  return {
    html: `<div style="position:absolute;left:${gx.toFixed(2)}px;top:${gy.toFixed(2)}px;width:${bw}px;height:${bh}px;overflow:hidden;opacity:.6">
      <img src="${src}" style="position:absolute;left:${-bx}px;top:${-by}px;width:${SRC_W}px;height:${SRC_H}px"></div>`,
    images: [src],
  };
}

async function footageLayer(scene, st) {
  const clip = CLIPS[scene.clip];
  const ct = (scene.clipFrom || 0) + st;
  const fr = frameFor(clip, ct);
  const cam = camTransform(cameraAt(scene.camera, st));
  let cursor = '';
  const m = scene.cursor === false ? null : mouseAt(clip, ct);
  if (m) {
    const x = m.x * CSS_TO_SRC, y = m.y * CSS_TO_SRC;
    const ripples = clicksNear(clip, ct).map((e) => {
      const k = (ct - e.t) / 0.6, r = 10 + 34 * ease(k);
      return `<div class="ripple" style="left:${e.x * CSS_TO_SRC - r}px;top:${e.y * CSS_TO_SRC - r}px;width:${2 * r}px;height:${2 * r}px;opacity:${(1 - k).toFixed(3)}"></div>`;
    }).join('');
    cursor = ripples + `<div class="cursor" style="transform:translate(${(x - 5).toFixed(2)}px,${(y - 3).toFixed(2)}px)">${CURSOR_SVG}</div>`;
  }
  const src = clip.dir + fr.name;
  const ghost = ghostHTML(scene, clip, ct);
  return {
    html: `<div class="paper"></div>
      <div class="card"><div class="cam" style="transform:translate(${cam.tx.toFixed(2)}px,${cam.ty.toFixed(2)}px) scale(${cam.s.toFixed(5)})">
        <img class="frame" src="${src}">${ringsHTML(scene.rings, st, clip)}${ghost.html}${cursor}</div></div>
      ${stepsHTML(scene.step)}
      <div class="caption">${captionsHTML(scene.captions, st)}</div>
      ${tipsHTML(scene.tips, st)}`,
    images: [src, ...ghost.images],
  };
}

function titleLayer(scene, st) {
  const a = smooth(st, 0.3, 1.5), b = smooth(st, 1.0, 2.4), c = smooth(st, 1.6, 3.0);
  const blocks = SCRIPT.titleBlocks.map((bk, i) => {
    const o = smooth(st, 0.6 + i * 0.22, 1.6 + i * 0.22);
    return `<div style="left:${bk[0]}px;top:${bk[1] + (1 - o) * 16}px;width:${bk[2]}px;height:${bk[3]}px;background:${bk[4]};opacity:${o.toFixed(3)}"></div>`;
  }).join('');
  return {
    html: `<div class="paper"></div>
      <div class="title-wrap">
        <div class="eyebrow" style="opacity:${a}">${scene.eyebrow}</div>
        <h1 class="title" style="opacity:${b};transform:translateY(${(1 - b) * 14}px)">${scene.title}</h1>
        <div class="sub" style="opacity:${c};transform:translateY(${(1 - c) * 12}px)">${scene.sub}</div>
      </div>
      <div class="blocks">${blocks}</div>`,
    images: [],
  };
}

function deskLayer(scene, st) {
  const clip = CLIPS[scene.clip];
  const fr = frameFor(clip, scene.clipAt);
  const src = clip.dir + fr.name;
  const z = 1 + 0.045 * ease(st / scene.dur);            // slow push-in, ~4.5% over the scene
  const o1 = fadeWindow(st, scene.cardFrom, scene.dur + 5, 0.8);
  return {
    html: `<div class="desk-scene"><div style="position:absolute;inset:0;transform-origin:1240px 560px;transform:scale(${z.toFixed(5)})">${deskHTML(src)}</div></div>
      <div class="end-card" style="opacity:${o1.toFixed(3)};transform:translateY(${((1 - o1) * 12).toFixed(2)}px)">${scene.card}</div>`,
    images: [src],
  };
}

async function layerFor(scene, st) {
  if (scene.type === 'footage') return footageLayer(scene, st);
  if (scene.type === 'title') return titleLayer(scene, st);
  if (scene.type === 'desk') return deskLayer(scene, st);
  if (scene.type === 'blank') return { html: '<div class="paper"></div>', images: [] };
  throw new Error('unknown scene ' + scene.type);
}

const root = document.getElementById('root');
const decoded = new Map();
async function ensureImages(srcs) {
  await Promise.all(srcs.map((s) => {
    if (decoded.has(s)) return decoded.get(s);
    const img = new Image(); img.src = s;
    const p = img.decode().then(() => img);
    decoded.set(s, p);
    if (decoded.size > 400) decoded.delete(decoded.keys().next().value);
    return p;
  }));
}

// Final fade to paper over the last `outro` seconds, and up from paper at the top.
async function renderAt(t) {
  const i = sceneAt(t), s = SCENES[i];
  const st = t - s.start;
  const cur = await layerFor(s, st);
  let html = '';
  const xf = s.xfade || 0;
  if (i > 0 && xf > 0 && st < xf) {
    const p = SCENES[i - 1];
    const prev = await layerFor(p, t - p.start);
    await ensureImages(prev.images);
    html += `<div class="layer">${prev.html}</div>`;
    html += `<div class="layer" style="opacity:${ease(st / xf).toFixed(4)}">${cur.html}</div>`;
  } else {
    html += `<div class="layer">${cur.html}</div>`;
  }
  const fin = SCRIPT.fadeOut || 0;
  const endO = t > SCRIPT.total - fin ? ease((t - (SCRIPT.total - fin)) / fin) : 0;
  const startO = SCRIPT.fadeIn ? 1 - ease(t / SCRIPT.fadeIn) : 0;
  const veil = Math.max(endO, startO);
  if (veil > 0) html += `<div class="layer" style="background:var(--paper);opacity:${veil.toFixed(4)}"></div>`;
  await ensureImages(cur.images);
  root.innerHTML = html;
  await Promise.all([...root.querySelectorAll('img')].map((im) => im.decode().catch(() => {})));
  return true;
}

window.renderAt = renderAt;
// Force-load both caption faces, then report each FontFace's real status, so
// render.js can refuse to render with a fallback font.
window.STAGE_READY = Promise.all([
  document.fonts.load('400 40px Literata'), document.fonts.load('600 40px Literata'),
  document.fonts.load('400 16px "Inter Caption"'), document.fonts.load('600 16px "Inter Caption"'),
]).then(() => ({
  fonts: [...document.fonts].map((f) => `${f.family} ${f.weight}: ${f.status}`),
  allLoaded: [...document.fonts].every((f) => f.status === 'loaded'),
  total: SCRIPT.total,
}));
