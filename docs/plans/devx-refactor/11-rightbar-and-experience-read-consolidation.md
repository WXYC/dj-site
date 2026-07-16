# S11 — rightbar-and-experience-read-consolidation

Status: reviewed, PR pending · Risk: moderate (Opus) · PR: —

### Independent review (fresh-context, Opus): APPROVE, no blocking findings

Write-only-state claim independently verified (every read enumerated incl. indirect
whole-slice selections — no production reader existed; the live toggle is the
cookie-backed API, untouched, its route tests unweakened). All −7 deleted assertions
covered removed surface only; the "API wins over prop" case asserted an unreachable
path (#611 reload semantics make divergence impossible within a page lifetime). Prop
threading verified server→client clean (no new client components, type-only import);
#611 reload flow read end-to-end, identical. Route deletion evidence AIRTIGHT (zero
callers anywhere; build route table confirms only /api/experiences/active gone).
Advisories for campaign close-out: dead `switchExperience` mutation (zero callers,
pre-existing) and two dead `dynamic()` imports of ColorSchemeToggle in Header files —
future cleanup candidates.

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

## Result

### Re-verification evidence (fresh greps, not census)

**Rightbar mini slice state — confirmed vestigial, removed.** Grep for
`setRightbarMini` / `getRightbarMini` / `rightbar.mini` across production, tests, and
e2e: the only production writes were the `setRightbarMini` action and the
`state.rightbar.mini = false` line inside `openPanel`; the only reads
(`getRightbarMini` selector) were in `application.test.ts` and `applicationHooks.test.ts`.
No production component reads it. The live, user-facing rightbar-mini state is the
cookie-backed RTK Query `applicationApi.getRightbar` (`/api/view` GET,
`/api/view/rightbar` POST toggle) consumed by `RightbarMiniSwitcher.tsx` and
`NowPlayingContent.tsx` — untouched, so the cookie-persistence invariant holds and its
tests (`tests/integration/routes/api/view/rightbar.test.ts`,
`tests/unit/lib/features/application/api.test.ts`) pass unweakened.

Removed from `frontend.ts`/`types.ts`: `RightbarState.mini`, the `setRightbarMini`
reducer, the `getRightbarMini` selector, the `rightbar.mini` default, and the
write-only `state.rightbar.mini = false` in `openPanel`. Behavior is identical:
because production never read the Redux copy, `openPanel` un-mini-ing it was already a
no-op (opening a panel never affected the visible cookie-backed mini state). `panel`
and `sidebarOpen` remain genuinely Redux-owned and unchanged.

### Experience read path — chosen path + rationale

The census's dead third path (`useActiveExperience` Redux read) was already gone (S1
deleted `lib/features/experiences/hooks.ts`). Two live paths remained: the SSR cookie
(`createServerSideProps().application.experience`, threaded from `RootLayout` as a
prop) and the client re-fetch `experienceApi.getActiveExperience` (`/api/experiences/active`,
reading the same cookie).

**Authoritative path: the SSR cookie prop.** Rationale: (1) server components
(`ThemedLayout` slot selection, `RootLayout`) *cannot* use a client RTK Query hook, so
the SSR read is unavoidable and already load-bearing — the client API could never be
the single path. (2) The SSR prop is the flash-prevention seed that fixed the
modern→classic appbar flicker (AppbarWrapper). (3) Experience only ever changes via
`ThemeSwitcher` → `persistPreference` (cookie) → full `window.location.reload()`
(#611 CssVarsProvider constraint), so the client re-fetch can never legitimately
diverge from the SSR prop within a page lifetime — it was a redundant round-trip.

Consolidated all client experience-id reads onto the threaded prop:
`AppbarWrapper` → `Appbar`/`AppbarClassic` → `ThemeSwitcher`/`ColorSchemeToggle`.
(The two `login/Layout/Header.tsx` `dynamic()` imports of `ColorSchemeToggle` are dead
— never rendered — so no threading needed there.) Removed the now-orphaned
`experienceApi.getActiveExperience` query + `useGetActiveExperienceQuery` export and
its sole backend, `app/api/experiences/active/route.ts` (git rm). `switchExperience`
(separately dead, zero consumers, pre-existing) left untouched as out of scope.
`docs/NewExperience.md` step 5 updated: the stale `useActiveExperience()` example now
documents the server-resolved prop as the read path.

### Counts / verification

Base ledger re-verified before changes: **269 files / 3,679 tests** (matches campaign
ledger). After: **269 files / 3,672 tests** (−7 tests, all from deleted assertions of
removed API surface: −5 rightbar-mini in `application.test.ts`, −1 `getActiveExperience`
endpoint assertion, −1 obsolete "API wins over prop" AppbarWrapper case; no test files
added or deleted). `npx tsc --noEmit` clean, `npm run lint` 0 errors, `npm run build`
succeeds (`/api/experiences/active` gone from the route table), full `npm run test:run`
green.
