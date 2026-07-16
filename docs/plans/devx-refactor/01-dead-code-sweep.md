# S1 — dead-code-sweep

Status: reviewed, PR open · Risk: simple (Sonnet) · PR: —

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

## Result

Inspected every deletion target with fresh greps before removing anything (not census
trust):

- `app/StoreProvider.tsx` vs `src/StoreProvider.tsx`: confirmed byte-identical; grep
  for `StoreProvider` across the repo showed only `app/layout.tsx` importing
  `@/src/StoreProvider`. Deleted `app/StoreProvider.tsx`.
- `lib/features/experiences/hooks.ts`: grep for `useActiveExperience` /
  `useExperienceConfig` / `useIsExperience` / `useExperienceFeatures` showed zero
  production consumers, only its own test. Confirmed `state.application` (per
  `lib/features/application/frontend.ts`) has no `experience` or `classic` key, so
  `useActiveExperience` always fell through to the `"modern"` default — dead and
  broken as the census described. Deleted `lib/features/experiences/hooks.ts` and its
  test `lib/__tests__/features/experiences/hooks.test.ts` (the test imports only from
  the deleted module and has no independent value once the module is gone).
- `src/utilities/closesthour.test.ts` / `src/utilities/stringutilities.test.ts`: not
  byte-identical to their `__tests__/` counterparts, but cover the same source modules
  with overlapping+superseded cases; the `__tests__/` versions are the newer, more
  complete suites per the slice description. Deleted the two root-level duplicates,
  kept `src/utilities/__tests__/{closesthour,stringutilities}.test.ts`.
- `COLOR_SYSTEM_PROGRESS.md`: confirmed stale (documents merged PR #853), zero
  inbound references. Deleted.
- `src/ThemedLayout.tsx` deprecated aliases (`DashboardLayoutProps`,
  `LoginLayoutProps`): grep found exactly 4 consumers —
  `app/dashboard/layout.tsx`, `app/login/layout.tsx`, `app/onboarding/layout.tsx`,
  and `src/ThemedLayout.test.tsx`. Removed both aliases from `ThemedLayout.tsx`,
  switched all four call sites to `ThemedLayoutProps`, and removed the two
  alias-specific "type exports" test cases from `ThemedLayout.test.tsx`.
- 5 dead deps (`@uidotdev/usehooks`, `webcrypt-session`, `jose`, `cookie`,
  `react-fast-marquee`): grepped for import/require statements across all
  `.ts/.tsx/.js/.mjs` files (prod and test) — zero hits for all 5. The only "cookie"
  string hits were an unrelated header-name lookup in a route test and an unrelated
  function-argument value in an auth test, not package imports. Removed all 5 from
  `package.json` `dependencies` and ran `npm install --no-audit --no-fund`; lockfile
  now has zero top-level-package entries for any of the 5 (verified via the lockfile's
  root `packages[""].dependencies`). Remaining "jose"/"cookie" lines in
  `package-lock.json` are transitive deps of `better-auth` and other retained
  packages, not top-level.

### Spec contradiction found

The slice's acceptance criteria states "test count = baseline − 2 named duplicate
files," and the campaign orchestration explicitly named only the 2 duplicate
utility-test files as the expected file-count delta. However, census §7-S1 itself
names a third test-file deletion: `lib/__tests__/features/experiences/hooks.test.ts`,
deleted alongside its now-gone source module (there is no way to leave a test file
importing a deleted module). The actual delta is **3 files fewer**, not 2. Every
removed test is individually traceable — 9 (closesthour dup) + 9 (stringutilities
dup) + 32 (hooks.test.ts) + 2 (ThemedLayout alias-export cases, file retained) = 52,
matching baseline 3,715 → post 3,663 exactly. No unexplained test-count movement.

### Verified

- `npx tsc --noEmit`: clean (exit 0), both before and after changes.
- `npm run test:run`: baseline 272 files / 3,715 tests, all passing (pre-existing
  jsdom `_location` noise during `RotationEntryFields.refetch.test.tsx` observed,
  unrelated, ignored per instructions). Post-change: **269 files / 3,663 tests, all
  passing** (−3 files / −52 tests, fully accounted for above).
- `npm run build`: succeeds, all routes generated, no errors.
- Post-deletion greps: zero references anywhere in the repo (prod + test) to
  `app/StoreProvider.tsx`, `lib/features/experiences/hooks.ts` and its exports,
  the two duplicate test files, `COLOR_SYSTEM_PROGRESS.md`, `DashboardLayoutProps`,
  `LoginLayoutProps`, or any of the 5 removed deps.

### Independent review (fresh-context, Opus)

No blocking issues; all deletions independently re-verified safe (including
string-reference surfaces: next/open-next/wrangler/vitest/playwright configs and
`scripts/`). Registry code that the deleted `hooks.test.ts` used as fixtures retains
independent coverage via `registry.test.ts`. Two advisories, both addressed:

1. The deleted duplicate `closesthour.test.ts` held the only assertion that the
   23:xx rollover increments the DATE (not just hours→0). Restored: the retained
   rollover test now asserts `getDate() === 16`.
2. `package.json` had no `name` field, so `npm install` stamps the worktree
   directory basename into `package-lock.json` (`flowsheet-dnd` → `refactor-slice`
   churn). Added `"name": "dj-site"` to stop worktree-dependent lockfile noise for
   every future slice.
