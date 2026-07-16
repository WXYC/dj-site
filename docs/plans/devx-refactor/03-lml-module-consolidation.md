# S3 — lml-module-consolidation

Status: pending · Risk: simple (Sonnet) · PR: —

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
