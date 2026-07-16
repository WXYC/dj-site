# S10 — flowsheet-search-results-single-source

Status: pending · Risk: risky (Opus) · PR: —

## Task

Extract the duplicated flowsheet search merge/dedupe/cap pipeline into one shared hook.

## Current problem

`useFlowsheetSearch` and `useFlowsheetSubmit` in `src/hooks/flowsheetHooks.ts` each
implement the entire 4-source (bin → rotation → catalog → lml) merge/dedupe/cap
pipeline; divergence between them is exactly the #657 class of bug (highlighted row
and submitted entry resolving to different albums).

## Desired outcome

A shared `useFlowsheetSearchResults` consumed by both; no component API changes.

## Preserved behavior

#657 capped index space; dedupe order bin → rotation → catalog → lml;
`MAX_VISIBLE_RESULTS` coupling with `FlowsheetSearchResults` offsets; SSE pipeline and
optimistic mutation layer untouched (census risks #1, #2).

## Excluded scope

`lib/features/flowsheet/*` (SSE, cache, reorder, api); search UI components; queue
logic. Runs after S9 (depends on stable `useRegistry` identities for memo behavior).

## Acceptance criteria

Single pipeline implementation; index-space test proving search view and submit
resolve identically for the same query; all flowsheet tests pass.

## Verification

Baseline commands + flowsheet hook/component vitest suites; CI e2e `flowsheet/` suite.
Comment reduction in `flowsheetHooks.ts` (93 lines — keep perf rationale, drop step
narration) happens here.
