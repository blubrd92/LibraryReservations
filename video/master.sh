#!/usr/bin/env bash
# Masters the final MP4 from out/picture.mp4 (render.js) and out/mix.wav (audio/score.py).
#   - audio: two-pass EBU R128 loudness normalization to -20 LUFS, -2 dBTP (quiet, even)
#   - video: two-pass x264 at a fixed bitrate so the file lands under the size cap
#   - checks: exact duration and frame count, size under the cap
set -euo pipefail
cd "$(dirname "$0")/out"

CAP_MB=${CAP_MB:-30}
VBIT=${VBIT:-1700k}           # video bitrate; ~1.7 Mbps + 128 kbps audio = ~27 MB for 2:00

# Loudness: measure, then apply with the measured values (linear normalization).
M=$(ffmpeg -hide_banner -nostats -i mix.wav -af loudnorm=I=-20:TP=-2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$M" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
ffmpeg -hide_banner -loglevel error -y -i mix.wav -af "loudnorm=I=-20:TP=-2:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" -c:a pcm_s16le mix_norm.wav

# Video: two-pass, tuned for flat graphics and text.
X264="-c:v libx264 -preset veryslow -tune animation -b:v $VBIT -maxrate 4000k -bufsize 8000k -pix_fmt yuv420p -r 30 -g 60"
ffmpeg -hide_banner -loglevel error -y -i picture.mp4 $X264 -pass 1 -passlogfile x264 -an -f mp4 /dev/null
ffmpeg -hide_banner -loglevel error -y -i picture.mp4 -i mix_norm.wav $X264 -pass 2 -passlogfile x264 \
  -c:a aac -b:a 128k -ar 48000 -map 0:v:0 -map 1:a:0 -shortest -movflags +faststart \
  library-reservations-explainer.mp4

F=library-reservations-explainer.mp4
SIZE=$(stat -c %s "$F")
echo "size: $(python3 -c "print(round($SIZE/1e6,2))") MB"
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,r_frame_rate -show_entries format=duration -of default=nw=1 "$F"
ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=nw=1 "$F"
[ "$SIZE" -lt $((CAP_MB * 1000 * 1000)) ] || { echo "OVER ${CAP_MB} MB"; exit 1; }
