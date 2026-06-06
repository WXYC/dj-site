#!/usr/bin/env bash
#
# wait-for-cf-preview.sh — poll Cloudflare Pages deployments API for the
# preview deployment matching TARGET_SHA, returning its URL on success.
#
# Called by .github/workflows/staging-gate.yml immediately after
# `push: main` (or `workflow_dispatch`). Treats CF's `latest_stage.status`
# field as the source of truth — same convention as the existing
# `cloudflare-deploy-status.yml` hourly monitor. Adds a SHA filter on
# `deployment_trigger.metadata.commit_hash` so we wait for the *exact*
# build of the SHA we want to promote (CF returns deployments in
# reverse-chronological order, so the latest deploy is not necessarily
# the one we're gating on if pushes arrive close together).
#
# Env:
#   CF_ACCOUNT_ID      — required, Cloudflare account UUID
#   CF_API_TOKEN       — required, CF API bearer
#   CF_PROJECT         — required, Pages project name (e.g. wxyc-dj)
#   TARGET_SHA         — required, 40-char hex SHA to find
#   POLL_TIMEOUT_SECS  — optional, default 600 (10 minutes)
#   POLL_INTERVAL_SECS — optional, default 10
#
# Outputs (to $GITHUB_OUTPUT if set):
#   preview_url=<url>
#   deployment_id=<id>
#
# Exit:
#   0 — found a matching deployment with status=success and non-empty url
#   1 — matching deployment had status=failure, OR url was empty, OR timeout
#   2 — usage error
#
# Requires: curl, jq, bash 4+.

set -uo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
API_TOKEN="${CF_API_TOKEN:-}"
PROJECT="${CF_PROJECT:-}"
TARGET="${TARGET_SHA:-}"
TIMEOUT_SECS="${POLL_TIMEOUT_SECS:-600}"
INTERVAL_SECS="${POLL_INTERVAL_SECS:-10}"

if [[ -z "$ACCOUNT_ID" ]]; then
    echo "wait-for-cf-preview: CF_ACCOUNT_ID is required" >&2
    exit 2
fi
if [[ -z "$API_TOKEN" ]]; then
    echo "wait-for-cf-preview: CF_API_TOKEN is required" >&2
    exit 2
fi
if [[ -z "$PROJECT" ]]; then
    echo "wait-for-cf-preview: CF_PROJECT is required" >&2
    exit 2
fi
if [[ -z "$TARGET" ]]; then
    echo "wait-for-cf-preview: TARGET_SHA is required" >&2
    exit 2
fi
if ! [[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]; then
    echo "wait-for-cf-preview: TARGET_SHA is not a 40-char hex sha: '$TARGET'" >&2
    exit 2
fi

emit_output() {
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        if ! printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; then
            echo "wait-for-cf-preview: failed to write $1=$2 to \$GITHUB_OUTPUT ($GITHUB_OUTPUT)" >&2
            exit 1
        fi
    fi
}

# CF Pages deployments endpoint; per_page=25 covers the recent window.
# Reverse-chronological order means our target deploy is usually at the
# top, but we filter by SHA defensively.
URL="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/deployments?env=preview&per_page=25"

# SECONDS resets per subshell; safe in this single-script context.
SECONDS=0
last_status=""

while (( SECONDS < TIMEOUT_SECS )); do
    # Capture both body and HTTP status. -s silent, -m 30 per-request cap
    # so a hung connection can't eat the whole budget.
    response="$(curl -sS -m 30 \
        -H "Authorization: Bearer ${API_TOKEN}" \
        -H "Accept: application/json" \
        -w '\n%{http_code}' \
        "$URL" 2>/dev/null || echo $'\n000')"
    http_code="${response##*$'\n'}"
    body="${response%$'\n'*}"

    if [[ "$http_code" != "200" ]]; then
        last_status="http=${http_code}"
        sleep "$INTERVAL_SECS"
        continue
    fi

    # Find the latest deployment matching TARGET. Sort by `created_on` so
    # that if CF reordered the result array (rare but observed in their
    # API during high-load windows), we still pick the most recent
    # attempt for the SHA — not whichever one happens to come first.
    # Pattern lifted from .github/workflows/pr-preview-smoke.yml's wait
    # step, which has been live since 2026-06-03.
    match_json="$(jq -c --arg sha "$TARGET" '
        .result
        | map(select(.deployment_trigger.metadata.commit_hash == $sha))
        | sort_by(.created_on) | reverse | .[0] // empty
    ' <<<"$body" 2>/dev/null)"

    if [[ -z "$match_json" ]]; then
        last_status="no-match-yet"
        sleep "$INTERVAL_SECS"
        continue
    fi

    match_status="$(jq -r '.latest_stage.status // ""' <<<"$match_json")"
    match_url="$(jq -r '.url // ""' <<<"$match_json")"
    match_id="$(jq -r '.id // ""' <<<"$match_json")"

    case "$match_status" in
        success)
            if [[ -z "$match_url" ]]; then
                echo "wait-for-cf-preview: deployment ${match_id} reported success but url is empty" >&2
                exit 1
            fi
            echo "wait-for-cf-preview: ${TARGET} ready at ${match_url} (deployment ${match_id}, elapsed ${SECONDS}s)"
            emit_output preview_url "$match_url"
            emit_output deployment_id "$match_id"
            exit 0
            ;;
        # CF Pages emits all four spellings across endpoints (`failure`
        # appears in some payloads, `failed` in others; same for the
        # cancellation pair). Treat all as terminal-fail so a typo in
        # the CF API doesn't silently unblock the promotion.
        failure|failed|canceled|cancelled)
            echo "wait-for-cf-preview: deployment ${match_id} for ${TARGET} reported ${match_status} — not promoting" >&2
            echo "wait-for-cf-preview: CF Pages dashboard: https://dash.cloudflare.com/${ACCOUNT_ID}/pages/view/${PROJECT}/${match_id}" >&2
            exit 1
            ;;
        *)
            last_status="cf=${match_status}"
            sleep "$INTERVAL_SECS"
            ;;
    esac
done

echo "wait-for-cf-preview: timed out after ${TIMEOUT_SECS}s waiting for ${TARGET} (last status: ${last_status})" >&2
exit 1
