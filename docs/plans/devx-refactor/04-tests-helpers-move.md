# S4 — tests-helpers-move

Status: pending · Risk: simple, bulk mechanical (Sonnet) · PR: —

## Task

Move the shared test infrastructure from `lib/test-utils/` into the top-level tests
hierarchy and codemod all importers. Must precede S5–S8.

## Current problem

CLAUDE.md mandates `tests/{helpers,fakes,fixtures}`; today the shared render helpers,
harnesses, msw handlers, and fixture factories live in `lib/test-utils/` and 116 files
(measured) import `@/lib/test-utils`.

## Desired outcome

`lib/test-utils/*` → `tests/helpers/` (render, harnesses, time); msw handlers →
`tests/fakes/`; fixture factories → `tests/fixtures/`. All 116 importers codemodded to
the new specifiers (prefer codemod over a re-export shim; if a shim is used it is
deleted in this same slice). `vitest.setup.ts` import path and `vitest.config.mts`
coverage excludes updated; `docs/testing.md` pointers updated.

## Preserved behavior

No test weakened; msw lifecycle unchanged; charset fixture hash intact. Diff is large
but uniform — a moves PR.

## Excluded scope

No test file moves other than `lib/test-utils` itself (S5–S8 handle test files); no
helper API changes.

## Acceptance criteria

`lib/test-utils/` gone; zero `@/lib/test-utils` imports remain; full run passes with
the SAME file/test count as the post-S1 ledger.

## Verification

Baseline commands; record pre/post test counts in this file.
