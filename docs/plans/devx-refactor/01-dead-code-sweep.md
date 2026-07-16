# S1 — dead-code-sweep

Status: pending · Risk: simple (Sonnet) · PR: —

## Task

Delete verified-dead code, duplicate files, stale docs, deprecated aliases, and unused
npm dependencies.

## Current problem

Census-verified dead weight: `app/StoreProvider.tsx` is a byte-identical unimported
duplicate; `lib/features/experiences/hooks.ts` has zero consumers and its
`useActiveExperience` reads a nonexistent state key; `src/utilities/closesthour.test.ts`
and `src/utilities/stringutilities.test.ts` duplicate newer `__tests__/` versions;
`COLOR_SYSTEM_PROGRESS.md` documents merged PR #853; `src/ThemedLayout.tsx` carries
`@deprecated` aliases; `package.json` lists 5 unused deps (`@uidotdev/usehooks`,
`webcrypt-session`, `jose`, `cookie`, `react-fast-marquee`).

## Desired outcome

All of the above removed; importers of the deprecated aliases
(`app/{dashboard,login,onboarding}/layout.tsx`, `src/ThemedLayout.test.tsx`) use
`ThemedLayoutProps`; lockfile regenerated.

## Preserved behavior

No runtime path changes. Experiences registry untouched. Re-verify each deletion's
zero-consumer status before deleting (fresh grep, not census trust).

## Excluded scope

No comment reduction beyond touched files; no test moves beyond deleting the two named
duplicates; nothing else in `lib/features/experiences/`.

## Acceptance criteria

Named files gone; deps gone from package.json + lockfile; grep shows zero references
to deleted modules and aliases; test count = baseline − 2 named duplicate files.

## Verification

`npx tsc --noEmit` · `npm run test:run` · `npm run build`. Grep for each deleted
symbol/module path afterward.
