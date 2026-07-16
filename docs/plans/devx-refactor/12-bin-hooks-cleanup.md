# S12 — bin-hooks-cleanup

Status: pending · Risk: simple (Sonnet) · PR: —

## Task

Replace the toast-on-error effect in `src/hooks/binHooks.ts` with a `.catch`/unwrap in
the action callback and drop the whole-`result` effect dependency.

## Current problem

Error toasting runs through an effect keyed on the whole mutation `result` object —
an unnecessary effect with an over-broad dependency (census §3).

## Desired outcome

Toast raised in the mutation callback's catch path; effect deleted.

## Preserved behavior

Same toast messages on failure; clearBin partial-failure reporting intact.

## Excluded scope

Bin api slice; bin components; export logic.

## Acceptance criteria

No error-toast effect remains in binHooks; bin tests pass with identical toast
assertions.

## Verification

Baseline commands + bin vitest suites. Jackson checks bin error toasts at gate M4.
