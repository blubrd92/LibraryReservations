# Staff explainer video (source)

Everything needed to re-render the staff explainer for Library Reservations. Rendered
files go to `video/out/`, which is git-ignored; only the source lives in the repo.

## How it is made

1. **Film** (`film/`). `film.js` opens the real app (the repo's own `index.html`, `app.js`,
   `utils.js`, `styles.css`) in headless Chromium and drives it with real mouse and keyboard
   input, recording each take with the DevTools screencast. It runs against **local Firebase
   emulators** seeded with invented sample data (`seed.js`), never the production project:
   `harness.js` rewrites the project id to an offline `demo-` id and points the SDK at the
   emulators in memory, and the emulators enforce the repo's real `firestore.rules`.
   The Firebase SDK (8.10.1, the version the app pins) and `marked` are served from npm copies
   because the filming machine can't reach the CDNs. The browser clock is fixed to
   Tue Dec 1, 2026, 10:40am Pacific so "today" and "now" are stable.
2. **Compose** (`compose/`). `stage.html` + `stage.js` draw any frame as a pure function of time
   from `script.js` (scenes, on-screen lines, camera, tips) and the recorded takes. `render.js`
   steps through every frame at exactly 30 fps and encodes the silent picture.
3. **Score** (`audio/`). Music and action sounds are synthesized, with sounds placed on the
   logged clicks and keystrokes of each take.

## Fonts

- The app asks for Segoe UI, which Linux lacks. `fonts/` holds **Selawik** (SIL OFL), Microsoft's
  open-source, metric-compatible stand-in; `fonts/fonts.conf` renames it to "Segoe UI" for the
  filming browser so text wraps as it does on Windows.
- Captions use **Literata** and **Inter** (SIL OFL) as local web fonts in `fonts/web/`. The
  renderer refuses to run unless both report `loaded`.

## Re-render

```bash
cd video
npm install
npm run film                          # fresh emulators, seed, film every take
node compose/render.js --stills 9,52,117   # optional spot-check frames
node compose/render.js                # out/picture.mp4, exactly 120 s at 30 fps
node compose/export_timeline.js       # out/timeline.json: actions on the final timeline
python3 audio/score.py                # out/mix.wav, sounds placed on those actions
./master.sh                           # out/library-reservations-explainer.mp4 (< 30 MB)
python3 check_transitions.py          # every-frame check of the encoded file
```

Requires Java (for the Firestore emulator), ffmpeg, Python 3 with numpy and Pillow, and
Playwright's Chromium. `npm run film` must start fresh emulators: the emulator's clear-data
endpoint leaves stale document versions that make the app's create-only booking save fail.

## What is real and what is drawn

Every screen of the app is real footage of real clicks. Drawn: the title card's blocks,
the step tracker, captions, tip cards, the cursor (headless Chromium has no visible pointer,
so it is drawn from the logged mouse path) and the closing service-desk illustration, whose
monitor shows the last real frame. The browser's own "Delete booking?" confirm is drawn
outside the page and cannot be filmed; the footage holds while it is open and a caption says so.
