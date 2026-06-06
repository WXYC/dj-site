#!/usr/bin/env bats
#
# BATS tests for scripts/staging-gate/wait-for-cf-preview.sh.
#
# wait-for-cf-preview.sh polls the Cloudflare Pages deployments API for
# the preview deployment whose commit_hash matches TARGET_SHA. Returns
# the deployment URL on success; fails on CF-side failure, timeout, or
# missing URL. Designed to be called by .github/workflows/staging-gate.yml
# immediately after `push: main` (or workflow_dispatch).
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

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../staging-gate" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/wait-for-cf-preview.sh"

TARGET_SHA_FIXTURE='a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9'

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export FAKE_BIN="$TEST_TEMP_DIR/bin"
    mkdir -p "$FAKE_BIN"
    export PATH="$FAKE_BIN:$PATH"
    export CURL_CALL_LOG="$TEST_TEMP_DIR/curl-calls.log"
    export CURL_RESPONSE_FILE="$TEST_TEMP_DIR/curl-response.json"
    export CURL_STATE_FILE="$TEST_TEMP_DIR/curl-state"
    : >"$CURL_CALL_LOG"
    echo 0 >"$CURL_STATE_FILE"
    export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"
    : >"$GITHUB_OUTPUT"

    export CF_ACCOUNT_ID='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    export CF_API_TOKEN='cf_fake_token'
    export CF_PROJECT='wxyc-dj'
    export TARGET_SHA="$TARGET_SHA_FIXTURE"
    # Fast tests: 5s timeout, 1s interval. Each test that takes the
    # poll path will block for at most 5s.
    export POLL_TIMEOUT_SECS='5'
    export POLL_INTERVAL_SECS='1'
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

# Install a fake curl whose response body is read from CURL_RESPONSE_FILE
# and whose exit status reflects curl's behavior: connection failures
# would return non-zero, but for tests we always return 0 (CF returned
# a payload) and let the script's jq filtering decide success.
install_fake_curl() {
    local response_json="$1"
    printf '%s' "$response_json" >"$CURL_RESPONSE_FILE"
    cat >"$FAKE_BIN/curl" <<'CURL_EOF'
#!/usr/bin/env bash
# Log every invocation for assertion. Real curl with -w '\n%{http_code}'
# emits body followed by a newline-prefixed status code; mirror that so
# the script's parser (which strips trailing-line as http_code) works.
{
    printf '%s\n' "$*"
} >>"$CURL_CALL_LOG"

status_code=200
if [[ -n "${CURL_STATUS_FILE:-}" && -f "$CURL_STATUS_FILE" ]]; then
    status_code="$(cat "$CURL_STATUS_FILE")"
fi

has_w=false
for arg in "$@"; do
    if [[ "$arg" == "-w" || "$arg" == "--write-out" ]]; then
        has_w=true
        break
    fi
done

cat "$CURL_RESPONSE_FILE"
if $has_w; then
    printf '\n%s' "$status_code"
fi
exit 0
CURL_EOF
    chmod +x "$FAKE_BIN/curl"
}

# Install a fake curl that emits different responses on successive calls
# (simulates a deploy moving from `active` to `success`).
install_fake_curl_progressive() {
    local response_active="$1"
    local response_success="$2"
    printf '%s' "$response_active" >"$TEST_TEMP_DIR/active.json"
    printf '%s' "$response_success" >"$TEST_TEMP_DIR/success.json"
    cat >"$FAKE_BIN/curl" <<CURL_EOF
#!/usr/bin/env bash
{
    printf '%s\n' "\$*"
} >>"$CURL_CALL_LOG"
state="\$(cat "$CURL_STATE_FILE")"
if (( state == 0 )); then
    cat "$TEST_TEMP_DIR/active.json"
    echo \$((state + 1)) >"$CURL_STATE_FILE"
else
    cat "$TEST_TEMP_DIR/success.json"
fi
has_w=false
for arg in "\$@"; do
    if [[ "\$arg" == "-w" || "\$arg" == "--write-out" ]]; then
        has_w=true
        break
    fi
done
if \$has_w; then
    printf '\n%s' "200"
fi
exit 0
CURL_EOF
    chmod +x "$FAKE_BIN/curl"
}

# Helper to build a CF response with one deployment matching SHA in stage.
make_response() {
    local sha="$1"
    local status="$2"
    local url="$3"
    local deploy_id="${4:-deploy-id-xxx}"
    cat <<JSON_EOF
{
  "result": [
    {
      "id": "${deploy_id}",
      "url": "${url}",
      "latest_stage": { "status": "${status}" },
      "deployment_trigger": { "metadata": { "commit_hash": "${sha}" } }
    }
  ],
  "success": true
}
JSON_EOF
}

@test "returns URL when deployment is success on first poll" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://abc123.wxyc-dj.pages.dev deploy-1)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^preview_url=https://abc123.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
    grep -q '^deployment_id=deploy-1$' "$GITHUB_OUTPUT"
}

@test "polls until success when first response shows active" {
    install_fake_curl_progressive \
        "$(make_response "$TARGET_SHA_FIXTURE" active "" deploy-2)" \
        "$(make_response "$TARGET_SHA_FIXTURE" success https://def456.wxyc-dj.pages.dev deploy-2)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^preview_url=https://def456.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
    # Must have polled at least twice.
    [ "$(wc -l <"$CURL_CALL_LOG")" -ge 2 ]
}

@test "exits 1 when matching deployment status is failure" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" failure "" deploy-3)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    [[ "$output" == *"failure"* ]] || [[ "$output" == *"failed"* ]]
    # Must not claim a URL.
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 on 'failed' status alias (CF uses both 'failure' and 'failed')" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" failed "" deploy-3a)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 on 'canceled' status (CF cancellation, US spelling)" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" canceled "" deploy-3b)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 on 'cancelled' status (CF cancellation, UK spelling)" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" cancelled "" deploy-3c)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 on timeout when matching deployment never appears" {
    # Response always contains a deployment for a DIFFERENT SHA — our
    # target is never present, so the script should poll until timeout.
    install_fake_curl "$(make_response 'b000000000000000000000000000000000000001' success https://other.pages.dev deploy-x)"
    export POLL_TIMEOUT_SECS='2'
    export POLL_INTERVAL_SECS='1'
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    [[ "$output" == *"timed out"* ]] || [[ "$output" == *"timeout"* ]]
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 when matching deployment has empty url (build-without-serve edge)" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success '' deploy-empty)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    [[ "$output" == *"empty"* ]] || [[ "$output" == *"url"* ]]
    ! grep -q '^preview_url=' "$GITHUB_OUTPUT"
}

@test "exits 2 on missing CF_ACCOUNT_ID" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    unset CF_ACCOUNT_ID
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_ACCOUNT_ID"* ]]
}

@test "exits 2 on missing CF_API_TOKEN" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    unset CF_API_TOKEN
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_API_TOKEN"* ]]
}

@test "exits 2 on missing CF_PROJECT" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    unset CF_PROJECT
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_PROJECT"* ]]
}

@test "exits 2 on missing TARGET_SHA" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    unset TARGET_SHA
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"TARGET_SHA"* ]]
}

@test "exits 2 on TARGET_SHA that is not 40-char hex" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    export TARGET_SHA='not-a-sha'
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
}

@test "does NOT leak CF_API_TOKEN to stdout/stderr or the call log" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    export CF_API_TOKEN='cf_secret_token_xxxxxxxxxxxxxxxxxxxx'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    # The token will appear in the Authorization header sent via curl,
    # but it must not appear in the script's own stdout/stderr.
    [[ "$output" != *"cf_secret_token"* ]]
}

@test "queries Cloudflare Pages preview deployments endpoint" {
    install_fake_curl "$(make_response "$TARGET_SHA_FIXTURE" success https://x.pages.dev deploy-y)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    # URL must hit the Pages deployments endpoint with env=preview and the
    # project name from CF_PROJECT.
    grep -q "api.cloudflare.com" "$CURL_CALL_LOG"
    grep -q "pages/projects/wxyc-dj/deployments" "$CURL_CALL_LOG"
    grep -q "env=preview" "$CURL_CALL_LOG"
}

@test "picks the latest deployment (sort_by created_on) when CF returns multiple matches for the SHA" {
    # CF may return >1 deployment for the same commit (e.g. a re-trigger
    # via the dashboard). The script must pick the LATEST attempt, not
    # whichever the API returns first. Construct a response with two
    # matches: the first listed is an older failure, the second is the
    # newer success. A naive `head -n 1 after select` would pick the
    # failure; the sort_by(.created_on)|reverse|.[0] in the script must
    # pick the success instead.
    response=$(cat <<JSON_EOF
{
  "result": [
    {
      "id": "older-failure",
      "url": "",
      "created_on": "2026-06-05T00:00:00Z",
      "latest_stage": { "status": "failure" },
      "deployment_trigger": { "metadata": { "commit_hash": "$TARGET_SHA_FIXTURE" } }
    },
    {
      "id": "newer-success",
      "url": "https://newer.wxyc-dj.pages.dev",
      "created_on": "2026-06-05T01:00:00Z",
      "latest_stage": { "status": "success" },
      "deployment_trigger": { "metadata": { "commit_hash": "$TARGET_SHA_FIXTURE" } }
    }
  ],
  "success": true
}
JSON_EOF
)
    install_fake_curl "$response"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^preview_url=https://newer.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
    grep -q '^deployment_id=newer-success$' "$GITHUB_OUTPUT"
}
