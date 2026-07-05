#!/usr/bin/env bats
#
# BATS tests for scripts/deploy/check-build-env.sh.
#
# check-build-env.sh guards a CI build against the "invisible parity failure"
# constraint (WXYC/dj-site#810): NEXT_PUBLIC_* values are inlined at build
# time, and ci.yml sets localhost placeholders at the workflow level. A
# production/preview build that inlines those localhost URLs still serves `/`
# fine (so the smoke gate can't catch it) but breaks every client API call.
# The guard is passed the names of the build vars that have no safe in-code
# default and hard-fails if any is empty OR points at localhost.
#
# Usage: check-build-env.sh VAR_NAME [VAR_NAME ...]
#
# Exit:
#   0 — every named var is non-empty and not a localhost URL
#   1 — one or more named vars are empty/unset or localhost (all listed)
#   2 — usage error (no var names given)

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../deploy" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/check-build-env.sh"

setup() {
    export NEXT_PUBLIC_BACKEND_URL='https://api.wxyc.org'
    export NEXT_PUBLIC_BETTER_AUTH_URL='https://api.wxyc.org/auth'
}

@test "exits 0 when all named vars are present and non-localhost" {
    run "$SCRIPT_PATH" NEXT_PUBLIC_BACKEND_URL NEXT_PUBLIC_BETTER_AUTH_URL
    [ "$status" -eq 0 ]
}

@test "exits 1 and names an empty/unset var" {
    unset NEXT_PUBLIC_BETTER_AUTH_URL
    run "$SCRIPT_PATH" NEXT_PUBLIC_BACKEND_URL NEXT_PUBLIC_BETTER_AUTH_URL
    [ "$status" -eq 1 ]
    [[ "$output" == *"NEXT_PUBLIC_BETTER_AUTH_URL"* ]]
    [[ "$output" != *"NEXT_PUBLIC_BACKEND_URL is"* ]]
}

@test "exits 1 and names an empty-string var" {
    export NEXT_PUBLIC_BACKEND_URL=''
    run "$SCRIPT_PATH" NEXT_PUBLIC_BACKEND_URL
    [ "$status" -eq 1 ]
    [[ "$output" == *"NEXT_PUBLIC_BACKEND_URL"* ]]
}

@test "exits 1 on a localhost URL (workflow placeholder leaked in)" {
    export NEXT_PUBLIC_BACKEND_URL='http://localhost:8080'
    run "$SCRIPT_PATH" NEXT_PUBLIC_BACKEND_URL
    [ "$status" -eq 1 ]
    [[ "$output" == *"NEXT_PUBLIC_BACKEND_URL"* ]]
    [[ "$output" == *"localhost"* ]]
}

@test "exits 1 on a 127.0.0.1 URL" {
    export NEXT_PUBLIC_BETTER_AUTH_URL='http://127.0.0.1:8082/auth'
    run "$SCRIPT_PATH" NEXT_PUBLIC_BETTER_AUTH_URL
    [ "$status" -eq 1 ]
    [[ "$output" == *"NEXT_PUBLIC_BETTER_AUTH_URL"* ]]
}

@test "lists all offending vars, not just the first" {
    unset NEXT_PUBLIC_BACKEND_URL
    export NEXT_PUBLIC_BETTER_AUTH_URL='http://localhost:8082/auth'
    run "$SCRIPT_PATH" NEXT_PUBLIC_BACKEND_URL NEXT_PUBLIC_BETTER_AUTH_URL
    [ "$status" -eq 1 ]
    [[ "$output" == *"NEXT_PUBLIC_BACKEND_URL"* ]]
    [[ "$output" == *"NEXT_PUBLIC_BETTER_AUTH_URL"* ]]
}

@test "exits 2 when no var names are given" {
    run "$SCRIPT_PATH"
    [ "$status" -eq 2 ]
}
