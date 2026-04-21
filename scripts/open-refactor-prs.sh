#!/usr/bin/env bash
set -euo pipefail

# Opens GitHub issues and PRs for each refactoring branch.
# Each PR closes its corresponding issue automatically.
#
# Usage:
#   ./scripts/open-refactor-prs.sh          # dry-run (prints commands)
#   ./scripts/open-refactor-prs.sh --run    # actually create issues & PRs

DRY_RUN=true
if [[ "${1:-}" == "--run" ]]; then
  DRY_RUN=false
fi

REPO="WXYC/dj-site"

# ── Branch definitions ───────────────────────────────────────────────
# Format: branch|PR title|issue title|body
declare -a BRANCHES=(
  "refactor/password-validators"
  "refactor/bin-action-menu-item"
  "refactor/use-bin-mutation"
  "refactor/fetch-json-or-null"
  "refactor/filter-by-search-terms"
  "refactor/throw-if-better-auth-error"
  "refactor/use-async-action"
)

declare -A TITLES=(
  ["refactor/password-validators"]="Extract shared password validation utility"
  ["refactor/bin-action-menu-item"]="Extract shared BinActionMenuItem component"
  ["refactor/use-bin-mutation"]="Extract useBinMutation factory in binHooks"
  ["refactor/fetch-json-or-null"]="Extract fetchJsonOrNull utility for artwork fetchers"
  ["refactor/filter-by-search-terms"]="Extract filterBySearchTerms utility"
  ["refactor/throw-if-better-auth-error"]="Extract throwIfBetterAuthError utility"
  ["refactor/use-async-action"]="Extract useAsyncAction hook for async handler boilerplate"
)

declare -A BODIES=(
  ["refactor/password-validators"]="## Summary

- The same password strength check (\`value.length >= 8 && /[A-Z]/ && /[0-9]/\`) was duplicated inline across NewUserForm, OnboardingForm, and ResetPasswordForm.
- Extract it into a reusable \`isStrongPassword\` function in \`src/utilities/passwordValidation.ts\`.
- All three forms now import and call the shared validator.

## Files changed

| File | Change |
|------|--------|
| \`src/utilities/passwordValidation.ts\` | New: \`isStrongPassword\` function |
| \`src/components/.../NewUserForm.tsx\` | Use shared validator |
| \`src/components/.../OnboardingForm.tsx\` | Use shared validator |
| \`src/components/.../ResetPasswordForm.tsx\` | Use shared validator |

## Test plan

- [x] Existing form tests pass (90 tests across 11 files)"

  ["refactor/bin-action-menu-item"]="## Summary

- \`AddToQueueFromBin\` and \`PlayFromBin\` were 90% identical (49 lines each) — same shift-key logic, same delete-from-bin behavior, same Chip/Typography markup.
- Extract the common structure into a parameterized \`BinActionMenuItem\` component that accepts icon, label, color, and action props.
- Both original components become thin wrappers (~19 lines each).

## Files changed

| File | Change |
|------|--------|
| \`src/components/.../Bin/BinActionMenuItem.tsx\` | New: shared component |
| \`src/components/.../Bin/AddToQueueFromBin.tsx\` | Thin wrapper |
| \`src/components/.../Bin/PlayFromBin.tsx\` | Thin wrapper |

## Test plan

- [x] Existing Bin tests pass (57 tests across 7 files)"

  ["refactor/use-bin-mutation"]="## Summary

- \`useAddToBin\` and \`useDeleteFromBin\` had identical scaffolding: registry check, \`useCallback\` guard, error toast \`useEffect\`.
- Extract the shared pattern into a private \`useBinMutation\` factory function.
- Each exported hook is now a one-liner delegating to the factory.
- Net: 18 insertions, 36 deletions (halved the code).

## Files changed

| File | Change |
|------|--------|
| \`src/hooks/binHooks.ts\` | Add \`useBinMutation\` factory, simplify exports |

## Test plan

- [x] Hook tests pass (4/4)"

  ["refactor/fetch-json-or-null"]="## Summary

- Three artwork fetch functions (iTunes, Last.fm album art, Last.fm song info) all followed the same fetch-parse-or-null pattern with identical try/catch/response.ok handling.
- Extract shared logic into \`fetchJsonOrNull\` with a configurable error callback (\`console.log\` by default, \`toast.error\` for \`getSongInfoFromLastFM\`).
- Net: 56 insertions, 79 deletions.

## Files changed

| File | Change |
|------|--------|
| \`src/hooks/artwork/fetchJsonOrNull.ts\` | New: shared fetch utility |
| \`src/hooks/artwork/itunes-image.ts\` | Simplified, removed unused toast import |
| \`src/hooks/artwork/last-fm-image.ts\` | Both functions simplified |

## Test plan

- [x] No regressions in artwork hook tests"

  ["refactor/filter-by-search-terms"]="## Summary

- \`useBinResults\` and \`useRotationFlowsheetSearch\` contained nearly identical client-side filtering logic: build search terms from query fields, filter albums by matching artist/title/label.
- The two implementations had a subtle divergence in where the length check was applied. The extracted function normalizes this.
- Net: 39 insertions, 47 deletions.

## Files changed

| File | Change |
|------|--------|
| \`src/utilities/filterBySearchTerms.ts\` | New: pure filtering function |
| \`src/hooks/binHooks.ts\` | \`useBinResults\` delegates to shared function |
| \`src/hooks/catalogHooks.ts\` | \`useRotationFlowsheetSearch\` delegates to shared function |

## Test plan

- [x] Typecheck passes
- [x] No regressions in hook tests"

  ["refactor/throw-if-better-auth-error"]="## Summary

- 7 call sites across auth, DJ, and admin hooks repeated the same pattern: check \`result.error\`, extract \`.message\`, throw.
- Extract into a one-liner \`throwIfBetterAuthError(result, fallback)\` utility.
- Hooks with custom error mapping logic (\`useLogin\`'s multi-type extraction, \`useOTPVerify\`'s friendly message map) are left as-is.

## Files changed

| File | Change |
|------|--------|
| \`src/utilities/throwIfBetterAuthError.ts\` | New: error extraction + throw utility |
| \`src/hooks/authenticationHooks.ts\` | 5 call sites replaced |
| \`src/hooks/djHooks.ts\` | 1 call site replaced |
| \`src/hooks/adminHooks.ts\` | 1 call site replaced |

## Test plan

- [x] Typecheck passes
- [x] No regressions in hook tests"

  ["refactor/use-async-action"]="## Summary

- Every async hook in \`authenticationHooks.ts\` manually managed \`[isLoading, setIsLoading]\`, \`[error, setError]\`, and identical try/catch/finally scaffolding with error message extraction and toast notifications. This pattern repeated 8+ times.
- Extract into a reusable \`useAsyncAction\` hook returning \`{ execute, isLoading, error }\`.
- \`execute(fn, fallbackMessage)\` handles loading lifecycle, error extraction, and toasting. Returns \`true\` on success, \`false\` on failure.
- Refactored 6 hooks: \`useLogin\`, \`useOTPRequest\`, \`useOTPVerify\`, \`useLogout\`, \`useNewUser\`, \`useResetPassword\` (which uses two instances for its two handlers).
- \`useAuthentication\` and \`useRegistry\` left unchanged (different pattern).
- Net: 118 insertions, 204 deletions (86 lines removed).

## Files changed

| File | Change |
|------|--------|
| \`src/hooks/useAsyncAction.ts\` | New: reusable async action hook |
| \`src/hooks/authenticationHooks.ts\` | 6 hooks refactored |
| \`src/components/.../LeftbarLogout.test.tsx\` | Mock return type updated |
| \`src/components/.../AuthBackButton.test.tsx\` | Mock return type updated |

## Test plan

- [x] Typecheck passes
- [x] All 19 affected tests pass"
)

# ── Main loop ────────────────────────────────────────────────────────

created_prs=()

for branch in "${BRANCHES[@]}"; do
  title="${TITLES[$branch]}"
  body="${BODIES[$branch]}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 $branch"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if $DRY_RUN; then
    echo "[dry-run] Would push $branch and create issue + PR"
    echo "  Title: $title"
    echo "  Files: $(git diff --stat main.."$branch" | tail -1)"
    continue
  fi

  # Push branch
  echo "⬆️  Pushing $branch..."
  git push -u origin "$branch" 2>&1 | tail -2

  # Create issue
  echo "📋 Creating issue..."
  issue_url=$(gh issue create \
    --repo "$REPO" \
    --title "Refactor: $title" \
    --body "$body")
  issue_number=$(echo "$issue_url" | grep -oE '[0-9]+$')
  echo "   Issue: $issue_url"

  # Create PR
  echo "🔀 Creating PR..."
  pr_url=$(gh pr create \
    --repo "$REPO" \
    --head "$branch" \
    --base main \
    --title "$title" \
    --body "$(cat <<EOF
$body

Closes #${issue_number}
EOF
)")
  echo "   PR: $pr_url"

  created_prs+=("$pr_url")
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if $DRY_RUN; then
  echo "Dry run complete. Run with --run to create issues and PRs."
else
  echo "✅ Created ${#created_prs[@]} PRs:"
  for pr in "${created_prs[@]}"; do
    echo "  $pr"
  done
fi
