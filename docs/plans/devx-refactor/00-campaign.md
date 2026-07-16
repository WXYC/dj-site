# DevX Refactor Campaign

In-place refactor of dj-site per `CLAUDE.md`. No new behavior. Evidence and full
audit in [census.md](./census.md) (read-only census, 2026-07-15). Each slice is one
PR, filled from `docs/architecture/REFACTOR_SLICE_TEMPLATE.md`, and leaves the repo
green.

## Ground rules

- Integration branch `refactor/devx-root` hosts the merged campaign for local
  verification; it never becomes a PR. Slice branches fork from it; PRs target `main`,
  sequentially (one open at a time; a second only if directories are fully disjoint).
- The repo allows rebase merges only, and branches carrying devx-root's integration
  merge commits cannot rebase-merge. Before any slice PR opens (or after drift), the
  branch is rebuilt as a single clean commit atop `origin/main`:
  `git reset --hard origin/main && git cherry-pick <slice-commit> && git push
  --force-with-lease`.
- Agents verify with `npx tsc --noEmit`, `npm run test:run`, `npm run build`, and CI
  only — never a dev server or screenshots. Jackson verifies visually at milestone
  gates on `refactor/devx-root`.
- Flowsheet is refactored freely; parked PR #830 rebases afterward
  (backup tag `pr830-prerebase-backup`).
- Comment reduction happens per-slice on touched files; S14 covers top-density files
  no other slice touches.

## Baseline (main @ bb00929c, 2026-07-15)

- `npx tsc --noEmit`: clean.
- `npm run test:run`: 272 files / 3,715 tests, all passing. Known pre-existing noise:
  one unhandled jsdom error (`_location` null in an animation-frame callback) surfacing
  during `RotationEntryFields.refetch.test.tsx` — predates the campaign.
- `npm run build`: succeeds.

Test counts are the migration ledger: every tests-move slice must preserve the file
and test count exactly (minus explicitly deleted duplicates, which must be named).

## Slices

| # | Slug | Scope | Risk | Status |
|---|------|-------|------|--------|
| 01 | dead-code-sweep | dup provider, dead hooks module, dup tests, 5 dead deps, deprecated aliases | simple | pending |
| 02 | telemetry-contract | posthog adapter completion; de-raw backend.ts/global-error; drop unused PHProvider | risky | pending |
| 03 | lml-module-consolidation | fix lib→src import inversion; move conversions/types into lib/features/lml | simple | pending |
| 04 | tests-helpers-move | lib/test-utils → tests/{helpers,fakes,fixtures} + 116-file import codemod | simple | pending |
| 05 | tests-unit-move | lib/__tests__ → tests/unit/lib + tests/contract | simple | pending |
| 06 | tests-hooks-and-utilities-move | src/hooks + src/utilities tests → tests/unit | simple | pending |
| 07 | tests-components-move-1 | shared/widgets/Layout/classic tests → tests/integration | simple | pending |
| 08 | tests-components-move-2 | modern components + app route/page tests → tests/integration | simple | pending |
| 09 | auth-session-ownership | single session/org-role owner; stable useRegistry identities | risky | pending |
| 10 | flowsheet-search-results-single-source | shared merge/cap pipeline for search + submit | risky | pending |
| 11 | rightbar-and-experience-read-consolidation | vestigial slice state; one experience read path | moderate | pending |
| 12 | bin-hooks-cleanup | toast-on-error effect → callback catch | simple | pending |
| 13 | admin-roster-server-state | RTKQ queryFn over authClient; delete roster-events bus | risky | pending |
| 14 | comment-reduction-pass | top-density files untouched by earlier slices | simple | pending |
| 15 | playlist-search-infinite-migration | moved to issue #883 (Jackson, 2026-07-15) | — | out of campaign |
| 16 | e2e-relocation | declined (Jackson, 2026-07-15): e2e/ stays the sanctioned Playwright location; tests/ is the vitest hierarchy | — | won't do |

Sequencing: S1–S3 shrink the surface before the bulk moves; S4 must precede S5–S8
(helper import paths); S9 before S10 (useRegistry identity stability changes memo
behavior S10 relies on); S11–S13 independent after S9; S14 is the final slice.
Risk drives implementation model: simple → Sonnet, risky/moderate → Opus; every
slice gets an independent fresh-context review.

## Milestone gates (Jackson's visual verification)

| Gate | After | What to look at |
|------|-------|-----------------|
| M1 | S3 | Smoke pass: login, dashboard, live page — nothing should differ |
| M2 | S8 | Test migration done; zero colocated tests; app untouched — quick smoke |
| M3 | S10 | Auth/session + flowsheet search behavior: login flows, role gating, search/submit from all four sources |
| M4 | S13 | Rightbar toggle, bin error toasts, admin roster CRUD + search |
| M5 | S14 | Final full pass before campaign close |

The pipeline pauses at each gate; feedback becomes fix slices at the head of the
docket before the next slice starts.

## Verification (every slice)

```
npx tsc --noEmit
npm run test:run      # count preserved vs baseline ledger
npm run build
```

Plus the slice file's focused tests, post-implementation greps (no colocated tests,
no prohibited direct SDK imports, no reachable superseded code), and named e2e suites
via CI on the PR. `npm run test:scripts` when `scripts/` is touched.
