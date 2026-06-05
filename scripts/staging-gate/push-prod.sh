#!/usr/bin/env bash
#
# push-prod.sh — advance a repo's `prod` branch to a target SHA.
#
# Source-of-truth: WXYC/wxyc-shared scripts/bs-lml-gate/push-prod.sh.
# Copied verbatim into dj-site so the dj-site gate doesn't depend on
# wxyc-shared's deploy path. Keep these in sync when fixing bugs.
#
# Uses the GitHub API (refs PATCH / POST) rather than a local clone so
# the self-hosted runner stays clean. Authentication is via a
# fine-grained PAT scoped to `Contents: write` on the `prod` ref of
# the target repo only.
#
# Env:
#   PUSH_REPO        — required, e.g. WXYC/Backend-Service
#   PUSH_TARGET_SHA  — required, 40-char hex
#   PUSH_CURRENT_SHA — required, "" means seed (no prod branch yet)
#   PUSH_PAT         — required, fine-grained PAT
#   PUSH_DRY_RUN     — optional, "1" prints the planned API call
#
# Outputs (to $GITHUB_OUTPUT if set):
#   did_push=true    — a PATCH/POST landed against the GitHub API
#   did_push=false   — short-circuited at target==current (no API call)
#
# Exit:
#   0 — push succeeded OR no-op (target == current)
#   1 — push failed
#   2 — usage error
#
# Requires: gh.

set -uo pipefail

REPO="${PUSH_REPO:-}"
TARGET="${PUSH_TARGET_SHA:-}"
CURRENT="${PUSH_CURRENT_SHA-__UNSET__}"
PAT="${PUSH_PAT:-}"
DRY_RUN="${PUSH_DRY_RUN:-0}"

if [[ -z "$REPO" || -z "$TARGET" || "$CURRENT" == "__UNSET__" || -z "$PAT" ]]; then
    echo "push-prod: PUSH_REPO, PUSH_TARGET_SHA, PUSH_CURRENT_SHA, PUSH_PAT are required" >&2
    exit 2
fi

if ! [[ "$TARGET" =~ ^[0-9a-f]{40}$ ]]; then
    echo "push-prod: PUSH_TARGET_SHA is not a 40-char hex sha: '$TARGET'" >&2
    exit 2
fi

if [[ -n "$CURRENT" ]] && ! [[ "$CURRENT" =~ ^[0-9a-f]{40}$ ]]; then
    echo "push-prod: PUSH_CURRENT_SHA is not a 40-char hex sha: '$CURRENT'" >&2
    exit 2
fi

emit_output() {
    # Write key=value to $GITHUB_OUTPUT when in GHA; no-op locally.
    # Fail loud on write error — the workflow's split-promotion detector
    # tests `did_push == "true"` exactly, so a silent emit-failure after
    # a real push would mask the actual state and could even trigger a
    # spurious inverted-split warning.
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        if ! printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; then
            echo "push-prod: failed to write $1=$2 to \$GITHUB_OUTPUT ($GITHUB_OUTPUT)" >&2
            exit 1
        fi
    fi
}

if [[ "$TARGET" == "$CURRENT" ]]; then
    echo "push-prod: $REPO prod already at $TARGET (no-op)"
    emit_output did_push false
    exit 0
fi

# Decide PATCH vs POST. Seed (no prod yet) = POST /git/refs with ref=refs/heads/prod.
# Fast-forward = PATCH /git/refs/heads/prod with sha=TARGET.
if [[ -z "$CURRENT" ]]; then
    method="POST"
    path="repos/${REPO}/git/refs"
    fields=( -f "ref=refs/heads/prod" -f "sha=${TARGET}" )
else
    method="PATCH"
    path="repos/${REPO}/git/refs/heads/prod"
    fields=( -f "sha=${TARGET}" )
fi

if [[ "$DRY_RUN" == "1" ]]; then
    echo "push-prod: DRY_RUN $method $path sha=$TARGET (repo=$REPO from=${CURRENT:-<seed>})"
    emit_output did_push false
    exit 0
fi

# Pass the PAT via env to gh so it never appears on argv (would otherwise
# show in `ps`). `gh` reads $GH_TOKEN before $GITHUB_TOKEN.
if ! GH_TOKEN="$PAT" gh api -X "$method" "$path" "${fields[@]}" --silent; then
    echo "push-prod: $method $path failed" >&2
    # Even on failure, the request reached the API — but we don't
    # know whether the ref moved. Don't claim did_push=true; leave
    # the output unset so the workflow falls back to step outcome.
    exit 1
fi

echo "push-prod: $REPO prod -> $TARGET (${method})"
emit_output did_push true
exit 0
