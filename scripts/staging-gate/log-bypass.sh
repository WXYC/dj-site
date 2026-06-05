#!/usr/bin/env bash
#
# log-bypass.sh — append an audit comment to the gate-bypasses tracker
# issue for the dj-site staging gate.
#
# Source-of-truth: WXYC/wxyc-shared scripts/bs-lml-gate/log-bypass.sh.
# Adapted for dj-site's single-SHA promotion (vs the BS+LML dual-SHA
# coordinator). Keep the shared invariants (whitespace defense,
# fence-escape defense, -F vs -f, no-heredoc) in sync.
#
# Invariant: the workflow MUST NOT advance prod via the bypass path if
# this script fails. The audit append is the only record of a manual
# promotion, so failing-open here would be a silent bypass.
#
# Env (all required unless noted):
#   BYPASS_REPO           — e.g. WXYC/dj-site
#   BYPASS_ISSUE_NUMBER   — integer
#   BYPASS_ACTOR          — github.actor
#   BYPASS_JUSTIFICATION  — non-empty
#   BYPASS_DJ_SITE_SHA    — dj-site main SHA being promoted
#   BYPASS_RUN_URL        — link to the GHA run
#   BYPASS_WHEN           — optional ISO timestamp; defaults to now (UTC)
#
# Exit:
#   0 — comment posted
#   1 — gh api failed
#   2 — usage error

set -uo pipefail

WHEN="${BYPASS_WHEN:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

# Loop iterates over the ACTUAL env-var names so error messages match
# what an operator needs to set — not the local script aliases.
for var in BYPASS_REPO BYPASS_ISSUE_NUMBER BYPASS_ACTOR \
           BYPASS_JUSTIFICATION BYPASS_DJ_SITE_SHA BYPASS_RUN_URL; do
    if [[ -z "${!var:-}" ]]; then
        echo "log-bypass: ${var} is required (no silent bypasses)" >&2
        exit 2
    fi
done

# Whitespace-only justification is a silent-bypass-by-content. `-z`
# above catches truly empty strings; this catches space/tab/newline-only
# payloads that would pass the length check but contribute no content.
if [[ -z "${BYPASS_JUSTIFICATION//[[:space:]]/}" ]]; then
    echo "log-bypass: BYPASS_JUSTIFICATION is whitespace-only (no silent bypasses)" >&2
    exit 2
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# Justification is user input; render it inside a fenced code block so
# markdown (@-mentions, links, headings) is neutralized in the audit
# comment. The fence label is empty so the block doesn't get a language
# tag. Anyone reading the source can still see the text verbatim, but
# they can't be social-engineered by a fake "Approved by" link.
#
# Defense against fence-escape: if the justification itself contains
# ``` we fall back to ~~~ (CommonMark allows either, and code fences
# must match the opening sequence). Belt-and-suspenders: we also strip
# any embedded fence sequence that matches the chosen delimiter.
if [[ "$BYPASS_JUSTIFICATION" == *'```'* ]]; then
    fence='~~~'
    sanitized="${BYPASS_JUSTIFICATION//\~\~\~/\~\~ \~}"
else
    fence='```'
    sanitized="${BYPASS_JUSTIFICATION//\`\`\`/\`\` \`}"
fi

# Build the body via printf (not heredoc) so a justification line of
# exactly `EOF` can't terminate the heredoc early and corrupt the
# audit comment. printf doesn't have a delimiter to inject.
printf '%s\n' \
    "## dj-site gate bypass — ${WHEN}" \
    "" \
    "- **Actor:** @${BYPASS_ACTOR}" \
    "- **Run:** ${BYPASS_RUN_URL}" \
    "- **dj-site SHA promoted:** \`${BYPASS_DJ_SITE_SHA}\`" \
    "" \
    "**Justification**" \
    "" \
    "${fence}" \
    "${sanitized}" \
    "${fence}" \
    >"$body_file"

# NB: `-F` (--field) is required here, NOT `-f` (--raw-field). Per
# `gh api --help`: only `-F` supports the `@<path>` syntax to read
# the value from a file. `-f body=@path` posts the literal seven-char
# string `@<path>` — destroying the audit trail without erroring.
if ! gh api -X POST "repos/${BYPASS_REPO}/issues/${BYPASS_ISSUE_NUMBER}/comments" \
    -F "body=@${body_file}" --silent; then
    echo "log-bypass: failed to append comment to ${BYPASS_REPO}#${BYPASS_ISSUE_NUMBER}" >&2
    exit 1
fi

echo "log-bypass: appended bypass audit to ${BYPASS_REPO}#${BYPASS_ISSUE_NUMBER}"
exit 0
