# S5 — tests-unit-move

Status: pending · Risk: simple (Sonnet) · PR: —

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
