# S14 — comment-reduction-pass

Status: done · Risk: simple, behavior-neutral (Sonnet) · PR: —

## Task

Dedicated comment-reduction pass over the top-density files no earlier slice touched.
No code changes.

## Current problem

3,115 comment lines across production source (9.5%); census §5 ranks the offenders.
Files owned by earlier slices (authenticationHooks S9, flowsheetHooks S10) are handled
there; the rest need one pass.

## Desired outcome

Per CLAUDE.md comment rules, applied to: `app/auth/verify-email/route.ts` (40%
density), `lib/features/authentication/{organization-utils,server-utils}.ts`,
`lib/features/catalog/conversions.ts`,
`src/components/experiences/modern/flowsheet/Entries/tableStyles.tsx`,
`src/hooks/applicationHooks.ts` (useWindowSize tutorial boilerplate),
`src/hooks/{playlistSearchHooks,themePreferenceHooks}.ts`, `lib/features/backend.ts`
(light touch — its soft-fail docs ARE the contract; keep most).

## Preserved behavior

All. Keep (compressed) every issue-numbered invariant/race comment — 143 lines carry
#NNN refs and most encode hard-won fixes. Delete narration, history, section banners,
tutorial boilerplate.

## Excluded scope

Any code edit whatsoever; files already covered by earlier slices.

## Acceptance criteria

Diff contains only comment-line deletions/compressions; every surviving comment states
a non-obvious reason, constraint, or invariant.

## Verification

Baseline commands (must be trivially green — the diff is behavior-neutral by
construction); reviewer confirms no code tokens changed.

## Result

Comment-only pass over the 8 in-scope files (`lib/features/backend.ts` skipped per
spec — S2 already passed it and its soft-fail docs are contract documentation).
`git log --follow` on each target confirmed no campaign slice (S1–S13, S17, S19) had
touched it before this pass; the only prior touches were pre-campaign feature/fix
commits.

Per-file comment-line counts (comment-only lines, block+line, via a strip-and-diff
script — not counted: blank/code lines):

| File | Before | After |
|---|---|---|
| `app/auth/verify-email/route.ts` | 84 | 50 |
| `lib/features/authentication/organization-utils.ts` | 71 | 43 |
| `lib/features/authentication/server-utils.ts` | 60 | 34 |
| `lib/features/catalog/conversions.ts` | 54 | 32 |
| `src/components/experiences/modern/flowsheet/Entries/tableStyles.tsx` | 50 | 30 |
| `src/hooks/applicationHooks.ts` | 17 | 9 |
| `src/hooks/playlistSearchHooks.ts` | 60 | 40 |
| `src/hooks/themePreferenceHooks.ts` | 53 | 43 |
| **Total** | **449** | **281** |

Removed: restated-next-line narration (`// Get JWT token`-style), step narration in
effects (`// Add event listener`, `// Remove event listener on cleanup`, the full
`useWindowSize` tutorial-boilerplate pass), JSDoc `@param`/`@returns` blocks that only
repeated TypeScript types, decorative `// State` / `// Results` / `// Actions` section
labels inside a hook's return object, and one vague "for compatibility with existing
code" doc with no actual compatibility detail.

Kept (compressed, not deleted) every issue-numbered invariant:
- `verify-email/route.ts`: `#597` open-redirect guard rationale, `#633` cookie
  `Path=` fallback.
- `organization-utils.ts` / `server-utils.ts`: `#616` org-id cache session-scoping
  (both the cache doc and the two "must not fall back to slug-as-ID" security notes),
  `#836 AC2` OIDC-resume non-interference, `#612`/session-authority ordering context.
- `catalog/conversions.ts`: `dj-site#564`/`Backend-Service#689` synthetic-id
  rationale, `dj-site#626` rotation-picker hash-collision case, the
  `CONTENTLESS_ID_BASE` "do NOT simplify to -(2**31)" floor warning, `dj-site#608`
  wire-leak follow-up, `dj-site#691` rotation-linkage narrowing, `dj-site#709`
  `record_label` mistyping fix. All condensed to their causal core but no fact
  dropped (verified by re-reading each compressed comment against the original).
- `tableStyles.tsx`: the now-playing row box-shadow seam-bridging hack (fractional
  column widths reveal the page through per-cell fills), the drag-grip clip-path
  interaction, `#820` tubafrenzy column-order/count invariant. Cut purely aesthetic
  rationale ("broadcast-log softening") that named no hazard.
- `applicationHooks.ts`: `#635` Shift-key blur/visibility reset race, `#639`/`#616`
  logout state-wipe rationale (untouched — already tight).
- `playlistSearchHooks.ts`: `#604` producing-cursor / accumulator-replace ordering
  invariant (both effects), `#623` mid-flight full-tuple comparison rationale, the
  `#540` ref-vs-state historical-bug context (kept because it's still the reason the
  accumulator is state, not narration of an unrelated past step), the two
  ORDERING INVARIANT declarations (kept verbatim in substance, tightened wording per
  spec).
- `themePreferenceHooks.ts`: every `#611` invariant (synchronous sync-guard claim,
  live `mode` ref for mid-sync toggles, unmount-only cleanup flag, reload-only
  repaint due to Joy CssVarsProvider's runtime `:root` var limitation, the
  `RHS defaults to false` `data-experience` comparison fix, loop-safety of the
  registry-resolved theme-id comparison). Compressed prose but kept every fact;
  no separate "history" narrative existed to cut beyond wording.

Hard invariant verified per-file (not just the aggregate diff): a comment-stripping
script normalized both the pre-edit (`git show HEAD:<path>`) and post-edit file
content (block/line comments removed, trailing same-line comments removed when not
inside a string literal, blank lines and trailing whitespace ignored) and asserted
byte-identical output — all 8 files passed. `git diff` for these files also contains
no line where a `+`/`-` pair differs outside a comment token.

## Verification (executed)

- `npx tsc --noEmit` — clean (had to `rm -rf .next` first; a stale generated
  `.next/types/validator.ts` referenced a since-deleted route unrelated to this
  slice).
- `npm run lint` — 0 errors (224 pre-existing warnings, none in touched files).
- `npm run test:run` — 269 files / 3673 tests passed, identical with and without
  this diff (re-ran against `git stash` to confirm; the slice doc's original
  "3,672" figure was stale relative to what's currently on this branch).
- `npm run build` — succeeded, all 19 routes compiled.
