#!/usr/bin/env bash
#
# A private, throwaway S3 bucket for the service-worker spike, with the review
# bucket's audio CORS rule, the four test tracks, and presigned GET URLs to
# paste into the spike page.
#
# Run it yourself, from a terminal signed in to the WXYC AWS account:
#   aws sso login --profile wxyc-api
#   spike/make-test-bucket.sh create   [bucket] [audio-dir]  # bucket + CORS + upload + URLs
#   spike/make-test-bucket.sh presign  [bucket]              # fresh URLs only
#   spike/make-test-bucket.sh teardown [bucket]              # delete the objects and the bucket
#
# bucket defaults to wxyc-dj-site-spike-sw-audio; audio-dir to spike/test-audio
# (make it with spike/make-test-audio.sh first).
#
# The URLs are credentials. Paste them into the spike page's form only; never
# into an issue, a PR, a chat or a commit.
#
# URLs signed with SSO credentials stop working when the SSO session ends
# (often within hours), whatever --expires-in says. When the page's log shows
# S3 answering 403 (ExpiredToken or AccessDenied), sign in again and run
# `presign`.

set -euo pipefail

export AWS_PROFILE=wxyc-api
export AWS_REGION=us-east-1
export AWS_DEFAULT_REGION=us-east-1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-}"
BUCKET="${2:-wxyc-dj-site-spike-sw-audio}"
AUDIO_DIR="${3:-$SCRIPT_DIR/test-audio}"
PREFIX="spike"
BASE="spike-marker-10min"
EXPIRES_S=604800 # 7 days, the SigV4 maximum
# track id (as in public/spike/sources.json), file extension, Content-Type
TRACKS=("mp3 mp3 audio/mpeg" "m4a m4a audio/mp4" "flac flac audio/flac" "wav wav audio/wav")

log() {
  printf '%s make-test-bucket: %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

trap 'log "failed at line $LINENO"; exit 1' ERR

usage() {
  sed -n '2,22p' "$0" >&2
  exit 2
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

create() {
  need_session
  for t in "${TRACKS[@]}"; do
    read -r _ ext _ <<<"$t"
    if [ ! -f "$AUDIO_DIR/$BASE.$ext" ]; then
      log "missing $AUDIO_DIR/$BASE.$ext; run spike/make-test-audio.sh first"
      exit 1
    fi
  done

  if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
    log "bucket $BUCKET exists and this session can reach it; reapplying its settings"
  else
    log "creating bucket $BUCKET in $AWS_REGION"
    # us-east-1 takes no LocationConstraint. A name another account already
    # owns fails here; pass a different name as the second argument.
    aws s3api create-bucket --bucket "$BUCKET" >/dev/null
    aws s3api wait bucket-exists --bucket "$BUCKET"
  fi

  log "blocking all public access"
  aws s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

  log "disabling ACLs (bucket owner enforced)"
  aws s3api put-bucket-ownership-controls --bucket "$BUCKET" \
    --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

  log "default encryption (SSE-S3)"
  aws s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  log "a lifecycle rule that empties the bucket 30 days after upload, in case teardown is forgotten"
  aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration '{"Rules":[{"ID":"spike-expire","Status":"Enabled","Filter":{},"Expiration":{"Days":30},"AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}}]}'

  aws s3api put-bucket-tagging --bucket "$BUCKET" \
    --tagging 'TagSet=[{Key=purpose,Value=dj-site-service-worker-spike},{Key=throwaway,Value=true}]'

  log "applying the review bucket's audio CORS rule"
  local cors_file
  cors_file="$(mktemp)"
  cors_json >"$cors_file"
  aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "file://$cors_file"
  rm -f "$cors_file"

  for t in "${TRACKS[@]}"; do
    read -r id ext type <<<"$t"
    log "uploading $id ($type)"
    aws s3 cp "$AUDIO_DIR/$BASE.$ext" "s3://$BUCKET/$PREFIX/$BASE.$ext" --content-type "$type" --only-show-errors
  done

  presign
}

presign() {
  need_session
  log "presigned GET URLs (asked for 7 days; they end with this SSO session)."
  log "paste the lines below into the spike page's \"Save all\" box. They are credentials: never post them."
  for t in "${TRACKS[@]}"; do
    read -r id ext _ <<<"$t"
    printf '%s %s\n' "$id" "$(aws s3 presign "s3://$BUCKET/$PREFIX/$BASE.$ext" --expires-in "$EXPIRES_S")"
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
  aws s3 rm "s3://$BUCKET" --recursive --only-show-errors
  aws s3api delete-bucket --bucket "$BUCKET"
  log "deleted $BUCKET"
}

case "$COMMAND" in
  create) create ;;
  presign) presign ;;
  teardown) teardown ;;
  *) usage ;;
esac
