"""Synthesizes the explainer's soundtrack: quiet original music plus small action sounds.

Reads out/timeline.json (written by compose/export_timeline.js) so every click,
keystroke, save and delete sound lands on the frame where the filmed action happens.
Writes out/music.wav, out/sfx.wav and out/mix.wav (48 kHz stereo).
Nothing here imitates speech: tones are piano-like plucks, soft pads, bells and ticks.
Deterministic: fixed random seeds, so re-renders are identical.
"""
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "out"
TL = json.loads((OUT / "timeline.json").read_text())
TOTAL = TL["total"]
N = int(round(TOTAL * SR))
t_all = np.arange(N) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_adsr(n, a, r, sustain_len=None):
    """Linear-in-dB-ish attack/release envelope of n samples."""
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nr:
        e[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return e


def place(buf, sig, t, gain=1.0, pan=0.0):
    """Add a mono signal into a stereo buffer at time t (s) with constant-power pan."""
    i = int(round(t * SR))
    if i >= buf.shape[0]:
        return
    sig = sig[: buf.shape[0] - i]
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(sig), 0] += sig * gain * lg
    buf[i:i + len(sig), 1] += sig * gain * rg


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # short signals only
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


# ---------------------------------------------------------------- music
rng = np.random.default_rng(11)
BPM = 70
BEAT = 60 / BPM
BAR = 4 * BEAT

# F major: Fmaj7 | Dm7 | Bbmaj7 | Csus4 -> C, two bars each.
CHORDS = [
    {"root": 41, "tones": [53, 57, 60, 64]},   # F  A  C  E
    {"root": 38, "tones": [50, 53, 57, 60]},   # D  F  A  C
    {"root": 46, "tones": [50, 53, 57, 58]},   # Bb: D F A Bb
    {"root": 48, "tones": [52, 55, 60, 65]},   # C: E G C F(sus)
]
FINAL = {"root": 41, "tones": [53, 57, 60, 65]}


def chord_at_bar(b):
    return CHORDS[(b // 2) % len(CHORDS)]


def pad_voice(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for cents in (-4, 4):
        ff = f * 2 ** (cents / 1200)
        s += np.sin(2 * np.pi * ff * t) + 0.18 * np.sin(2 * np.pi * 2 * ff * t + 0.3) + 0.05 * np.sin(2 * np.pi * 3 * ff * t)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.21 * t + rng.uniform(0, 6))
    return s * trem * env_adsr(n, min(1.8, dur / 2.5), min(1.8, dur / 2.5)) / 2


def felt_piano(f, dur=3.2, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for k in range(1, 7):
        fk = f * k * (1 + 0.0004 * k * k)          # slight string stretch
        if fk > 9000:
            break
        amp = vel / k ** 1.5
        decay = 1.0 + 0.6 * k                      # higher partials die faster (felt)
        s += amp * np.sin(2 * np.pi * fk * t) * np.exp(-decay * t)
    att = np.minimum(1, t / 0.006)
    thump = 0.02 * vel * np.exp(-t / 0.01) * rng.standard_normal(n)
    return (s + thump) * att * env_adsr(n, 0, 0.25)


music = np.zeros((N, 2))
bars = int(np.ceil(TOTAL / BAR))
FINAL_BAR = int((TOTAL - 7.5) // BAR)             # the last chord rings out under the ending

for b in range(bars):
    t0 = b * BAR
    if t0 >= TOTAL:
        break
    ch = FINAL if b >= FINAL_BAR else chord_at_bar(b)
    final = b >= FINAL_BAR
    if b % 2 == 0 or final and b == FINAL_BAR:
        dur = (TOTAL - t0 + 1) if final else 2 * BAR + 1.6
        for i, m in enumerate(ch["tones"]):
            mm = m + 12 if i >= 2 else m            # open voicing: upper two voices an octave up
            place(music, pad_voice(midi(mm), dur), t0, gain=0.04, pan=(-0.5, -0.15, 0.15, 0.5)[i])
        bass = pad_voice(midi(ch["root"]), dur)
        place(music, bass, t0, gain=0.03)
    if final and b > FINAL_BAR:
        continue
    # Sparse felt-piano arpeggio; the title bars and the closing bar stay thinner.
    density = 0.45 if t0 < 4 else 0.8
    pattern = [0, 1.5, 2, 3] if b % 2 == 0 else [0, 1, 2.5, 3.5]
    pool = sorted(set([m + 12 for m in ch["tones"]] + [m + 24 for m in ch["tones"][:2]]))
    for j, beat in enumerate(pattern):
        if j and rng.random() > density:
            continue
        m = pool[(j * 2 + b) % len(pool)] if j else pool[-1] if b % 4 == 3 else pool[2]
        vel = 0.9 if j == 0 else 0.6 + 0.2 * rng.random()
        place(music, felt_piano(midi(m), vel=vel), t0 + beat * BEAT + rng.uniform(-0.01, 0.01),
              gain=0.15, pan=float(np.clip((m - 76) / 20, -0.6, 0.6)))
    if final:
        for k, m in enumerate([77, 81, 84, 89]):     # a gentle rolled F to close
            place(music, felt_piano(midi(m), dur=5, vel=0.7), t0 + 0.12 * k, gain=0.1, pan=-0.3 + 0.2 * k)

# Reverb: FFT convolution with a decaying, darkened stereo noise tail.
ir_len = int(2.6 * SR)
tt = np.arange(ir_len) / SR
ir = np.zeros((ir_len, 2))
for c in range(2):
    noise = np.random.default_rng(100 + c).standard_normal(ir_len) * np.exp(-tt / 0.55)
    kernel = np.ones(24) / 24
    ir[:, c] = np.convolve(noise, kernel, mode="same")
ir[: int(0.02 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
L = 1 << int(np.ceil(np.log2(N + ir_len)))
wet = np.stack([np.fft.irfft(np.fft.rfft(music[:, c], L) * np.fft.rfft(ir[:, c], L), L)[:N] for c in range(2)], axis=1)
music = 0.78 * music + 0.42 * wet

fade_in = np.minimum(1, t_all / 2.0)
fade_out = np.clip((TOTAL - t_all) / 3.0, 0, 1) ** 1.5
music *= (fade_in * fade_out)[:, None]

# ---------------------------------------------------------------- action sounds
srng = np.random.default_rng(5)


def click_sound():
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.012)
    tick = np.sin(2 * np.pi * 2100 * t) * np.exp(-t / 0.0035)
    noise = onepole_lp(srng.standard_normal(n), 3500) * np.exp(-t / 0.004)
    return 0.55 * body + 0.35 * tick + 0.25 * noise


def key_sound():
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    f = srng.uniform(2600, 3600)
    return (0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0022)
            + 0.3 * onepole_lp(srng.standard_normal(n), 4500) * np.exp(-t / 0.003))


def bell(f, dur=1.6, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
         + 0.35 * bright * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.22)
         + 0.12 * bright * np.sin(2 * np.pi * 5.40 * f * t) * np.exp(-t / 0.09))
    return s * np.minimum(1, t / 0.004)


sfx = np.zeros((N, 2))
for a in TL["actions"]:
    t, kind = a["t"], a["type"]
    if kind == "down":
        place(sfx, click_sound(), t, gain=0.36)
    elif kind == "key":
        if a["scene"] == "altn":
            place(sfx, key_sound(), t, gain=0.14)
            place(sfx, bell(midi(84), 1.4, 0.6), t + 0.12, gain=0.06, pan=0.2)   # the highlight appears
        else:
            place(sfx, key_sound(), t, gain=0.11 * srng.uniform(0.7, 1.0), pan=srng.uniform(-0.1, 0.1))
    elif kind == "saved":
        place(sfx, bell(midi(77)), t + 0.18, gain=0.09, pan=-0.1)    # F5
        place(sfx, bell(midi(84)), t + 0.34, gain=0.08, pan=0.1)    # C6
    elif kind == "deleted":
        place(sfx, bell(midi(81), 1.3, 0.4), t + 0.05, gain=0.08, pan=0.1)   # A5
        place(sfx, bell(midi(77), 1.5, 0.4), t + 0.22, gain=0.08, pan=-0.1)  # F5

# Light reverb on the action sounds so they sit in the same room as the music.
wet = np.stack([np.fft.irfft(np.fft.rfft(sfx[:, c], L) * np.fft.rfft(ir[:, c], L), L)[:N] for c in range(2)], axis=1)
sfx = sfx + 0.18 * wet


def write(name, x):
    peak = np.max(np.abs(x))
    y = np.int16(np.clip(x / max(peak, 1e-9) * 0.89, -1, 1) * 32767) if name == "mix.wav" else np.int16(np.clip(x, -1, 1) * 32767)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(y.tobytes())


mix = music + sfx
write("music.wav", music)
write("sfx.wav", sfx)
write("mix.wav", mix)
print(f"{TOTAL}s, music peak {np.max(np.abs(music)):.3f}, sfx peak {np.max(np.abs(sfx)):.3f}, mix peak {np.max(np.abs(mix)):.3f}")
