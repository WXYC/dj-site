# S11 — rightbar-and-experience-read-consolidation

Status: pending · Risk: moderate (Opus) · PR: —

## Task

Remove vestigial rightbar slice state and settle on one read path for the experience id.

## Current problem

`lib/features/application/frontend.ts` carries `rightbar.mini` +
`setRightbarMini`/`getRightbarMini` that appear unconsumed (census — MUST re-verify
with fresh grep); experience id has two read paths (SSR prop vs `experienceApi`).

## Desired outcome

Vestigial state deleted if re-verified dead; a single documented read path for
experience id; `docs/NewExperience.md` updated if its described APIs change.

## Preserved behavior

Rightbar mini toggle persists via cookie; panel/sidebar behavior unchanged; theme sync
reload semantics (#611) untouched.

## Excluded scope

Theme picker/persistence internals (census risk #6); experiences registry.

## Acceptance criteria

No duplicate experience read path; deleted state grep-clean; application/experiences
tests pass.

## Verification

Baseline commands + application/experiences vitest suites. Jackson checks the rightbar
toggle at gate M4.
