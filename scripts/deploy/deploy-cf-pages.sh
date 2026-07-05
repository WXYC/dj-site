#!/usr/bin/env bash
#
# deploy-cf-pages.sh — Direct Upload a Cloudflare Pages deployment via
# `wrangler pages deploy`, returning the deployment's *.pages.dev URL.
#
# Called by .github/workflows/ci.yml's deploy-production (branch=main ->
# production deployment) and preview (branch=<PR head ref> -> preview
# deployment) jobs, after `npm run build:opennext`. Replaces the Cloudflare
# Pages Git-build integration, whose pinned wrangler 3.x miscompiled
# @opennextjs/cloudflare >= 1.19 into a boot 500 (WXYC/dj-site#810).
#
# Auth: wrangler reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from
# the environment; this script passes them through untouched and never
# echoes them.
#
# Env:
#   CF_PROJECT      — required, Pages project name (e.g. wxyc-dj)
#   BRANCH          — required, deployment branch (main = production)
#   COMMIT_HASH     — required, 40-char hex SHA (deploy metadata; the
#                     cloudflare-deploy-status.yml monitor reads it back)
#   COMMIT_MESSAGE  — optional, passed as --commit-message when non-empty
#                     (keeps the monitor's commit_message field populated)
#   ASSETS_DIR      — optional, default .open-next/assets
#
# Outputs (to $GITHUB_OUTPUT if set):
#   deployment_url=<url>
#
# Exit:
#   0 — wrangler succeeded and a *.pages.dev URL was extracted
#   1 — wrangler failed, OR no *.pages.dev URL could be extracted
#   2 — usage error (missing/invalid required input)
#
# Requires: bash 4+, and wrangler on PATH or in ./node_modules/.bin (the
# repo devDependency — present after `npm ci`).

set -uo pipefail

PROJECT="${CF_PROJECT:-}"
BRANCH="${BRANCH:-}"
COMMIT_HASH="${COMMIT_HASH:-}"
COMMIT_MESSAGE="${COMMIT_MESSAGE:-}"
ASSETS_DIR="${ASSETS_DIR:-.open-next/assets}"

if [[ -z "$PROJECT" ]]; then
    echo "deploy-cf-pages: CF_PROJECT is required" >&2
    exit 2
fi
if [[ -z "$BRANCH" ]]; then
    echo "deploy-cf-pages: BRANCH is required" >&2
    exit 2
fi
if [[ -z "$COMMIT_HASH" ]]; then
    echo "deploy-cf-pages: COMMIT_HASH is required" >&2
    exit 2
fi
if ! [[ "$COMMIT_HASH" =~ ^[0-9a-f]{40}$ ]]; then
    echo "deploy-cf-pages: COMMIT_HASH is not a 40-char hex sha: '$COMMIT_HASH'" >&2
    exit 2
fi

# wrangler is a devDependency: npm prepends node_modules/.bin to PATH inside
# npm scripts, but a workflow step invoking this script directly gets no such
# treatment. Fall back to the repo-local binary so the deploy always uses the
# pinned wrangler 4.x (using a Pages-pinned wrangler 3.x is the boot-500 this
# pipeline exists to avoid).
if ! command -v wrangler >/dev/null 2>&1; then
    if [[ -x "node_modules/.bin/wrangler" ]]; then
        PATH="$PWD/node_modules/.bin:$PATH"
    else
        echo "deploy-cf-pages: wrangler not found on PATH or in node_modules/.bin — run npm ci first" >&2
        exit 2
    fi
fi

emit_output() {
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        if ! printf '%s=%s\n' "$1" "$2" >>"$GITHUB_OUTPUT"; then
            echo "deploy-cf-pages: failed to write $1=$2 to \$GITHUB_OUTPUT ($GITHUB_OUTPUT)" >&2
            exit 1
        fi
    fi
}

# Assemble the wrangler args. --commit-message is only added when non-empty
# so an unset message doesn't send an empty flag value.
wrangler_args=(pages deploy "$ASSETS_DIR"
    --project-name "$PROJECT"
    --branch "$BRANCH"
    --commit-hash "$COMMIT_HASH")
if [[ -n "$COMMIT_MESSAGE" ]]; then
    wrangler_args+=(--commit-message "$COMMIT_MESSAGE")
fi

# Capture combined output so we can extract the deployment URL while still
# surfacing wrangler's progress to the workflow log.
output="$(wrangler "${wrangler_args[@]}" 2>&1)"
wrangler_rc=$?
printf '%s\n' "$output"

if (( wrangler_rc != 0 )); then
    echo "deploy-cf-pages: wrangler pages deploy failed (exit ${wrangler_rc})" >&2
    exit 1
fi

# wrangler prints the deployment URL on the "Take a peek over at" line;
# take the last *.pages.dev URL to prefer the deployment URL over any
# branch-alias line printed earlier.
deploy_url="$(grep -oE 'https://[A-Za-z0-9._-]+\.pages\.dev' <<<"$output" | tail -n1)"

if [[ -z "$deploy_url" ]]; then
    echo "deploy-cf-pages: could not extract a *.pages.dev URL from wrangler output" >&2
    exit 1
fi

echo "deploy-cf-pages: deployed ${COMMIT_HASH} to ${deploy_url} (branch ${BRANCH})"
emit_output deployment_url "$deploy_url"
