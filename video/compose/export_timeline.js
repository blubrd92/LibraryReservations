// Writes out/timeline.json: each scene's global start/duration and every logged
// action (clicks, keys, saves, deletes) mapped onto the final video's timeline.
// audio/score.py reads it to place sounds exactly on the filmed actions.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUT = path.resolve(__dirname, '..', 'out');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(OUT, 'clips', 'index.js'), 'utf8') + ';this.CLIPS=CLIPS;', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8') + ';this.SCRIPT=SCRIPT;', ctx);

let at = 0;
const scenes = [], actions = [];
for (const s of ctx.SCRIPT.scenes) {
  scenes.push({ id: s.id, type: s.type, start: at, dur: s.dur });
  if (s.type === 'footage') {
    const from = s.clipFrom || 0;
    for (const e of ctx.CLIPS[s.clip].events) {
      if (e.type === 'mouse' || e.type === 'up' || e.type === 'rect') continue;
      const st = e.t - from;
      if (st < 0 || st >= s.dur) continue;
      actions.push({ t: +(at + st).toFixed(3), type: e.type, scene: s.id });
    }
  }
  at += s.dur;
}
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ total: at, fps: ctx.SCRIPT.fps, scenes, actions }, null, 1));
console.log(`total ${at}s, ${actions.length} actions:`, [...new Set(actions.map((a) => a.type))].join(', '));
