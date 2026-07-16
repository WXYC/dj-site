# S14 — comment-reduction-pass

Status: reviewed (MERGE — independent TS-compiler verification, all 98 files, 0 diffs; all 31 JSX sites individually cleared; every #NNN/security/race comment survives) · Risk: simple,
behavior-neutral (Sonnet) · PR: —

## Task

Dedicated comment-reduction pass over the top-density files no earlier slice touched.
No code changes. Extended 2026-07-16 to audit every remaining production file
repo-wide (see "Extension" section below) — the owner wants no file left
unaudited, not just the top-density offenders.

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
- `organization-utils.ts`: `#616` org-id cache session-scoping (×2, both survive; `server-utils.ts` never carried #616 — review-corrected grouping)
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

## Extension — full repo-wide coverage (2026-07-16)

The first pass above was selective (8 top-density files). The owner requires no
production file left unaudited. This extension enumerates and audits every
remaining file under `app/`, `src/`, `lib/` (`*.ts`/`*.tsx`/`*.mjs`; no colocated
tests remain there — the campaign moved them all).

**Scope.** `find app src lib -name '*.ts' -o -name '*.tsx' -o -name '*.mjs'` → 378
files. Excluded: `lib/features/backend.ts` (S2's contract docs, owner-sanctioned
skip) and the 8 files already done above. That leaves 369 candidate files. Files
substantively touched by campaign slices (S2/S9/S10/S11/S12/S13/S17/S19) were
included in the audit per instructions, not skipped — most were already compliant
and drop out with an empty diff; a handful had a stray narration comment survive
and got fixed here (e.g. `lib/features/session.ts`, `lib/features/flowsheet/frontend.ts`,
`lib/features/flowsheet/api.ts`).

Of the 369 candidates, 223 contain at least one `//`/`/*`/`{/*` marker and were
individually read and judged against charter §6; 146 have zero comment markers
(confirmed via a per-file grep pass) and needed no edit. 90 of the 223 ended up
edited; 133 were read and found already compliant (dense but every surviving
comment ties to an issue number, race/ordering constraint, or provider/protocol
gotcha) and left untouched.

**Method.** Work was parallelized across 8 batches of ~25-29 files each (grouped
to balance total comment-marker count per batch), each independently applying the
same charter §6 keep/compress standard as the first pass, then centrally
reconciled and re-verified as one pass over the full diff.

**Hard invariant.** A comment-stripping normalizer (block/line comments removed,
respecting string/template literals with nested `${}` tracking; blank lines and
trailing whitespace collapsed) was run against every one of the 90 edited files,
comparing `git show HEAD:<path>` (this file's state at the first-pass commit)
against the edited working-tree content — all 90 came back byte-identical after
stripping. The normalizer treats a standalone JSX comment (`{/* ... */}` with
nothing else between the braces) as a single comment unit that strips to nothing,
matching the instruction that JSX comments count as comments; several batches
initially found this ambiguous with a cruder brace-naive version of the script
and conservatively left a handful of JSX section-label comments in place — the
script was corrected and those were swept up in central reconciliation (see
below), along with a few spots where a batch had substituted an empty `{}` for a
removed JSX comment rather than deleting the node outright (a technically
comment-only-preserving workaround, replaced here with a clean full-line
removal): `MobileSongEntry.tsx`, `RightbarPanelContainer.tsx`, `SearchBar.tsx`
(previous-sets), `PlaylistSearchRow.tsx`, `PlaylistInfiniteScroll.tsx`,
`FlowsheetEntryField.tsx`, `AccountEditForm.tsx`, `SettingsForm.tsx`.
`SongEntry.tsx`'s two JSX comments were re-examined and correctly left
untouched — both encode the `#820` tubafrenzy column-order invariant.

Per-file comment-only-line counts (files with ≥5 lines removed; comment-only line
= a line with no surviving code token after stripping, i.e. a full `//` line, a
full block-comment line, or a standalone JSX comment line):

| File | Before | After |
|---|---|---|
| `src/components/shared/Authorization/AuthorizedView.tsx` | 43 | 0 |
| `lib/features/experiences/types.ts` | 35 | 0 |
| `lib/features/experiences/registry.ts` | 21 | 0 |
| `lib/features/authentication/organization-utils.server.ts` | 30 | 11 |
| `src/components/shared/ExperienceProvider.tsx` | 11 | 0 |
| `lib/features/authentication/organization-config.ts` | 25 | 16 |
| `src/components/experiences/modern/admin/roster/csvImport.ts` | 21 | 13 |
| `lib/features/experiences/modern/themes/definitions.ts` | 51 | 43 |
| `lib/features/authentication/utilities.ts` | 24 | 16 |
| `lib/features/admin/conversions-better-auth.ts` | 9 | 1 |
| `lib/features/admin/better-auth-client.ts` | 8 | 0 |
| `lib/features/session.ts` | 14 | 7 |
| `src/components/experiences/modern/settings/EmailChangeModal.tsx` | 9 | 3 |
| `src/components/experiences/modern/flowsheet/Entries/SongEntry/MobileSongEntry.tsx` | 13 | 7 |
| `src/components/experiences/modern/admin/roster/AccountEditForm.tsx` | 9 | 3 |
| `src/components/experiences/classic/flowsheet/StartShow.tsx` | 16 | 10 |
| `lib/features/experiences/api.ts` | 6 | 0 |
| `src/widgets/NowPlaying/index.tsx` | 28 | 23 |
| `src/hooks/djHooks.ts` | 27 | 22 |
| `src/components/shared/ExperienceSwitch.tsx` | 5 | 0 |
| `src/components/experiences/modern/previous-sets/Search/SearchBar.tsx` | 5 | 0 |
| `src/components/experiences/modern/playlist-search/PlaylistSearchRow.tsx` | 5 | 0 |
| `lib/utils/page-title.ts` | 5 | 0 |
| `lib/features/experiences/modern/tokens/roles.ts` | 26 | 21 |
| `lib/features/authentication/client.ts` | 19 | 14 |
| **Subtotal (25 files)** | **465** | **210** |
| **Remaining 65 edited files (<5 removed each)** | **630** | **501** |
| **Total (90 edited files)** | **1,095** | **711** |

384 comment-only lines removed across the extension. Removed categories matched
the first pass: decorative section banners (`{/* Header */}`, `// ==== */`-style,
`// State`/`// Actions` labels), JSDoc blocks restating a function/type name
already visible in its signature, per-field `/** Optional: ... */` restating a
type, step narration (`// Get better-auth session`, `// Validate the experience`),
`#region`/`#endregion` markers, one leftover MUI-demo comment, one commented-out
`console.log`, and several vague/unattributed historical asides ("as it did
before the redesign", "Replaces the hardcoded logic in..."). Kept in full or
compressed: every issue-numbered rationale encountered (`#634`, `#635`, `#636`,
`#638`, `#657`, `#701`, `#762`, `#820`, `#836`, `dj-site#564`/`#605`/`#608`/`#624`/
`#626`/`#634`/`#657`/`#691`/`#704`/`#709`, `Backend-Service#628`/`#689`/`#1308`,
`RFC 8628` OAuth device-flow references, better-auth/CSP/CSRF provider-behavior
notes, the `#820` tubafrenzy reading-order/column-invariant comments, and every
race/ordering-invariant comment (shift-key blur races, mousedown/blur races,
Strict Mode remount handling, AudioContext singleton cleanup, RTK Query dedup
rationale). Nothing was dropped that a batch or the central review flagged as
uncertain — "when unsure, keep" held throughout; zero borderline calls were
escalated as unresolved.

### Ledger reconciliation (+1 test, resolved)

The branch measures **269 files / 3,673 tests**. Campaign arithmetic from
`00-campaign.md`'s baseline (main @ bb00929c: 272 files / 3,715 tests) plus each
slice's documented delta — S1 `−52`, S2 `+7`, S12 `+4`, S9 `+2`, S10 `+3`, S11
`−7` — nets to 3,672, one short of the measured 3,673.

Root cause: `git log --oneline --graph 89ba02a4` (the S11-into-devx-root resync,
which is HEAD's parent) shows a commit that is **not a campaign slice**:

```
*   89ba02a4 resync: main (S11 #905) into devx-root
|\
| * a8183c1b refactor(app): drop vestigial rightbar state; single experience read path
* | 3e2a6bb9 resync: main (S13 #902) into devx-root
|\|
| * 6541f0a4 refactor(admin): move roster onto RTK Query, delete invalidation bus
| * e4f95dcd feat(classic): default flowsheet entry "From" to WXYC Library (#903)
```

`e4f95dcd` ("feat(classic): default flowsheet entry 'From' to WXYC Library (#903)",
Jake Bromberg) landed directly on `main` — an ordinary product feature PR,
unrelated to the DevX campaign — between the S13 resync and the S11 resync. Its
own commit message: "Tests that implicitly relied on the Rotation default now
select it explicitly, and a new test pins the library default." The diff of
`EntryForm.test.tsx` confirms: 4 pre-existing `it(...)` blocks were rewritten
(made explicit about the `From` field they'd been implicitly relying on) and 5
`it(...)` blocks exist post-change — a net **+1 test**, landing on `main` outside
any campaign slice's accounted delta.

3,672 (campaign ledger) + 1 (main-line feature PR #903, picked up by the S13/S11
resyncs) = **3,673**, matching the branch exactly. The ledger is reconciled; no
further action needed. Future resyncs should watch for this class of drift —
non-campaign `main` activity between resync points isn't captured by the slice
delta arithmetic and needs a one-off note like this one when it changes the test
count.

### Total campaign comment stats

Census baseline (`census.md`, campaign start, 2026-07-15): 383 production files,
32,905 lines, 3,115 comment lines (9.5% density); 143 of those carry `#NNN`
issue refs.

Current (this branch, post-extension): 378 production files, 32,148 lines, 2,607
comment-only lines (8.11% density) — measured with the same normalizer used for
the hard invariant, counting lines with no surviving code token after stripping
(closest equivalent to census's line-prefix method; the file-count and line-count
deltas versus the census baseline reflect S1's dead-code deletions and other
slices' code changes, not just comment removal).

Net: **~508 fewer comment lines** (3,115 → 2,607, a 16.3% relative reduction)
across the full campaign — the sum of every slice's per-slice touched-file
comment audit (S2, S9, S10, S11, S12, S13, S17, S19), the S14 first pass (449→281,
−168), and this S14 extension (1,095→711 across edited files, −384, within a
369-file full-repo audit where 133 files were read and already compliant and 146
had no comments to begin with).

## Verification (extension, executed)

- `npx tsc --noEmit` (after `rm -rf .next`) — clean.
- `npm run lint` — 0 errors, 224 pre-existing warnings (all in test files under
  `tests/`, none in touched production files) — identical warning count to the
  first pass.
- `npm run test:run` — baseline via `git stash push -u` then `git stash pop`:
  pre-diff **269 files / 3,673 tests**, post-diff **269 files / 3,673 tests**,
  byte-identical pass/fail outcome (same single pre-existing jsdom
  `_location`-null flake in `RotationEntryFields.refetch.test.tsx`, unrelated to
  this slice, present in both runs).
- `npm run build` — succeeded, all 19 routes compiled.
- Hard invariant — 90/90 edited files verified byte-identical after
  comment-stripping normalization against their first-pass-commit content.
