#!/usr/bin/env bats
#
# BATS tests for scripts/deploy/cf-latest-production-deployment.sh.
#
# cf-latest-production-deployment.sh queries the Cloudflare Pages API for the
# latest *production* deployment and emits its status / id / commit SHA /
# commit-message-first-line to $GITHUB_OUTPUT. It replaces the inline query
# step in .github/workflows/cloudflare-deploy-status.yml. The load-bearing
# fix: Direct-Upload (`ad_hoc`) deployments can have a null commit_message,
# and the old inline `... | split("\n")[0]` crashed jq (non-zero) which,
# under the runner's `bash -e`, killed the whole step. The extraction must be
# null-safe. Fake-curl-on-PATH harness modeled on
# scripts/__tests__/staging-gate/wait-for-cf-preview.test.sh.
#
# Env:
#   CF_ACCOUNT_ID — required
#   CF_API_TOKEN  — required
#   CF_PROJECT    — required (e.g. wxyc-dj)
#
# Outputs (to $GITHUB_OUTPUT if set):
#   status=<latest_stage.status>
#   deploy_id=<id>
#   commit_sha=<commit_hash>
#   commit_msg=<first line of commit_message, or empty>
#
# Exit:
#   0 — got a 200 and parsed (fields may be empty)
#   1 — Cloudflare API request failed (non-200 / curl error)
#   2 — usage error

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../deploy" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/cf-latest-production-deployment.sh"

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export FAKE_BIN="$TEST_TEMP_DIR/bin"
    mkdir -p "$FAKE_BIN"
    export PATH="$FAKE_BIN:$PATH"
    export CURL_CALL_LOG="$TEST_TEMP_DIR/curl-calls.log"
    export CURL_RESPONSE_FILE="$TEST_TEMP_DIR/curl-response.json"
    export CURL_STATUS_FILE="$TEST_TEMP_DIR/curl-status"
    : >"$CURL_CALL_LOG"
    echo 200 >"$CURL_STATUS_FILE"
    export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"
    : >"$GITHUB_OUTPUT"

    export CF_ACCOUNT_ID='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    export CF_API_TOKEN='cf_fake_token'
    export CF_PROJECT='wxyc-dj'
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

# Fake curl: logs argv, prints the canned body, and (when -w is present)
# appends a newline + status code read from CURL_STATUS_FILE, mirroring the
# real `curl -w '\n%{http_code}'` shape the script parses.
install_fake_curl() {
    local response_json="$1"
    printf '%s' "$response_json" >"$CURL_RESPONSE_FILE"
    cat >"$FAKE_BIN/curl" <<'CURL_EOF'
#!/usr/bin/env bash
{ printf '%s\n' "$*"; } >>"$CURL_CALL_LOG"
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

# One production deployment. commit_message defaults to a single line; pass
# 'NULL' to omit it entirely (a real ad_hoc deployment with no message).
make_response() {
    local status="${1:-success}"
    local deploy_id="${2:-dep-abc}"
    local sha="${3:-a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9}"
    local msg="${4:-chore: ship it}"
    local msg_field
    if [[ "$msg" == "NULL" ]]; then
        msg_field='null'
    else
        msg_field="$(printf '%s' "$msg" | jq -Rs .)"
    fi
    cat <<JSON_EOF
{
  "result": [
    {
      "id": "${deploy_id}",
      "latest_stage": { "status": "${status}" },
      "deployment_trigger": { "type": "ad_hoc", "metadata": { "commit_hash": "${sha}", "commit_message": ${msg_field} } }
    }
  ],
  "success": true
}
JSON_EOF
}

@test "parses status, deploy_id, commit_sha and commit_msg from a production response" {
    install_fake_curl "$(make_response success dep-1 a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9 'chore: ship it')"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^status=success$' "$GITHUB_OUTPUT"
    grep -q '^deploy_id=dep-1$' "$GITHUB_OUTPUT"
    grep -q '^commit_sha=a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9$' "$GITHUB_OUTPUT"
    grep -q '^commit_msg=chore: ship it$' "$GITHUB_OUTPUT"
}

@test "null commit_message (ad_hoc deploy) yields empty commit_msg, exit 0, no jq error" {
    install_fake_curl "$(make_response success dep-adhoc a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9 NULL)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^commit_msg=$' "$GITHUB_OUTPUT"
    # The naive `... | split("\n")[0]` errors on null and pollutes stderr;
    # the null-safe `// ""` form must not.
    [[ "$output" != *"error"* ]]
    [[ "$output" != *"split"* ]]
}

@test "multi-line commit message is truncated to the first line" {
    install_fake_curl "$(make_response success dep-ml a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9 $'first line\n\nbody paragraph')"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^commit_msg=first line$' "$GITHUB_OUTPUT"
}

@test "queries the production deployments endpoint for CF_PROJECT" {
    install_fake_curl "$(make_response)"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'api.cloudflare.com' "$CURL_CALL_LOG"
    grep -q 'pages/projects/wxyc-dj/deployments' "$CURL_CALL_LOG"
    grep -q 'env=production' "$CURL_CALL_LOG"
}

@test "exits 1 when the Cloudflare API returns a non-200" {
    install_fake_curl "$(make_response)"
    echo 500 >"$CURL_STATUS_FILE"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^status=' "$GITHUB_OUTPUT"
}

@test "exits 2 on missing CF_ACCOUNT_ID" {
    install_fake_curl "$(make_response)"
    unset CF_ACCOUNT_ID
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_ACCOUNT_ID"* ]]
}

@test "exits 2 on missing CF_API_TOKEN" {
    install_fake_curl "$(make_response)"
    unset CF_API_TOKEN
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_API_TOKEN"* ]]
}

@test "exits 2 on missing CF_PROJECT" {
    install_fake_curl "$(make_response)"
    unset CF_PROJECT
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_PROJECT"* ]]
}

@test "does NOT leak CF_API_TOKEN to stdout/stderr" {
    install_fake_curl "$(make_response)"
    export CF_API_TOKEN='cf_secret_token_xxxxxxxxxxxxxxxxxxxx'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    [[ "$output" != *"cf_secret_token"* ]]
}
