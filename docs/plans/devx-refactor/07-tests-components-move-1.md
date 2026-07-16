# S7 — tests-components-move-1

Status: pending · Risk: simple (Sonnet) · PR: —

## Task

Move component tests for shared/widgets/Layout/classic into `tests/integration/`.

## Desired outcome

Tests under `src/components/shared`, `src/widgets`, `src/Layout`, and
`src/components/experiences/classic` → `tests/integration/components/...`, mirroring
source paths under the purpose bucket (census §4 mapping rules).

## Preserved behavior

Moves + import fixes only.

## Excluded scope

Modern-experience and `app/` tests (S8).

## Acceptance criteria

No colocated tests remain under the four named roots; count preserved vs ledger.

## Verification

Baseline commands; count recorded pre/post.
