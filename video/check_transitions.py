"""Frame-by-frame check of the ENCODED file, with extra scrutiny at scene changes.

Decodes every frame of out/library-reservations-explainer.mp4 at full rate and:
  1. measures each frame's change from the previous one (mean absolute difference)
     and flags spikes: a jump much larger than the frames around it;
  2. flags near-blank frames outside the intended fade-in and fade-out;
  3. for each scene boundary, writes a filmstrip of EVERY frame from 0.5s before to
     1.2s after the cut (out/transitions/<boundary>.png) and prints the diff curve.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / "out"
VIDEO = OUT / "library-reservations-explainer.mp4"
TL = json.loads((OUT / "timeline.json").read_text())
FPS = TL["fps"]
W, H = 384, 216

boundaries = [s["start"] for s in TL["scenes"][1:]]
keep = set()
for b in boundaries:
    keep.update(range(int(round((b - 0.5) * FPS)), int(round((b + 1.2) * FPS))))

# Stream frames one at a time so memory stays flat however long the video is.
proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(VIDEO), "-vf", f"scale={W}:{H}", "-f", "rawvideo",
                         "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
size = W * H * 3
diffs, stds, kept = [], [], {}
prev = None
while True:
    buf = proc.stdout.read(size)
    if len(buf) < size:
        break
    cur = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    f = cur.astype(np.float32)
    diffs.append(0.0 if prev is None else float(np.abs(f - prev).mean()))
    stds.append(float(f.std()))
    if len(diffs) - 1 in keep:
        kept[len(diffs) - 1] = cur.copy()
    prev = f
proc.wait()
diff, std = np.array(diffs), np.array(stds)
n = len(diff)
print(f"decoded {n} frames ({n / FPS:.3f}s)")

# 1. spikes: a frame-to-frame change well above its local neighborhood
problems = []
for i in range(2, n - 2):
    local = np.median(np.r_[diff[max(1, i - 8):i - 1], diff[i + 2:i + 9]])
    if diff[i] > 6 and diff[i] > 4 * max(local, 0.5):
        problems.append((i, f"spike {diff[i]:.1f} vs local {local:.1f}"))

# 2. near-blank frames outside the first 0.8s fade-in and the last 1.6s fade-out
for i in range(n):
    t = i / FPS
    if 0.8 < t < TL["total"] - 1.6 and std[i] < 4:
        problems.append((i, f"near-blank (std {std[i]:.1f})"))

names = [f'{a["id"]}->{b["id"]}' for a, b in zip(TL["scenes"], TL["scenes"][1:])]

(OUT / "transitions").mkdir(exist_ok=True)
for b, name in zip(boundaries, names):
    i0, i1 = int(round((b - 0.5) * FPS)), min(n, int(round((b + 1.2) * FPS)))
    idx = list(range(i0, i1))
    cols = 10
    rows = (len(idx) + cols - 1) // cols
    tw, th = 192, 108
    strip = Image.new("RGB", (cols * tw, rows * (th + 14)), "white")
    d = ImageDraw.Draw(strip)
    for k, i in enumerate(idx):
        x, y = (k % cols) * tw, (k // cols) * (th + 14)
        strip.paste(Image.fromarray(kept[i]).resize((tw, th)), (x, y + 14))
        d.text((x + 2, y), f"{i} {i / FPS:.2f}s d={diff[i]:.1f}", fill="black")
    strip.save(OUT / "transitions" / f"{name}.png")
    curve = " ".join(f"{diff[i]:.1f}" for i in idx)
    print(f"{name} @ {b:.1f}s  max diff {diff[i0:i1].max():.1f}  curve: {curve}")

print("problems:" if problems else "no spikes or blank frames found")
for i, msg in problems:
    print(f"  frame {i} ({i / FPS:.2f}s): {msg}")
