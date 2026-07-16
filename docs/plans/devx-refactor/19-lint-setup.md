# S19 — lint-setup

Status: pending · Risk: simple-to-moderate (Sonnet, Opus review) · PR: —
Added 2026-07-15 from charter §12/§14 (linting is a required verification step;
the repo has no lint configuration).

## Task

Add ESLint so the charter's per-slice "run linting" step is executable, and wire it
into scripts and CI.

## Current problem

No ESLint/Prettier/Biome config exists. CI's "Lint & Type Check" step runs only
`npx tsc --noEmit` (docs/ci-cd.md). The charter's slice workflow and completion
criteria require linting; today the step is vacuous.

## Desired outcome

- ESLint flat config: `eslint-config-next` (core-web-vitals) + TypeScript support.
- `npm run lint` script; CI step runs it (workflow edits must be pushed via SSH —
  tokens lack workflow scope).
- Existing violations triaged: fix mechanical/no-risk findings; for rules whose
  fixes would change behavior or create large churn, disable the rule with a
  one-line rationale in the config rather than scattering ignores. NO behavior
  changes ride this slice.
- docs/ci-cd.md and docs/development.md updated.

## Preserved behavior

All. Lint fixes must be provably behavior-neutral (unused imports, etc.); anything
ambiguous is disabled-with-rationale instead of fixed.

## Excluded scope

Prettier/formatting (separate decision, not this campaign); stylistic rule debates;
pre-commit hooks.

## Acceptance criteria

`npm run lint` exits 0 on the repo; config documents every disabled rule with a
reason; CI runs lint; subsequent slices add lint to their verification commands.

## Verification

Baseline commands + `npm run lint`; diff review confirms only lint-config,
mechanical fixes, scripts, docs, and CI changes.
