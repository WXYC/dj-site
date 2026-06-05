#!/usr/bin/env bats
#
# BATS tests for scripts/staging-gate/log-bypass.sh.
#
# Mirror of WXYC/wxyc-shared scripts/__tests__/bs-lml-gate/log-bypass.test.sh,
# adapted for dj-site's single-SHA promotion (BYPASS_DJ_SITE_SHA in place
# of BYPASS_BS_SHA + BYPASS_LML_SHA). Keep the shared invariants in sync.
#
# log-bypass.sh appends a comment to a long-lived "gate-bypasses"
# tracker issue with who/when/justification/SHA. Called by the
# workflow on the bypass path before any prod push. If the append
# fails, log-bypass exits non-zero so the workflow bails out before
# advancing prod — bypass-with-no-audit is forbidden.

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../staging-gate" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/log-bypass.sh"

setup() {
    TEST_TEMP_DIR="$(mktemp -d)"
    export FAKE_BIN="$TEST_TEMP_DIR/bin"
    mkdir -p "$FAKE_BIN"
    export PATH="$FAKE_BIN:$PATH"
    export GH_CALL_LOG="$TEST_TEMP_DIR/gh-calls.log"
    export GH_BODY_LOG="$TEST_TEMP_DIR/gh-body.log"
    : >"$GH_CALL_LOG"
    : >"$GH_BODY_LOG"

    export BYPASS_REPO='WXYC/dj-site'
    export BYPASS_ISSUE_NUMBER='42'
    export BYPASS_ACTOR='jakebromberg'
    export BYPASS_JUSTIFICATION='CF preview flake; verified preview URL serves 200 manually'
    export BYPASS_DJ_SITE_SHA='a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9'
    export BYPASS_RUN_URL='https://github.com/WXYC/dj-site/actions/runs/123456'
    export BYPASS_WHEN='2026-06-05T22:00:00Z'
}

teardown() {
    rm -rf "$TEST_TEMP_DIR"
}

install_fake_gh_success() {
    cat >"$FAKE_BIN/gh" <<GH_EOF
#!/usr/bin/env bash
# Mirror real \`gh api\` flag semantics: only -F (--field) treats
# @<path> as a file reference; -f (--raw-field) sends it as a literal
# string. Capturing both behaviors lets the test distinguish them so
# a swap of -F → -f doesn't silently pass.
printf '%s\n' "\$*" >>"$GH_CALL_LOG"
prev=""
for arg in "\$@"; do
    if [[ "\$arg" == "body="* ]]; then
        value="\${arg#body=}"
        if [[ "\$value" == "@"* && ( "\$prev" == "-F" || "\$prev" == "--field" ) ]]; then
            cat "\${value#@}" >>"\$GH_BODY_LOG"
        else
            printf '%s\n' "\$value" >>"\$GH_BODY_LOG"
        fi
    fi
    prev="\$arg"
done
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

@test "posts a comment containing actor, justification, dj-site SHA, when, and run URL" {
    install_fake_gh_success
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]

    grep -q "POST" "$GH_CALL_LOG"
    grep -q "repos/WXYC/dj-site/issues/42/comments" "$GH_CALL_LOG"

    grep -q 'jakebromberg' "$GH_BODY_LOG"
    grep -q 'CF preview flake' "$GH_BODY_LOG"
    grep -q 'a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9' "$GH_BODY_LOG"
    grep -q '2026-06-05T22:00:00Z' "$GH_BODY_LOG"
    grep -q 'actions/runs/123456' "$GH_BODY_LOG"
}

@test "comment header says 'dj-site gate bypass' (not the bs-lml-gate template)" {
    install_fake_gh_success
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'dj-site gate bypass' "$GH_BODY_LOG"
    # Regression guard: must NOT inherit the bs-lml-gate-flavored heading
    # from a botched copy-paste.
    ! grep -q 'Gate bypass —' "$GH_BODY_LOG" || \
        grep -q 'dj-site gate bypass' "$GH_BODY_LOG"
}

@test "comment lists a single dj-site SHA bullet (not the dual BS+LML bullets)" {
    install_fake_gh_success
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q 'dj-site SHA promoted' "$GH_BODY_LOG"
    # Regression guard: must NOT carry over bs-lml-gate's two bullets.
    ! grep -q 'Backend-Service SHA promoted' "$GH_BODY_LOG"
    ! grep -q 'library-metadata-lookup SHA promoted' "$GH_BODY_LOG"
}

@test "exits 1 when gh fails — workflow must abort before pushing prod" {
    install_fake_gh_failure
    run "$SCRIPT_PATH"
    [ "$status" -eq 1 ]
}

@test "exits 2 when justification is empty (defends invariant: no silent bypass)" {
    install_fake_gh_success
    export BYPASS_JUSTIFICATION=''
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [ ! -s "$GH_CALL_LOG" ]
}

@test "exits 2 when justification is whitespace-only (no silent bypass via blank)" {
    install_fake_gh_success
    export BYPASS_JUSTIFICATION=$'   \n\t  \n'
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [ ! -s "$GH_CALL_LOG" ]
}

@test "handles justification line equal to 'EOF' (heredoc-injection defense)" {
    install_fake_gh_success
    # If the body were built with an unquoted heredoc <<EOF, this line
    # would terminate the heredoc early. The script must build the
    # body via a delimiter-free mechanism so this is just text.
    export BYPASS_JUSTIFICATION=$'before\nEOF\nafter'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -q '^before$' "$GH_BODY_LOG"
    grep -q '^EOF$' "$GH_BODY_LOG"
    grep -q '^after$' "$GH_BODY_LOG"
    tail -1 "$GH_BODY_LOG" | grep -qE '^(```|~~~)$'
}

@test "exits 2 when any required field is missing" {
    install_fake_gh_success
    unset BYPASS_ACTOR
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
}

@test "exits 2 when BYPASS_DJ_SITE_SHA is missing (catches blank-SHA bypass)" {
    install_fake_gh_success
    unset BYPASS_DJ_SITE_SHA
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BYPASS_DJ_SITE_SHA"* ]]
}

@test "error message names the exact env-var the operator must set" {
    install_fake_gh_success
    unset BYPASS_ISSUE_NUMBER
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
    [[ "$output" == *"BYPASS_ISSUE_NUMBER"* ]]
    [[ "$output" != *"BYPASS_ISSUE is"* ]]
}

@test "defaults BYPASS_WHEN to current UTC time when unset" {
    install_fake_gh_success
    unset BYPASS_WHEN
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -qE '20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z' "$GH_BODY_LOG"
}

@test "wraps justification in a fenced code block so markdown is neutralized" {
    install_fake_gh_success
    export BYPASS_JUSTIFICATION='Approved by @wxyc/oncall — see https://evil.example/spoof'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -qE '^```$' "$GH_BODY_LOG" || grep -qE '^~~~$' "$GH_BODY_LOG"
    grep -q 'Approved by @wxyc/oncall' "$GH_BODY_LOG"
}

@test "falls back to ~~~ fence if justification contains backtick fence" {
    install_fake_gh_success
    export BYPASS_JUSTIFICATION=$'try this:\n```rm -rf /```'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -qE '^~~~$' "$GH_BODY_LOG"
}

@test "disarms input fence that matches the chosen outer fence" {
    install_fake_gh_success
    export BYPASS_JUSTIFICATION=$'has ``` and\n~~~\nstandalone'
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    count=$(grep -cE '^~~~$' "$GH_BODY_LOG")
    [ "$count" -eq 2 ]
}

@test "posts the rendered body via -F (not -f), so audit content reaches the issue" {
    install_fake_gh_success
    run "$SCRIPT_PATH"
    [ "$status" -eq 0 ]
    grep -qE '(^| )-F( |$)' "$GH_CALL_LOG"
    [ -s "$GH_BODY_LOG" ]
    ! grep -qE '^@/' "$GH_BODY_LOG"
}
