#!/usr/bin/env bats
#
# BATS tests for scripts/staging-gate/push-prod.sh.
#
# Mirror of WXYC/wxyc-shared scripts/__tests__/bs-lml-gate/push-prod.test.sh.
# Both copies share the same fake-gh fixture + assertion set; keep them
# in sync when fixing bugs. The dj-site copy uses WXYC/dj-site instead
# of WXYC/Backend-Service as the example repo.
#
# push-prod.sh advances a single repo's `prod` branch to a target SHA
# via the GitHub API (no local clone — the gate runs on a self-hosted
# runner that we don't want to pollute with per-repo clones).
#
# Env:
#   PUSH_REPO       — required, e.g. WXYC/Backend-Service
#   PUSH_TARGET_SHA — required, 40-char hex
#   PUSH_CURRENT_SHA— required, "" means seed (create branch)
#   PUSH_PAT        — required, fine-grained PAT for the target repo's `prod` ref
#   PUSH_DRY_RUN    — optional, "1" prints the gh call(s) instead of running them
#
# Exit:
#   0 — push succeeded OR no-op (target == current)
#   1 — push failed
#   2 — usage error

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../staging-gate" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/push-prod.sh"

EXPECTED='a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9'

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export FAKE_BIN="$TEST_TEMP_DIR/bin"
    mkdir -p "$FAKE_BIN"
    export PATH="$FAKE_BIN:$PATH"
    export GH_CALL_LOG="$TEST_TEMP_DIR/gh-calls.log"
    : >"$GH_CALL_LOG"
    export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"
    : >"$GITHUB_OUTPUT"
    # Common required env
    export PUSH_REPO='WXYC/dj-site'
    export PUSH_TARGET_SHA="$EXPECTED"
    export PUSH_CURRENT_SHA=""
    export PUSH_PAT='ghp_fake'
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

install_fake_gh_success() {
    cat >"$FAKE_BIN/gh" <<GH_EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >>"$GH_CALL_LOG"
exit 0
GH_EOF
    chmod +x "$FAKE_BIN/gh"
}

install_fake_gh_failure() {
    cat >"$FAKE_BIN/gh" <<GH_EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >>"$GH_CALL_LOG"
echo "fake gh: simulated failure" >&2
exit 1
GH_EOF
    chmod +x "$FAKE_BIN/gh"
}

@test "no-op when PUSH_TARGET_SHA == PUSH_CURRENT_SHA (skips gh entirely, did_push=false)" {
    install_fake_gh_failure   # would fail if it were called
    export PUSH_CURRENT_SHA="$EXPECTED"
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    [[ "$output" == *"no-op"* || "$output" == *"already"* ]]
    [ ! -s "$GH_CALL_LOG" ]
    grep -q '^did_push=false$' "$GITHUB_OUTPUT"
}

@test "fast-forward updates an existing prod ref via PATCH (did_push=true)" {
    install_fake_gh_success
    export PUSH_CURRENT_SHA='1111111111111111111111111111111111111111'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'PATCH' "$GH_CALL_LOG"
    grep -q "refs/heads/prod" "$GH_CALL_LOG"
    grep -q "$EXPECTED" "$GH_CALL_LOG"
    grep -q '^did_push=true$' "$GITHUB_OUTPUT"
}

@test "seed (PUSH_CURRENT_SHA empty) POSTs a new ref (did_push=true)" {
    install_fake_gh_success
    export PUSH_CURRENT_SHA=""
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'POST' "$GH_CALL_LOG"
    grep -q "refs/heads/prod" "$GH_CALL_LOG"
    grep -q "$EXPECTED" "$GH_CALL_LOG"
    grep -q '^did_push=true$' "$GITHUB_OUTPUT"
}

@test "exits 1 if gh fails (and does NOT claim did_push=true)" {
    install_fake_gh_failure
    export PUSH_CURRENT_SHA='1111111111111111111111111111111111111111'
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
    # On gh failure, we don't know if the ref moved; the summary
    # logic depends on did_push staying unset rather than 'true'.
    ! grep -q '^did_push=true$' "$GITHUB_OUTPUT"
}

@test "dry-run does not invoke gh" {
    install_fake_gh_failure   # would fail if invoked
    export PUSH_CURRENT_SHA='1111111111111111111111111111111111111111'
    export PUSH_DRY_RUN='1'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    [ ! -s "$GH_CALL_LOG" ]
    [[ "$output" == *"$EXPECTED"* ]]
    [[ "$output" == *"$PUSH_REPO"* ]]
}

@test "exits 2 if required env is missing" {
    unset PUSH_TARGET_SHA
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
}

@test "rejects PUSH_TARGET_SHA that is not 40-char hex" {
    install_fake_gh_failure
    export PUSH_TARGET_SHA='not-a-sha'
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [ ! -s "$GH_CALL_LOG" ]
}

@test "exits non-zero if \$GITHUB_OUTPUT write fails (no silent did_push loss)" {
    install_fake_gh_success
    export PUSH_CURRENT_SHA='1111111111111111111111111111111111111111'
    # Point GITHUB_OUTPUT at a directory (not a file) so the append
    # fails predictably without needing root or fs manipulation.
    export GITHUB_OUTPUT="$TEST_TEMP_DIR"
    run "$SCRIPT_PATH"
    [ "$status" -ne 0 ]
    [[ "$output" == *"GITHUB_OUTPUT"* ]]
}

@test "does not leak PAT to stdout/stderr or the call log" {
    install_fake_gh_success
    export PUSH_CURRENT_SHA='1111111111111111111111111111111111111111'
    export PUSH_PAT='ghp_secretsecretsecretsecretsecret'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    [[ "$output" != *"ghp_secret"* ]]
    ! grep -q 'ghp_secret' "$GH_CALL_LOG"
}
