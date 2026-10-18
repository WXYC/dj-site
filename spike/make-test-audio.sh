#!/usr/bin/env bash
#
# Makes the test tracks for the service-worker spike: ten minutes each of
# generated audio in MP3 (320 kbps CBR), M4A/AAC (256 kbps), FLAC and WAV,
# and one thirty-minute WAV for the lock test.
# Never commit the output; spike/.gitignore ignores the default directory.
#
# The audio says where the playhead is:
#   - a steady tone whose pitch rises a whole tone each minute
#     (minute 0 is 220 Hz, minute 9 is about 622 Hz);
#   - every 10 seconds a burst of short high pips (1760 Hz), one pip at m:00,
#     two at m:10, and so on up to six at m:50;
#   - quiet pink noise underneath, so FLAC compresses like music rather than
#     like a pure tone.
# So a seek to 10% (1:00) lands on the second pitch with one pip, 50% (5:00)
# on the sixth pitch with one pip, and 90% (9:00) on the tenth.
#
# The lock track (spike-marker-30min.wav) is the same sound for thirty
# minutes, except that its tone rises a semitone each minute (minute 0 is
# 220 Hz, minute 29 about 1175 Hz), so it stays below the pips; whole tones
# would reach the pips' pitch at minute 18. It is a WAV on purpose: on iOS,
# Safari loads a WAV a piece at a time as it plays, so the worker has to keep
# answering while the phone is locked. A compressed track would be loaded in
# full before the lock and prove nothing.
#
# Usage: spike/make-test-audio.sh [output-dir]
#   output-dir defaults to spike/test-audio/
#   ONLY=lock    spike/make-test-audio.sh   makes only the lock track
#   ONLY=formats spike/make-test-audio.sh   makes only the four ten-minute tracks
#   DURATION_S=120 LOCK_DURATION_S=180 spike/make-test-audio.sh
#                                           makes shorter tracks for a quick try
#                                           (the file names stay the same)
#
# Needs ffmpeg 4.4 or newer (for amix normalize=0) and ffprobe. The lock
# track is about 318 MB; all five are about 500 MB.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="${1:-$SCRIPT_DIR/test-audio}"
DURATION_S="${DURATION_S:-600}"
LOCK_DURATION_S="${LOCK_DURATION_S:-1800}"
ONLY="${ONLY:-all}"
RATE=44100
BASE="spike-marker-10min"
LOCK_BASE="spike-marker-30min"

log() {
  printf '%s make-test-audio: %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

trap 'log "failed at line $LINENO"; exit 1' ERR

case "$ONLY" in
  all | formats | lock) ;;
  *)
    log "ONLY must be all, formats or lock, not $ONLY"
    exit 2
    ;;
esac

for tool in ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    log "$tool not found; install ffmpeg (for example: brew install ffmpeg)"
    exit 1
  fi
done

mkdir -p "$OUT_DIR"

# t is seconds. Minute m = floor(t/60); pitch 220 * 2^(m/steps), where steps
# is 6 for whole tones and 12 for semitones. The pips: in each 10 s slot,
# n = 1 + floor(mod(t,60)/10) pips of 40 ms, one every 120 ms.
tone() {
  printf '0.2*sin(2*PI*220*pow(2,floor(t/60)/%s)*mod(t,60))' "$1"
}
PIPS='0.5*lt(floor(mod(t,10)/0.12),1+floor(mod(t,60)/10))*lt(mod(mod(t,10),0.12),0.04)*sin(2*PI*1760*t)'

# render <tone steps> <seconds> <out.wav>: the marker sound as 16-bit 44.1 kHz stereo.
render() {
  ffmpeg -hide_banner -loglevel error -y \
    -filter_complex "aevalsrc='$(tone "$1")+${PIPS}':s=${RATE}:d=$2[tone];anoisesrc=color=pink:amplitude=0.03:sample_rate=${RATE}:duration=$2:seed=893[noise];[tone][noise]amix=inputs=2:duration=first:normalize=0,aformat=sample_fmts=s16:channel_layouts=stereo[out]" \
    -map "[out]" -c:a pcm_s16le "$3"
}

made=()

if [ "$ONLY" != "lock" ]; then
  log "writing ${DURATION_S}s tracks to $OUT_DIR"
  MASTER="$OUT_DIR/$BASE.wav"
  log "rendering the WAV master"
  render 6 "$DURATION_S" "$MASTER"

  log "encoding MP3 (320 kbps CBR)"
  ffmpeg -hide_banner -loglevel error -y -i "$MASTER" -c:a libmp3lame -b:a 320k "$OUT_DIR/$BASE.mp3"

  # faststart puts the moov atom first, as most music files have it; a file
  # with moov at the end makes the element read the tail first, which is worth
  # one extra check if time allows.
  log "encoding M4A/AAC (256 kbps)"
  ffmpeg -hide_banner -loglevel error -y -i "$MASTER" -c:a aac -b:a 256k -movflags +faststart "$OUT_DIR/$BASE.m4a"

  log "encoding FLAC"
  ffmpeg -hide_banner -loglevel error -y -i "$MASTER" -c:a flac "$OUT_DIR/$BASE.flac"
  for ext in mp3 m4a flac wav; do
    made+=("$OUT_DIR/$BASE.$ext")
  done
fi

if [ "$ONLY" != "formats" ]; then
  log "rendering the ${LOCK_DURATION_S}s lock track (WAV, about $((LOCK_DURATION_S * 176400 / 1000000)) MB)"
  render 12 "$LOCK_DURATION_S" "$OUT_DIR/$LOCK_BASE.wav"
  made+=("$OUT_DIR/$LOCK_BASE.wav")
fi

log "done; what was made:"
for f in "${made[@]}"; do
  probe="$(ffprobe -v error -show_entries format=duration,bit_rate,size -of default=nw=1:nk=1 "$f" | tr '\n' ' ')"
  read -r duration size bitrate <<<"$probe"
  printf '  %-5s %8.1f s  %6d kbps  %10d bytes  %s\n' "${f##*.}" "$duration" "$((bitrate / 1000))" "$size" "$f"
done
