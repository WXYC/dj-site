#!/usr/bin/env bash
#
# A private, throwaway S3 bucket for the service-worker spike, with the review
# bucket's audio CORS rule, the test tracks, and presigned GET URLs to paste
# into the spike page.
#
# Run it yourself, from a terminal signed in to the WXYC AWS account:
#   aws sso login --profile wxyc-api
#   spike/make-test-bucket.sh create   [bucket] [audio-dir]  # bucket + CORS + upload + URLs
#   spike/make-test-bucket.sh upload   [bucket] [audio-dir]  # upload only the tracks not there yet
#   spike/make-test-bucket.sh presign  [bucket]              # fresh URLs only
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
BUCKET="${2:-wxyc-dj-site-spike-sw-audio}"
AUDIO_DIR="${3:-$SCRIPT_DIR/test-audio}"
PREFIX="spike"
EXPIRES_S=604800 # 7 days, the SigV4 maximum
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
  printf '%s make-test-bucket: %s\n' "$(date '+%H:%M:%S')" "$*" >&2
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
    printf '%s make-test-bucket: dry run, would run: aws' "$(date '+%H:%M:%S')" >&2
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
# Cloudflare Pages project shares.
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
    }
  ]
}
JSON
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

  log "applying the review bucket's audio CORS rule"
  local cors_file
  cors_file="$(mktemp)"
  cors_json >"$cors_file"
  write s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$cors_file"
  rm -f "$cors_file"

  upload_tracks
  presign
}

upload() {
  need_session
  if ! aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
    log "bucket $BUCKET does not exist or this session cannot reach it; run: spike/make-test-bucket.sh create"
    exit 1
  fi
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
  log "deleting every object in $BUCKET, then the bucket"
  write s3 rm "s3://$BUCKET" --recursive --only-show-errors
  write s3api delete-bucket --bucket "$BUCKET"
  log "deleted $BUCKET"
}

case "$COMMAND" in
  create) create ;;
  upload) upload ;;
  presign) presign ;;
  teardown) teardown ;;
  -h | --help | help) usage 0 ;;
  *) usage ;;
esac
