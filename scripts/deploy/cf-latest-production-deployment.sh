#!/usr/bin/env bash
#
# cf-latest-production-deployment.sh — query the Cloudflare Pages API for the
# latest *production* deployment and emit its status, id, commit SHA, and
# commit-message first line to $GITHUB_OUTPUT.
#
# Called by .github/workflows/cloudflare-deploy-status.yml (hourly monitor).
# Extracted from that workflow's inline query step so the commit-message
# parse can be null-safe: Direct-Upload (`ad_hoc`) deployments can carry a
# null commit_message, and `<null> | split("\n")` errors in jq — under the
# runner's `bash -e` that killed the monitor step (WXYC/dj-site#810).
#
# Env:
#   CF_ACCOUNT_ID — required, Cloudflare account UUID
#   CF_API_TOKEN  — required, CF API bearer
#   CF_PROJECT    — required, Pages project name (e.g. wxyc-dj)
#
# Outputs (to $GITHUB_OUTPUT if set):
#   status=<latest_stage.status>
#   deploy_id=<id>
#   commit_sha=<deployment_trigger.metadata.commit_hash>
#   commit_msg=<first line of commit_message, or empty>
#
# Exit:
#   0 — got a 200 and parsed (fields may be empty)
#   1 — Cloudflare API request failed (non-200 / curl error)
#   2 — usage error
#
# Requires: curl, jq, bash 4+.

set -uo pipefail

ACCOUNT_ID="${CF_ACCOUNT_ID:-}"
API_TOKEN="${CF_API_TOKEN:-}"
PROJECT="${CF_PROJECT:-}"

if [[ -z "$ACCOUNT_ID" ]]; then
    echo "cf-latest-production-deployment: CF_ACCOUNT_ID is required" >&2
    exit 2
fi
if [[ -z "$API_TOKEN" ]]; then
    echo "cf-latest-production-deployment: CF_API_TOKEN is required" >&2
    exit 2
fi
if [[ -z "$PROJECT" ]]; then
    echo "cf-latest-production-deployment: CF_PROJECT is required" >&2
    exit 2
fi

emit_output() {
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        if ! printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; then
            echo "cf-latest-production-deployment: failed to write $1=$2 to \$GITHUB_OUTPUT ($GITHUB_OUTPUT)" >&2
            exit 1
        fi
    fi
}

URL="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}/deployments?env=production&per_page=1"

response="$(curl -sS -m 30 \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Accept: application/json" \
    -w '\n%{http_code}' \
    "$URL" 2>/dev/null || echo $'\n000')"
http_code="${response##*$'\n'}"
body="${response%$'\n'*}"

if [[ "$http_code" != "200" ]]; then
    echo "cf-latest-production-deployment: Cloudflare API request failed (http=${http_code})" >&2
    exit 1
fi

status="$(jq -r '.result[0].latest_stage.status // ""' <<<"$body")"
deploy_id="$(jq -r '.result[0].id // ""' <<<"$body")"
commit_sha="$(jq -r '.result[0].deployment_trigger.metadata.commit_hash // ""' <<<"$body")"
# Null-safe: ad_hoc (Direct Upload) deployments can have a null
# commit_message. `<null> | split(...)` errors in jq, so coalesce to "" first.
commit_msg="$(jq -r '(.result[0].deployment_trigger.metadata.commit_message // "") | split("\n")[0] // ""' <<<"$body")"

emit_output status "$status"
emit_output deploy_id "$deploy_id"
emit_output commit_sha "$commit_sha"
emit_output commit_msg "$commit_msg"
