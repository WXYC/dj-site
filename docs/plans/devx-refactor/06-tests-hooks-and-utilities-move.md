# S6 — tests-hooks-and-utilities-move

Status: pending · Risk: simple (Sonnet) · PR: —

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
