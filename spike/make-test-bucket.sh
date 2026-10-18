#!/usr/bin/env bash
#
# A private, throwaway S3 bucket for the service-worker spike, with the review
# bucket's audio CORS rule, the test tracks, and presigned GET URLs to paste
# into the spike page; and the phone lock test's one-tap link and results.
#
# Run it yourself, from a terminal signed in to the WXYC AWS account:
#   aws sso login --profile wxyc-api
#   spike/make-test-bucket.sh create   [bucket] [audio-dir]  # bucket + CORS + upload + URLs
#   spike/make-test-bucket.sh upload   [bucket] [audio-dir]  # upload only the tracks not there yet
#   spike/make-test-bucket.sh cors     [bucket]              # apply the CORS rules again (audio GET, results PUT)
#   spike/make-test-bucket.sh presign  [bucket]              # fresh URLs only
#   spike/make-test-bucket.sh phone    [bucket]              # the phone lock test's link, onto the clipboard
#   spike/make-test-bucket.sh results  [run-id] [bucket]     # fetch a phone run's results and summarize them
#   spike/make-test-bucket.sh teardown [bucket]              # delete the objects and the bucket
#   spike/make-test-bucket.sh --help                         # this text
#
# bucket defaults to wxyc-dj-site-spike-sw-audio; audio-dir to spike/test-audio
# (make it with spike/make-test-audio.sh first). The tracks are the four
# ten-minute formats and the thirty-minute lock track. create and upload are
# safe to run again: an object that is already in the bucket is left as it
# is, and only a missing one is uploaded.
#
# DRY_RUN=1 prints each command that would change something in AWS instead
# of running it; the read-only checks still run, so it needs a session too.
# With phone it signs with placeholder credentials instead (no session
# needed), prints the link's length, and copies nothing.
#
# phone presigns a GET for the lock track and PUTs for
# spike/results/<run-id>/page.json and worker.json (an hour, or until the SSO
# role session ends if that is sooner), packs them into the phone page's URL
# fragment, and copies the URL to the clipboard with pbcopy. It prints only
# the run id, the URL's length and when the links expire, never the URL. On
# the iPhone: Safari's address bar, Paste and Go, Start, lock the phone. It
# needs Node and Python 3 with boto3 (the aws CLI presigns only GET);
# SPIKE_PYTHON picks the Python, for example
#   SPIKE_PYTHON=/path/to/venv/bin/python spike/make-test-bucket.sh phone
#   SPIKE_PYTHON='uv run --no-project --with boto3 python3' spike/make-test-bucket.sh phone
# PHONE_PAGE overrides the page it links to (default: the branch alias's
# /spike/phone, the clean URL Pages serves phone.html at without a redirect).
#
# results downloads both files of a run (default: the last run phone made)
# into spike/phone-results/<run-id>/ (git-ignored) and prints a summary in
# Pacific time. A file not in the bucket yet is skipped, and a local copy is
# never deleted.
#
# The URLs are credentials. Paste them into the spike page's form only; never
# into an issue, a PR, a chat or a commit. To copy them without printing
# them: spike/make-test-bucket.sh presign | pbcopy
#
# URLs signed with SSO credentials stop working when the SSO session ends
# (often within hours), whatever --expires-in says. When the page says the
# track links have expired (S3 answering 403 AccessDenied or 400 ExpiredToken),
# sign in again and run `presign`.

set -euo pipefail

export AWS_PROFILE=wxyc-api
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-}"
DEFAULT_BUCKET="wxyc-dj-site-spike-sw-audio"
RUN_ARG=""
if [ "$COMMAND" = "results" ]; then
  RUN_ARG="${2:-}"
  BUCKET="${3:-$DEFAULT_BUCKET}"
else
  BUCKET="${2:-$DEFAULT_BUCKET}"
fi
AUDIO_DIR="${3:-$SCRIPT_DIR/test-audio}"
PREFIX="spike"
EXPIRES_S=604800 # 7 days, the SigV4 maximum
PHONE_EXPIRES_S=3600 # the role session's credentials cap it anyway
PHONE_PAGE="${PHONE_PAGE:-https://spike-safari-sw-audio.dj-site.pages.dev/spike/phone?respond=rebuilt}"
LOCK_KEY="$PREFIX/spike-marker-30min.wav"
RESULTS_DIR="$SCRIPT_DIR/phone-results"
DRY_RUN="${DRY_RUN:-0}"
# track id (as in public/spike/sources.json), file name, Content-Type
TRACKS=(
  "mp3 spike-marker-10min.mp3 audio/mpeg"
  "m4a spike-marker-10min.m4a audio/mp4"
  "flac spike-marker-10min.flac audio/flac"
  "wav spike-marker-10min.wav audio/wav"
  "lock spike-marker-30min.wav audio/wav"
)

log() {
  printf '%s make-test-bucket: %s\n' "$(TZ=America/Los_Angeles date '+%H:%M:%S %Z')" "$*" >&2
}

trap 'log "failed at line $LINENO"; exit 1' ERR

# The comment block at the top of this file.
usage() {
  awk 'NR <= 2 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0" >&2
  exit "${1:-2}"
}

# Runs an aws command that changes something, or prints it under DRY_RUN=1.
write() {
  if [ "$DRY_RUN" = "1" ]; then
    printf '%s make-test-bucket: dry run, would run: aws' "$(TZ=America/Los_Angeles date '+%H:%M:%S %Z')" >&2
    printf ' %q' "$@" >&2
    printf '\n' >&2
    return 0
  fi
  aws "$@"
}

need_session() {
  if ! aws sts get-caller-identity --query UserId --output text >/dev/null 2>&1; then
    log "no AWS session for profile $AWS_PROFILE; run: aws sso login --profile $AWS_PROFILE"
    exit 1
  fi
}

# The audio rule from the review bucket's stack: GET and HEAD, the Range
# request header, Content-Range / Content-Length / Accept-Ranges exposed, and
# exactly the DJ site's two origins. Never https://*.pages.dev, which every
# Cloudflare Pages project shares. The second rule lets the phone test's page
# and worker PUT their results (JSON, so a Content-Type header) from the same
# two origins.
cors_json() {
  cat <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://dj.wxyc.org", "https://*.dj-site.pages.dev"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["Range"],
      "ExposeHeaders": ["Content-Range", "Content-Length", "Accept-Ranges"],
      "MaxAgeSeconds": 3600
    },
    {
      "AllowedOrigins": ["https://dj.wxyc.org", "https://*.dj-site.pages.dev"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
JSON
}

# Replaces the bucket's whole CORS configuration with cors_json, so running
# it again changes nothing.
apply_cors() {
  log "applying the CORS rules: GET and HEAD for the audio, PUT for the phone test's results"
  if [ "$DRY_RUN" = "1" ]; then
    log "dry run: the configuration would be:"
    cors_json >&2
  fi
  local cors_file
  cors_file="$(mktemp)"
  cors_json >"$cors_file"
  write s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$cors_file"
  rm -f "$cors_file"
}

need_bucket() {
  if ! aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
    log "bucket $BUCKET does not exist or this session cannot reach it; run: spike/make-test-bucket.sh create"
    exit 1
  fi
}

# Uploads each track that is not in the bucket yet, with its Content-Type
# (the only metadata the objects carry; the bucket's default encryption and
# lifecycle rule apply to every object). An object already there is never
# replaced: a size that differs from the local file is only reported.
upload_tracks() {
  local uploaded=0 id file type key remote size
  for t in "${TRACKS[@]}"; do
    read -r id file type <<<"$t"
    key="$PREFIX/$file"
    remote="$(aws s3api head-object --bucket "$BUCKET" --key "$key" --query ContentLength --output text 2>/dev/null || true)"
    size=""
    if [ -f "$AUDIO_DIR/$file" ]; then
      size="$(wc -c <"$AUDIO_DIR/$file" | tr -d ' ')"
    fi
    if [ -n "$remote" ] && [ "$remote" != "None" ]; then
      if [ -n "$size" ] && [ "$size" != "$remote" ]; then
        log "$id: s3://$BUCKET/$key is $remote bytes but $AUDIO_DIR/$file is $size; left as it is (delete the object to replace it)"
      else
        log "$id: already in the bucket ($remote bytes)"
      fi
      continue
    fi
    if [ -z "$size" ]; then
      log "$id: missing $AUDIO_DIR/$file; run spike/make-test-audio.sh first"
      exit 1
    fi
    log "$id: uploading $file ($type, $size bytes)"
    write s3 cp "$AUDIO_DIR/$file" "s3://$BUCKET/$key" --content-type "$type" --only-show-errors
    uploaded=$((uploaded + 1))
  done
  log "uploaded $uploaded of ${#TRACKS[@]} tracks; the rest were already there"
}

create() {
  need_session

  if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
    log "bucket $BUCKET exists and this session can reach it; reapplying its settings"
  else
    log "creating bucket $BUCKET in $AWS_REGION"
    # us-east-1 takes no LocationConstraint. A name another account already
    # owns fails here; pass a different name as the second argument.
    write s3api create-bucket --bucket "$BUCKET" >/dev/null
    write s3api wait bucket-exists --bucket "$BUCKET"
  fi

  log "blocking all public access"
  write s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  log "disabling ACLs (bucket owner enforced)"
  write s3api put-bucket-ownership-controls --bucket "$BUCKET" \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

  log "default encryption (SSE-S3)"
  write s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  log "a lifecycle rule that empties the bucket 30 days after upload, in case teardown is forgotten"
  write s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration '{"Rules":[{"ID":"spike-expire","Status":"Enabled","Filter":{},"Expiration":{"Days":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

  write s3api put-bucket-tagging --bucket "$BUCKET" \
    --tagging 'TagSet=[{Key=purpose,Value=dj-site-service-worker-spike},{Key=throwaway,Value=true}]'

  apply_cors

  upload_tracks
  presign
}

upload() {
  need_session
  need_bucket
  upload_tracks
  log "next: spike/make-test-bucket.sh presign | pbcopy, then paste the lines into the spike page"
}

presign() {
  need_session
  log "presigned GET URLs (asked for 7 days; they end with this SSO session)."
  log "paste the lines below into the spike page and press \"Save links\". They are credentials: never post them."
  local id file
  for t in "${TRACKS[@]}"; do
    read -r id file _ <<<"$t"
    printf '%s %s\n' "$id" "$(aws s3 presign "s3://$BUCKET/$PREFIX/$file" --expires-in "$EXPIRES_S")"
  done
}

cors() {
  need_session
  need_bucket
  apply_cors
}

# The Python that phone-presign.py runs under: SPIKE_PYTHON (a command, which
# may have arguments) or python3. It must have boto3.
python_cmd() {
  read -r -a PY <<<"${SPIKE_PYTHON:-python3}"
  if ! "${PY[@]}" -c 'import boto3' >/dev/null 2>&1; then
    log "phone needs Python 3 with boto3, to presign the results' PUT links (the aws CLI presigns only GET); ${PY[*]} has no boto3."
    log "  a Python that has it: SPIKE_PYTHON=/path/to/venv/bin/python spike/make-test-bucket.sh phone"
    log "  or a throwaway one:   SPIKE_PYTHON='uv run --no-project --with boto3 python3' spike/make-test-bucket.sh phone"
    exit 1
  fi
}

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    log "phone and results need Node 18 or newer"
    exit 1
  fi
}

# The phone lock test's link: three presigned links packed into the page's
# URL fragment, onto the clipboard. The URL holds credentials: it goes from
# phone-presign.py through a pipe to phone-tool.mjs, which hands it to pbcopy
# and prints only the run id, the length and the expiry.
phone() {
  python_cmd
  need_node
  local run_id
  run_id="$(openssl rand -hex 3)"
  local presign_args=(--bucket "$BUCKET" --run "$run_id" --track-key "$LOCK_KEY" --expires "$PHONE_EXPIRES_S")
  if [ "$DRY_RUN" = "1" ]; then
    log "dry run: signing with placeholder credentials, so the link works nowhere; nothing is copied"
    "${PY[@]}" "$SCRIPT_DIR/phone-presign.py" "${presign_args[@]}" --placeholder-credentials |
      node "$SCRIPT_DIR/phone-tool.mjs" link --page "$PHONE_PAGE"
    return
  fi
  need_session
  need_bucket
  local size methods
  size="$(aws s3api head-object --bucket "$BUCKET" --key "$LOCK_KEY" --query ContentLength --output text 2>/dev/null || true)"
  if [ -z "$size" ] || [ "$size" = "None" ]; then
    log "the lock track is not in the bucket; run: spike/make-test-bucket.sh upload"
    exit 1
  fi
  methods="$(aws s3api get-bucket-cors --bucket "$BUCKET" --query 'CORSRules[].AllowedMethods[]' --output text 2>/dev/null || true)"
  if ! grep -qw PUT <<<"$methods"; then
    log "the bucket's CORS rules do not allow PUT yet, so the results could not be sent; run: spike/make-test-bucket.sh cors"
    exit 1
  fi
  "${PY[@]}" "$SCRIPT_DIR/phone-presign.py" "${presign_args[@]}" |
    node "$SCRIPT_DIR/phone-tool.mjs" link --page "$PHONE_PAGE" --copy
  mkdir -p "$RESULTS_DIR"
  printf '%s\n' "$run_id" >"$RESULTS_DIR/last-run"
}

# Downloads a phone run's page.json and worker.json (each to a temporary name
# first, so a failed download never touches a copy already here) and prints
# the summary.
results() {
  need_node
  local run_id="$RUN_ARG"
  if [ -z "$run_id" ] && [ -f "$RESULTS_DIR/last-run" ]; then
    run_id="$(tr -d '[:space:]' <"$RESULTS_DIR/last-run")"
  fi
  if [ -z "$run_id" ]; then
    log "no run id: pass the one phone printed (spike/make-test-bucket.sh results <run-id>)"
    exit 1
  fi
  if ! [[ "$run_id" =~ ^[a-z0-9]{1,32}$ ]]; then
    log "not a run id: $run_id"
    exit 1
  fi
  need_session
  local dir="$RESULTS_DIR/$run_id" name got=0
  mkdir -p "$dir"
  for name in page worker; do
    if aws s3 cp "s3://$BUCKET/$PREFIX/results/$run_id/$name.json" "$dir/.$name.json.part" --only-show-errors >/dev/null 2>&1; then
      mv -f "$dir/.$name.json.part" "$dir/$name.json"
      got=$((got + 1))
    else
      rm -f "$dir/.$name.json.part"
      log "$name.json: not in the bucket (yet)$([ -f "$dir/$name.json" ] && printf '; showing the copy downloaded earlier')"
    fi
  done
  log "downloaded $got of 2 files to $dir"
  node "$SCRIPT_DIR/phone-tool.mjs" summary "$dir"
}

teardown() {
  need_session
  # Only a bucket this script tagged as throwaway, so a mistyped name can
  # never empty a real bucket.
  local tag
  tag="$(aws s3api get-bucket-tagging --bucket "$BUCKET" --query "TagSet[?Key=='throwaway'].Value | [0]" --output text 2>/dev/null || true)"
  if [ "$tag" != "true" ]; then
    log "refusing: $BUCKET has no throwaway=true tag, so this script did not make it"
    exit 1
  fi
  # Every object: the tracks and the phone test's results under
  # $PREFIX/results/. Local copies in spike/phone-results/ stay.
  log "deleting every object in $BUCKET (the tracks and the phone test's results), then the bucket"
  write s3 rm "s3://$BUCKET" --recursive --only-show-errors
  write s3api delete-bucket --bucket "$BUCKET"
  log "deleted $BUCKET"
}

case "$COMMAND" in
  create) create ;;
  upload) upload ;;
  cors) cors ;;
  presign) presign ;;
  phone) phone ;;
  results) results ;;
  teardown) teardown ;;
  -h | --help | help) usage 0 ;;
  *) usage ;;
esac
