# S10 — flowsheet-search-results-single-source

Status: reviewed, PR pending · Risk: risky (Opus) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

The critical byte-parity check confirmed the two pre-change pipeline copies were
logically identical (cosmetic identifier differences only) — no consumer's behavior
changed; the slice eliminates the divergence RISK, not live divergence. Return
shapes identical for both hooks (all 19 fields); subscription semantics unchanged
(neither copy ever used conditional skip); agreement tests verified against the
real MAX_VISIBLE_RESULTS=50 and assert through both public hooks only; all flagged
comment rationale survives. Advisory applied: §7.9 wording tightened below — the
removal is the second maintained copy and its drift risk; runtime dual-mount cost
is unchanged (both hooks still subscribe when mounted; RTKQ dedupes the network).

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

## Result

### Design

Both `useFlowsheetSearch` and `useFlowsheetSubmit` previously carried their own copy
of the entire 4-source pipeline — the four source subscriptions (bin / rotation /
catalog / lml), the byte-similar `lmlResults` dedupe memo, the `allSearchResults`
cap/concat memo, and the `selectedResult → selectedEntry` resolution. Those two copies
were the #657 divergence hazard: the row the view highlights and the entry submit
carries were resolved by independent code that could drift.

Introduced one private hook, `useFlowsheetSearchResults()`, that owns the pipeline end
to end and returns `{ searchQuery, selectedResult, binResults, catalogResults,
rotationResults, lmlResults (deduped), selectedEntry }`. `useFlowsheetSearch` consumes
it for `selectedEntry` + `getDisplayValue`; `useFlowsheetSubmit` consumes it for the
result arrays + `selectedResultData`. No component API changed — every consumer keeps
its exact return shape (verified: `FlowsheetSearchbar`, `FlowsheetSearchInput`,
`NewEntryPreview`, `FlowsheetBackendResult`, `RotationModeToggle`, `TalksetButton`,
`BreakpointButton`, `RotationEntryFields`). No wrapper-hook fragmentation (charter
§7.2): one real shared implementation, not renamed forwarders.

### Work removed (§7.9)

What is removed is the second MAINTAINED COPY of the pipeline — a second `lmlResults`
dedupe memo, `allSearchResults` cap/concat memo, `selectedEntry` resolution, and set
of four source-hook subscription SITES in source code — and with it the #657 drift
risk. This is a maintainability/correctness-risk removal, not a runtime-work
removal: both consumer hooks still mount and subscribe (RTKQ dedupes the network),
so per-render cost is unchanged. The cap ordering
(bin → rotation → catalog → lml) and `MAX_VISIBLE_RESULTS` coupling with
`FlowsheetSearchResults` offsets and the searchbar nav bound are unchanged. (Honest
scope note: `useFlowsheetSubmit`'s per-row execution via `FlowsheetBackendResult` is
untouched — out of scope — so the dual-mount render cost in the searchbar itself is
unchanged; the removal is the second maintained copy of the derivation and its
divergence risk, not the per-mount memo count.)

### Invariant evidence

- **#657 (view/submit agree):** structurally guaranteed — both hooks resolve
  `selectedEntry` from the single `useFlowsheetSearchResults` concat, so divergence is
  no longer expressible. New test block `search view / submit agreement for the same
  query (#657)` in `tests/unit/hooks/flowsheetHooks.test.tsx` renders
  `useFlowsheetSearch` + `useFlowsheetSubmit` against one store and asserts they resolve
  the same album id/title (incl. `getDisplayValue("album")` === `selectedResultData.album`)
  at a mid-list index, at the last visible capped row (index 50 → the 50th painted
  album, id 2049), and past the cap (index 51 → both fall back to manual entry, never an
  unseen album).
- **Dedupe order / cap coupling:** preserved verbatim in the shared memo; existing
  `visible-index → submission mapping under the render cap (#657)` tests still pass
  unweakened.
- **Excluded scope untouched:** no changes to `lib/features/flowsheet/*`, search UI
  components, or queue logic.

### Comment reduction

`flowsheetHooks.ts` comment lines 93 → 83. Dropped step narration (per-branch
"User is creating…", "Deduplicate LML results…", "Get the display value…", "Combine
both keyboard listeners…", "Flatten all pages…"); the two duplicated #657 blocks
collapse into one concise invariant doc on `useFlowsheetSearchResults`. Kept: the
Ctrl+Enter ref-race rationale, the HTML5-validation-bypass guard note, `NO_MUTATION_STATE`
/ per-row narrowing rationale, and all #644 queue-clear commentary.

### Verification

- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 errors (pre-existing warnings only; none in touched files).
- `npm run test:run`: 269 files / 3679 tests pass (ledger 3676 + 3 new agreement tests).
- Focused: `flowsheetHooks.test.tsx` 92 pass; flowsheet component integration suite
  (32 files / 450 tests) pass.
- `npm run build`: succeeds.
- Not locally verified: CI e2e `flowsheet/` suite (runs on the PR).
