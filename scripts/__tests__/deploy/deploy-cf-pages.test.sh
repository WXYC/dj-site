#!/usr/bin/env bats
#
# BATS tests for scripts/deploy/deploy-cf-pages.sh.
#
# deploy-cf-pages.sh wraps `wrangler pages deploy` for GitHub Actions
# Direct Upload: it validates the deploy inputs, invokes wrangler with the
# project/branch/commit metadata flags, extracts the deployment's *.pages.dev
# URL from wrangler's output, and emits it to $GITHUB_OUTPUT. Modeled on the
# fake-binary-on-PATH harness in
# scripts/__tests__/staging-gate/wait-for-cf-preview.test.sh.
#
# Env:
#   CF_PROJECT      — required, Pages project name (e.g. wxyc-dj)
#   BRANCH          — required, deployment branch (main = production)
#   COMMIT_HASH     — required, 40-char hex SHA
#   COMMIT_MESSAGE  — optional, passed as --commit-message when non-empty
#   ASSETS_DIR      — optional, default .open-next/assets
#   CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID — read by wrangler for auth
#
# Outputs (to $GITHUB_OUTPUT if set):
#   deployment_url=<url>
#
# Exit:
#   0 — wrangler succeeded and a *.pages.dev URL was extracted
#   1 — wrangler failed, OR no URL could be extracted
#   2 — usage error

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../deploy" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/deploy-cf-pages.sh"

COMMIT_HASH_FIXTURE='a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9'

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export FAKE_BIN="$TEST_TEMP_DIR/bin"
    mkdir -p "$FAKE_BIN"
    export PATH="$FAKE_BIN:$PATH"
    export WRANGLER_CALL_LOG="$TEST_TEMP_DIR/wrangler-calls.log"
    : >"$WRANGLER_CALL_LOG"
    export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"
    : >"$GITHUB_OUTPUT"

    export CF_PROJECT='wxyc-dj'
    export BRANCH='main'
    export COMMIT_HASH="$COMMIT_HASH_FIXTURE"
    export COMMIT_MESSAGE='chore: a commit'
    export CLOUDFLARE_API_TOKEN='cf_fake_token'
    export CLOUDFLARE_ACCOUNT_ID='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

# Install a fake wrangler that logs its argv (one line, space-joined) and
# prints a realistic "Deployment complete!" banner with a *.pages.dev URL,
# then exits with WRANGLER_EXIT (default 0).
install_fake_wrangler() {
    local url="${1:-https://abc123.wxyc-dj.pages.dev}"
    local exit_code="${2:-0}"
    cat >"$FAKE_BIN/wrangler" <<WRANGLER_EOF
#!/usr/bin/env bash
{ printf '%s\n' "\$*"; } >>"$WRANGLER_CALL_LOG"
cat <<'BANNER'
🌍  Uploading... (12/12)
✨ Success! Uploaded 0 files (12 already uploaded) (0.40 sec)
🌎  Deploying...
✨ Deployment complete! Take a peek over at ${url}
BANNER
exit ${exit_code}
WRANGLER_EOF
    chmod +x "$FAKE_BIN/wrangler"
}

@test "emits deployment_url from wrangler output on success" {
    install_fake_wrangler https://abc123.wxyc-dj.pages.dev 0
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^deployment_url=https://abc123.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
}

@test "exits 2 on missing CF_PROJECT" {
    install_fake_wrangler
    unset CF_PROJECT
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"CF_PROJECT"* ]]
    ! grep -q '^deployment_url=' "$GITHUB_OUTPUT"
}

@test "exits 2 on missing BRANCH" {
    install_fake_wrangler
    unset BRANCH
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BRANCH"* ]]
}

@test "exits 2 on missing COMMIT_HASH" {
    install_fake_wrangler
    unset COMMIT_HASH
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"COMMIT_HASH"* ]]
}

@test "exits 2 on COMMIT_HASH that is not 40-char hex" {
    install_fake_wrangler
    export COMMIT_HASH='not-a-sha'
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
}

@test "passes project, branch, commit-hash and commit-message to wrangler" {
    install_fake_wrangler
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'pages deploy' "$WRANGLER_CALL_LOG"
    grep -q -- '--project-name wxyc-dj' "$WRANGLER_CALL_LOG"
    grep -q -- '--branch main' "$WRANGLER_CALL_LOG"
    grep -q -- "--commit-hash $COMMIT_HASH_FIXTURE" "$WRANGLER_CALL_LOG"
    grep -q -- '--commit-message' "$WRANGLER_CALL_LOG"
}

@test "omits --commit-message when COMMIT_MESSAGE is empty" {
    install_fake_wrangler
    export COMMIT_MESSAGE=''
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    ! grep -q -- '--commit-message' "$WRANGLER_CALL_LOG"
}

@test "defaults assets dir to .open-next/assets and honors ASSETS_DIR override" {
    install_fake_wrangler
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'pages deploy .open-next/assets' "$WRANGLER_CALL_LOG"

    : >"$WRANGLER_CALL_LOG"
    export ASSETS_DIR='dist/custom'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'pages deploy dist/custom' "$WRANGLER_CALL_LOG"
}

@test "exits 1 when wrangler fails" {
    install_fake_wrangler https://x.pages.dev 1
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^deployment_url=' "$GITHUB_OUTPUT"
}

@test "exits 1 when wrangler output has no pages.dev URL" {
    cat >"$FAKE_BIN/wrangler" <<WRANGLER_EOF
#!/usr/bin/env bash
{ printf '%s\n' "\$*"; } >>"$WRANGLER_CALL_LOG"
echo "some output without a deployment url"
exit 0
WRANGLER_EOF
    chmod +x "$FAKE_BIN/wrangler"
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    ! grep -q '^deployment_url=' "$GITHUB_OUTPUT"
}

@test "picks the deployment URL (last pages.dev URL) over an earlier alias line" {
    cat >"$FAKE_BIN/wrangler" <<WRANGLER_EOF
#!/usr/bin/env bash
{ printf '%s\n' "\$*"; } >>"$WRANGLER_CALL_LOG"
cat <<'BANNER'
🌎  Deploying to branch alias https://main.wxyc-dj.pages.dev
✨ Deployment complete! Take a peek over at https://deadbeef.wxyc-dj.pages.dev
BANNER
exit 0
WRANGLER_EOF
    chmod +x "$FAKE_BIN/wrangler"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^deployment_url=https://deadbeef.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
}

@test "falls back to node_modules/.bin/wrangler when wrangler is not on PATH" {
    # No fake wrangler in FAKE_BIN; instead plant one where npm ci would put
    # it, relative to the working directory. Sandbox PATH to core system dirs
    # so neither the FAKE_BIN stub nor any globally installed wrangler can
    # satisfy the lookup — this is the GitHub Actions case, where a workflow
    # step invokes the script directly and node_modules/.bin is not on PATH
    # (npm only prepends it inside npm scripts).
    local project_dir="$TEST_TEMP_DIR/project"
    mkdir -p "$project_dir/node_modules/.bin"
    cat >"$project_dir/node_modules/.bin/wrangler" <<WRANGLER_EOF
#!/usr/bin/env bash
{ printf '%s\n' "\$*"; } >>"$WRANGLER_CALL_LOG"
echo "✨ Deployment complete! Take a peek over at https://local123.wxyc-dj.pages.dev"
exit 0
WRANGLER_EOF
    chmod +x "$project_dir/node_modules/.bin/wrangler"

    cd "$project_dir"
    PATH="/usr/bin:/bin" run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'pages deploy' "$WRANGLER_CALL_LOG"
    grep -q '^deployment_url=https://local123.wxyc-dj.pages.dev$' "$GITHUB_OUTPUT"
}

@test "exits 2 with a clear error when wrangler is neither on PATH nor in node_modules/.bin" {
    local project_dir="$TEST_TEMP_DIR/empty-project"
    mkdir -p "$project_dir"
    cd "$project_dir"
    PATH="/usr/bin:/bin" run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"node_modules/.bin"* ]]
    ! grep -q '^deployment_url=' "$GITHUB_OUTPUT"
}

@test "does NOT leak CLOUDFLARE_API_TOKEN to stdout/stderr" {
    install_fake_wrangler
    export CLOUDFLARE_API_TOKEN='cf_secret_token_xxxxxxxxxxxxxxxxxxxx'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    [[ "$output" != *"cf_secret_token"* ]]
}
