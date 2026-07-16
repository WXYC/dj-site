# S14 — comment-reduction-pass

Status: pending · Risk: simple, behavior-neutral (Sonnet) · PR: —

## Task

Dedicated comment-reduction pass over the top-density files no earlier slice touched.
No code changes.

## Current problem

3,115 comment lines across production source (9.5%); census §5 ranks the offenders.
Files owned by earlier slices (authenticationHooks S9, flowsheetHooks S10) are handled
there; the rest need one pass.

## Desired outcome

Per CLAUDE.md comment rules, applied to: `app/auth/verify-email/route.ts` (40%
density), `lib/features/authentication/{organization-utils,server-utils}.ts`,
`lib/features/catalog/conversions.ts`,
`src/components/experiences/modern/flowsheet/Entries/tableStyles.tsx`,
`src/hooks/applicationHooks.ts` (useWindowSize tutorial boilerplate),
`src/hooks/{playlistSearchHooks,themePreferenceHooks}.ts`, `lib/features/backend.ts`
(light touch — its soft-fail docs ARE the contract; keep most).

## Preserved behavior

All. Keep (compressed) every issue-numbered invariant/race comment — 143 lines carry
#NNN refs and most encode hard-won fixes. Delete narration, history, section banners,
tutorial boilerplate.

## Excluded scope

Any code edit whatsoever; files already covered by earlier slices.

## Acceptance criteria

Diff contains only comment-line deletions/compressions; every surviving comment states
a non-obvious reason, constraint, or invariant.

## Verification

Baseline commands (must be trivially green — the diff is behavior-neutral by
construction); reviewer confirms no code tokens changed.
