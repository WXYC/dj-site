# S6 — tests-hooks-and-utilities-move

Status: reviewed, PR pending · Risk: simple (Sonnet) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

Every repointed vi.mock/import specifier independently verified to resolve to the
same file the production code imports (alias table cross-checked against each
production hook's own import line; all 43 dynamic imports in
authenticationHooks.test.ts grep-counted and sampled; zero surviving relative
specifiers across the 25 moved files). All 926 diff lines are specifier-only.
Ledger re-verified: 269 files / 3,670 tests. Zero new lint findings (the single
pre-existing error is the stale-glob artifact this branch's base predates — the
integration branch carries the TEST_FILES glob fix and lints 0 errors; the review
noted a conflicting file attribution for it, resolved by the glob-fix logic).

## Task

Move hook and utility tests out of `src/` into `tests/unit/`.

## Desired outcome

`src/hooks/**/*.test.*` + `src/hooks/__tests__/**` → `tests/unit/hooks/`;
`src/utilities/**` tests → `tests/unit/utilities/` (the two duplicate pairs were
already deleted in S1); `src/ThemedLayout.test.tsx` → `tests/integration/app/`.

## Preserved behavior

Moves + import fixes only; no test weakened.

## Excluded scope

Component tests (S7–S8); hook production code (S9+).

## Acceptance criteria

No `*.test.*` or `__tests__/` remains under `src/hooks` or `src/utilities`; count
preserved vs ledger.

## Verification

Baseline commands; count recorded pre/post.

## Result

Moves + import fixes only, no test content changed. Ledger preserved exactly:
269 test files / 3,670 tests, pre and post (full `npx vitest run` both before and
after the moves). `npx tsc --noEmit`, `npm run build`, and focused runs of
`tests/unit/hooks` + `tests/unit/utilities` + `tests/integration/app` (25 files /
335 tests) all green. `npm run lint` unchanged at 1 pre-existing error (in
`tests/helpers/component-harness.ts`, from the S4 helpers move — untouched by
this slice, confirmed present on the branch tip before these commits via
`git stash`) + 228 warnings; no new lint errors introduced by this slice.

### Move map

`src/hooks/*.test.ts(x)` + `src/hooks/__tests__/**` → `tests/unit/hooks/**`
(the `__tests__` segment is flattened — those 3 files land directly in
`tests/unit/hooks/`, no subdirectory):

- adminHooks.test.ts, applicationHooks.test.ts, authenticationHooks.test.ts,
  binHooks.test.tsx, djHooks.test.ts, flowsheetHooks.test.tsx,
  playlistSearchHooks.test.ts, themePreferenceHooks.test.tsx,
  useAuthentication.test.tsx, useDebouncedValue.test.ts, useGhostText.test.ts,
  useLmlLibrarySearch.test.ts, useShiftKey.test.ts, useSSEConnection.test.tsx
- from `src/hooks/__tests__/`: catalogHooks.test.ts,
  useCatalogFlowsheetSearch.test.tsx, useCatalogQueryResults.test.tsx

`src/utilities/**` tests (colocated + `__tests__/`) → `tests/unit/utilities/**`
(subdirs mirrored):

- filterBySearchTerms.test.ts, oidcRedirectTarget.test.ts,
  usernameValidation.test.ts (colocated, root)
- modern/entryFieldColors.test.ts, modern/catalog/utilities.test.ts (colocated,
  subdirs mirrored)
- from `src/utilities/__tests__/`: closesthour.test.ts, stringutilities.test.ts
  (flattened to `tests/unit/utilities/` root — S1 already removed the
  duplicate colocated copies, so there's exactly one surviving copy each)

`src/ThemedLayout.test.tsx` → `tests/integration/app/ThemedLayout.test.tsx`
(new directory).

Both `src/hooks/__tests__/` and `src/utilities/__tests__/` directories removed
(now empty). `src/ThemedLayout.test.tsx` gone;
`src/ThemedLayout.tsx` (production) untouched in place.

### vi.mock repoints — resolution verification

Production hook files under `src/hooks/` mock/import each other by relative
specifier (e.g. `authenticationHooks.ts` does `import { resetApplication } from
"./applicationHooks"`), and those files did NOT move — only their tests moved.
So every test-file `vi.mock("./sibling", …)` or `import … from "./sibling"`
pointed at a sibling hook had to become an alias specifier
(`@/src/hooks/sibling`) that resolves to the exact same absolute file
`src/hooks/sibling.ts` the production code under test already imports — Vitest
mocks are keyed by resolved module id, so alias vs. relative is irrelevant as
long as both resolve to the same file. Verified for each by reading the
corresponding production hook's own import line:

| Test file | vi.mock/import changed | Resolves to (verified against production import) |
|---|---|---|
| binHooks.test.tsx | `vi.mock("./authenticationHooks")` → `@/src/hooks/authenticationHooks` | `binHooks.ts:8` imports `useRegistry` from `"./authenticationHooks"` — same file |
| flowsheetHooks.test.tsx | `vi.mock("./authenticationHooks")`, `vi.mock("./binHooks")`, `vi.mock("./catalogHooks")`, `vi.mock("./useLmlLibrarySearch")` → `@/src/hooks/*` | `flowsheetHooks.ts:34-40` imports each from the matching relative specifier — same files |
| useGhostText.test.ts | `vi.mock("./useDebouncedValue")` → `@/src/hooks/useDebouncedValue` | `useGhostText.ts:10` imports `useDebouncedValue` from `"./useDebouncedValue"` — same file |
| djHooks.test.ts | `vi.mock("./authenticationHooks", async (importOriginal) => …)` incl. the `import("./authenticationHooks")` type reference → `@/src/hooks/authenticationHooks` | `djHooks.ts:10` imports `useRegistry` from `"./authenticationHooks"` — same file |
| authenticationHooks.test.ts | `vi.mock("./applicationHooks")` → `@/src/hooks/applicationHooks`; 43 dynamic `await import("./authenticationHooks")` (SUT, re-imported per-test after `vi.resetModules`-style isolation) → `@/src/hooks/authenticationHooks` | `authenticationHooks.ts:27` imports `resetApplication` from `"./applicationHooks"` — same file; SUT import now resolves to the same `authenticationHooks.ts` under test |
| useAuthentication.test.tsx | `vi.mock("./applicationHooks")` → `@/src/hooks/applicationHooks`; SUT `import { useAuthentication } from "./authenticationHooks"` → `@/src/hooks/authenticationHooks` | same reasoning as above — `useAuthentication` is exported by `authenticationHooks.ts`, which imports `applicationHooks.ts` relatively |
| useCatalogFlowsheetSearch.test.tsx | `vi.mock("../authenticationHooks")` → `@/src/hooks/authenticationHooks`; SUT `import … from "../catalogHooks"` → `@/src/hooks/catalogHooks` | `catalogHooks.ts:24` imports `useAuthentication` from `"./authenticationHooks"` (relative to `src/hooks/`) — same file |
| useCatalogQueryResults.test.tsx | same two repoints as above | same verification |
| catalogHooks.test.ts | SUT `import … from "../catalogHooks"` → `@/src/hooks/catalogHooks` | direct file move target, no sibling mock involved |

All other moved hook/utility tests already imported their SUT via the `@/`
alias or only needed the SUT import path itself corrected (no sibling
vi.mock): applicationHooks.test.ts, adminHooks.test.ts, useDebouncedValue.test.ts,
playlistSearchHooks.test.ts, themePreferenceHooks.test.tsx,
useLmlLibrarySearch.test.ts, useShiftKey.test.ts, useSSEConnection.test.tsx
(already alias-only, unchanged), and all `tests/unit/utilities/**` files.

`tests/integration/app/ThemedLayout.test.tsx`: `vi.mock("./components/LoadingPage")`
→ `@/src/components/LoadingPage`, and SUT `import ThemedLayout from
"./ThemedLayout"` → `@/src/ThemedLayout`. Verified against
`src/ThemedLayout.tsx:3`, which imports `LoadingPage` from
`"./components/LoadingPage"` (i.e. `src/components/LoadingPage.tsx`) — same file.

### Counts

- Pre-move: 269 test files / 3,670 tests (full `npx vitest run`).
- Post-move: 269 test files / 3,670 tests (full `npx vitest run`) — identical.
- `find src/hooks src/utilities -name '*.test.*' -o -name '__tests__' -type d`
  → empty. `src/ThemedLayout.test.tsx` → gone.
