# S5 — tests-unit-move

Status: reviewed, PR pending · Risk: simple (Sonnet) · PR: —

### Independent review (fresh-context, Opus): PASS, no blocking findings

68 pure renames + 15 import-line-only edits verified hunk-by-hunk; the types.test.ts
collision resolution checked against pre-move blobs (18+18 tests, byte-identical
bodies, nothing lost); contract-vs-unit classification confirmed by msw-marker
inspection; the autoDJ vi.mock verified to intercept (alias and relative specifier
resolve to the same module id — advisory: textual mismatch with the SUT's relative
import could silently un-mock if one side is ever "cleaned up" alone); dynamic
`@/next.config.mjs` import confirmed executing (12 tests). Full run re-verified:
269 files / 3,670 tests. The RotationEntryFields.refetch flake reproduced once for
the reviewer and passed on re-run — the documented pre-existing jsdom issue, outside
this slice's scope.

## Task

Move `lib/__tests__/**` into `tests/unit/lib/**`, with wire-shape/contract tests going
to `tests/contract/`.

## Current problem

102 test files sit in `__tests__/` directories, dominated by `lib/__tests__` mirroring
`lib/features/*` — forbidden by CLAUDE.md's tests rule.

## Desired outcome

`lib/__tests__/features/X/Y.test.ts` → `tests/unit/lib/features/X/Y.test.ts`; root-level
`lib/__tests__/{posthog,store,csp-violation-reporter,...}.test.ts` → `tests/unit/lib/`;
`charset-torture.test.ts`, `transformResponse-soft-fail.test.ts`, and flowsheet
`soft-fail.test.ts` → `tests/contract/`. Relative-import fixes only.

## Preserved behavior

No test weakened or logic-edited; moves + import path fixes only.

## Excluded scope

`src/` and `app/` tests (S6–S8); helper internals (done in S4).

## Acceptance criteria

`lib/__tests__/` gone; file/test count preserved exactly vs ledger; contract tests
runnable via `vitest run tests/contract`.

## Verification

Baseline commands; count recorded pre/post.

## Result

Measured counts (both `npm run test:run`, all passing): pre-move **269 files /
3,670 tests**; post-move **269 files / 3,670 tests** — exact ledger match. The one
known jsdom `_location` noise (RotationEntryFields.refetch) is pre-existing and
unrelated.

83 files moved out of `lib/` in total (68 from `lib/__tests__/**`, 15 colocated
directly under `lib/features/**` outside `__tests__`, two of those nested in their
own `experiences/{classic,modern}/__tests__/theme.test.ts`). `lib/__tests__/` no
longer exists; `find lib -name '*.test.*'` returns nothing.

Move buckets:
- `lib/__tests__/features/**` → `tests/unit/lib/features/**` (mirrored): 61 files.
- `lib/__tests__/{csp-violation-reporter,next.config,posthog,store}.test.ts` →
  `tests/unit/lib/`: 4 files.
- Contract (wire-shape) → `tests/contract/`: `charset-torture.test.ts`,
  `transformResponse-soft-fail.test.ts`, and flowsheet `soft-fail.test.ts` — the 3
  files census names. Checked for a fourth: `backend.test.ts` and
  `catalog/conversions.test.ts` also reference soft-fail/#606 by keyword, but both
  exercise `backendBaseQuery`/`convertToAlbumEntry` as direct unit-level function
  calls (headers, URL building, pure conversions), not msw-mocked wire round-trips
  against real endpoints like the three contract tests do — kept as unit tests
  under `tests/unit/lib/features/`.
- Colocated `lib/features/**/*.test.ts` (outside `__tests__`, CLAUDE.md-violation
  pattern) → mirrored `tests/unit/lib/features/**`: 15 files, listed in census as
  "if any exist outside __tests__" — verified via `find lib -name '*.test.*'
  -not -path 'lib/__tests__/*'`.

Judgment calls:
- **Naming collision**: `lib/features/flowsheet/types.test.ts` (colocated, relative
  `./types` import) and `lib/__tests__/features/flowsheet/types.test.ts` both map to
  `tests/unit/lib/features/flowsheet/types.test.ts` under the mechanical mapping
  rule. Diffed both — not duplicates (36 distinct tests combined; the colocated file
  covers null/undefined-message crash guards the other doesn't, the other covers
  additional Talkset/Breakpoint substring-match cases). Renamed the colocated file
  to `type-guards.test.ts`, matching its actual top-level `describe("flowsheet type
  guards", …)` block, and left the `lib/__tests__` file at the canonical
  `types.test.ts` path per the census mapping rule. Both kept, neither weakened.
- `lib/features/experiences/{classic,modern}/__tests__/theme.test.ts` (nested
  `__tests__` subdirs, not `lib/__tests__` itself) → mirrored feature path with the
  `__tests__` segment dropped: `tests/unit/lib/features/experiences/{classic,modern}/theme.test.ts`.

Import fixes: 15 files needed relative-import repointing (all in the colocated
bucket — the `lib/__tests__` files were already `@/`-alias-clean, confirming
census). All relative `./x` / `../x` imports of production modules and one
`vi.mock` specifier (`lib/features/autoDJ/api.test.ts` mocking
`../authentication/client`) became `@/lib/features/...` aliases — verified the
mocked specifier still resolves to the same module the SUT (`autoDJ/api.ts`)
imports, so the mock still intercepts correctly. `next.config.test.ts`'s dynamic
`import("../../next.config.mjs")` became `import("@/next.config.mjs")` (root-level
alias, cleaner than counting `../` levels from the new depth).

Verification: `npx tsc --noEmit` clean; `npm run test:run` 269/3670 green;
`npx vitest run tests/contract` 3 files / 178 tests green;
`npx vitest run tests/unit/lib/features/flowsheet` 17 files / 328 tests green;
`npm run build` succeeds. `git diff --cached --stat -M` confirms only the 83 test
files changed (27 insertions / 27 deletions total, all import-line fixes) — no
production source touched, no comment-reduction obligation triggered.
