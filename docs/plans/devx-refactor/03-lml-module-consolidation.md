# S3 — lml-module-consolidation

Status: reviewed, PR pending · Risk: simple (Sonnet) · PR: —

## Task

Fix the lib→src import inversion in the LML (library metadata lookup) module and
group its pieces with their semantic feature.

## Current problem

`lib/features/lml/api.ts` imports from `src/hooks/lml/` — a state-layer module
depending on the presentation layer. Conversions and types live under `src/hooks/lml/`
instead of the feature module.

## Desired outcome

`src/hooks/lml/{lml-conversions,types}.ts` (+ their tests) move into
`lib/features/lml/`; `useLmlLibrarySearch` lands at `src/hooks/useLmlLibrarySearch.ts`;
importers (`flowsheetHooks.ts`, index barrel) updated; no lib→src imports remain in
the lml path.

## Preserved behavior

Identical debounce/skip semantics (#625, #563); wire shape unchanged.

## Excluded scope

No behavior or signature changes to the hook; no changes to metadata feature module.

## Acceptance criteria

`lib/features/lml/` self-contained; grep shows no `@/src/` or relative-src import in
`lib/features/lml/`; lml tests pass from their new locations.

## Verification

Baseline commands + lml-focused vitest run.

## Result

Inspected: `lib/features/lml/api.ts` (the inverted import), `src/hooks/lml/{index,
types,lml-conversions,useLmlLibrarySearch}.ts` (+ 2 colocated tests), and grepped
the full repo for every importer of `src/hooks/lml/*` and `useLmlLibrarySearch`.

Moved (via `git mv`, verbatim — git shows pure renames, 0 content diff):
- `src/hooks/lml/lml-conversions.ts` → `lib/features/lml/lml-conversions.ts`
- `src/hooks/lml/lml-conversions.test.ts` → `lib/features/lml/lml-conversions.test.ts`
- `src/hooks/lml/types.ts` → `lib/features/lml/types.ts`
- `src/hooks/lml/useLmlLibrarySearch.ts` → `src/hooks/useLmlLibrarySearch.ts`
- `src/hooks/lml/useLmlLibrarySearch.test.ts` → `src/hooks/useLmlLibrarySearch.test.ts`
- `src/hooks/lml/index.ts` deleted (barrel re-exported three symbols now living in
  three different directories; no equivalent single location, no feature module in
  the repo uses an internal barrel, so it was not replaced).

Changed (import paths only, no logic touched):
- `lib/features/lml/api.ts`: `@/src/hooks/lml/{lml-conversions,types}` → relative
  `./lml-conversions`, `./types`.
- `lib/test-utils/fixtures.ts`: `@/src/hooks/lml/types` → `@/lib/features/lml/types`.
- `src/hooks/flowsheetHooks.ts`: `from "./lml"` → `from "./useLmlLibrarySearch"`.
- `src/hooks/flowsheetHooks.test.tsx`: `vi.mock("./lml", ...)` →
  `vi.mock("./useLmlLibrarySearch", ...)`.
- `src/hooks/useLmlLibrarySearch.test.ts`: `from "./types"` (previously colocated)
  → `@/lib/features/lml/types` (types moved out from under it).

No other importers exist — full-repo grep for `hooks/lml`, `@/src/hooks/lml`, and
`"./lml"` returns zero hits after the move.

Verified:
- `npx tsc --noEmit`: clean.
- `npx vitest run lib/features/lml/lml-conversions.test.ts
  src/hooks/useLmlLibrarySearch.test.ts src/hooks/flowsheetHooks.test.tsx`: 3 files /
  135 tests passed.
- `npm run test:run`: 269 files / 3,670 tests passed — identical to the pre-slice
  baseline (S2 ledger), zero drift.
- `npm run build`: succeeds.
- `grep -rn '"@/src/\|from "\.\./\.\./src\|from "\.\./src' lib/`: zero hits (no
  lib→src imports anywhere in `lib/`).
- `find src/hooks -iname '*lml*'`: only `useLmlLibrarySearch.{ts,test.ts}`; no
  `src/hooks/lml/` directory remains.

Deviations: none. Debounce (350 ms), `MIN_QUERY_LENGTH` skip gating, and the
live-args stale-result guard (#625) in `useLmlLibrarySearch.ts` are byte-identical
to pre-move (moved verbatim, only its test's `types` import was repointed). The
`#563` dedupe comment and test are unchanged. No index barrel was reintroduced in
`lib/features/lml/` — consistent with every other feature module (`catalog`,
`metadata`, `rotation`), none of which has one.

### Independent review (fresh-context, Opus)

All six checks CONFIRMED-SAFE, zero blocking findings: 100%-similarity renames
verified; barrel deletion leaves zero dangling imports (tsc-proven); the vi.mock
specifier matches the production import byte-for-byte (no silent un-mock); lib→src
inversion eliminated repo-wide; no config referenced the old paths; no stray edits.
One advisory for campaign close, not this slice: census.md prose still describes the
pre-move lml topology (lines ~149/151/209/512) — sweep the census for staleness when
the campaign wraps.
