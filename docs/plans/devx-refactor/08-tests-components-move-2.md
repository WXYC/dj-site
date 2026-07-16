# S8 — tests-components-move-2

Status: pending · Risk: simple (Sonnet) · PR: —

## Task

Move the remaining colocated tests: modern-experience components and `app/` routes and
pages. Completes the test migration.

## Desired outcome

Tests under `src/components/experiences/modern` → `tests/integration/components/modern/...`;
`app/**/__tests__` route-handler tests → `tests/integration/routes/`; page/layout tests →
`tests/integration/app/`; `tests/components/EmailChangeModal.test.tsx` re-homed into the
same buckets. After S8: zero colocated tests repo-wide (e2e/, scripts/ exempt — see S16
and census §4).

## Preserved behavior

Moves + import fixes only.

## Excluded scope

Production code; e2e/; scripts bats suites.

## Acceptance criteria

`find app src lib -name "*.test.*" -o -name "__tests__" -type d` returns nothing; all
272-ledger files accounted for across S4–S8; count preserved. Propose (not implement)
a CI grep guard in the PR description for Jackson's call.

## Verification

Baseline commands; final ledger reconciliation recorded in this file.
