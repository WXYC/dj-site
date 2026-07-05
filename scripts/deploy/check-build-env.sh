#!/usr/bin/env bash
#
# check-build-env.sh — assert that the named NEXT_PUBLIC_* build variables
# are present and not localhost, before a CI build inlines them.
#
# Called by .github/workflows/ci.yml's deploy-production / preview jobs.
# Guards the "invisible parity failure" from WXYC/dj-site#810: NEXT_PUBLIC_*
# values are inlined at build time, and the workflow-level env block sets
# localhost placeholders (for the test jobs). A deploy build that inlines
# those still serves `/` (so the smoke gate can't see it) but breaks every
# client API call. Only the vars with no safe in-code default are passed in.
#
# Usage: check-build-env.sh VAR_NAME [VAR_NAME ...]
#
# Exit:
#   0 — every named var is non-empty and not a localhost URL
#   1 — one or more named vars are empty/unset or localhost (all listed)
#   2 — usage error (no var names given)
#
# Requires: bash 4+.

set -uo pipefail

if (( $# == 0 )); then
    echo "check-build-env: at least one variable name is required" >&2
    echo "usage: check-build-env.sh VAR_NAME [VAR_NAME ...]" >&2
    exit 2
fi

problems=()

for name in "$@"; do
    value="${!name:-}"
    if [[ -z "$value" ]]; then
        problems+=("${name} is empty/unset")
    elif [[ "$value" == *localhost* || "$value" == *127.0.0.1* ]]; then
        problems+=("${name} points at localhost ('${value}') — the workflow-level placeholder leaked in")
    fi
done

if (( ${#problems[@]} > 0 )); then
    echo "check-build-env: required build vars are not set for a real deploy:" >&2
    for p in "${problems[@]}"; do
        echo "  - ${p}" >&2
    done
    exit 1
fi

echo "check-build-env: ${#} build var(s) present and non-localhost"
