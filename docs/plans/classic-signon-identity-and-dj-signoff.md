# Classic sign-on identity, and per-DJ sign-off

## Why

A DJ sat down at the control-room machine on 2026-09-08, found the previous DJ's session still open, and could not become himself. Reconstructed from the public flowsheet (`GET /flowsheet/`, all times PDT):

| Time | Event |
|---|---|
| 17:58 | show 1951321 ends (`show_end`, dj_name `Aubrey Hearst`) |
| 18:00:27 → 18:00:40 | show 1951322 `show_start` / `show_end`, dj_name `DJ Houndstooth` |
| 18:00:42 → 18:00:51 | show 1951323, same |
| 18:00:59 → 18:02:08 | show 1951324, same |
| 18:02:37 | show 1951325 `show_start`, dj_name `DJ Houndstooth` — this one sticks |
| 18:06:08 | `dj_join`, dj_name `bill b` |
| 19:07 | `djs-on-air` still returns both |

Read that back: the incoming DJ pressed "Sign on and Start the Show!" repeatedly, and every press started a show **under the departed DJ's name**, because the browser still held her session. He eventually got himself signed in — via the modern surface, the only place the site shows you who you are — and then landed on her show as a co-host. His tracks logged under her show for the rest of the shift.

Two separate defects, two repos, two fixes.

## Defect 1 — the classic sign-on screen inherits identity instead of establishing it

`src/components/experiences/classic/flowsheet/StartShow.tsx` renders *Real Name of DJ* from `useRegistry()` — the better-auth session — as a `disabled` input. On a shared browser that is whoever last signed in. The page is titled "Sign on as the on-air DJ below", so it reads as an identity form while being a read-only echo of a session the DJ can neither see the origin of nor change from this surface.

The classic surface offers no other identity signal: `Navigation.tsx` renders a bare "Log Out" link with no name attached. Modern shows the signed-in DJ next to its logout in the Leftbar, which is exactly why the reported workaround was "go to the new site look and start over, sign in and flip to classic".

## Defect 2 — nothing can sign off another DJ, by design

`leave()` (`src/hooks/flowsheetHooks.ts:285`) sends `{ dj_id: userData.id }`, hardcoded to self. That is not a client oversight: `POST /flowsheet/end` refuses anything else.

`Backend-Service/apps/backend/controllers/flowsheet.controller.ts:1085`:

```ts
// Cross-check body.dj_id against the authenticated user (BS#1102). Pre-fix
// showMemberMiddleware only checked the caller was in the show — never
// that body.dj_id matched. A guest DJ could end the entire show
// (body.dj_id = primary_dj_id) or kick a co-host (body.dj_id = co-host id).
if (!req.auth?.id || req.body.dj_id !== req.auth.id) {
  throw new WxycError('Forbidden: dj_id must match the authenticated user', 403);
}
```

So per-DJ sign-off is a Backend-Service authorization change, and it must be designed as a *narrower* capability than the one BS#1102 deliberately removed. Re-opening `dj_id`-means-anyone is not on the table.

The existing operator escape hatch, `POST /flowsheet/shows/:id/force-end` (`flowsheet: ['manage']`), ends the **whole show**. In the incident above that would have knocked the incoming DJ off air alongside the stale co-host, so it does not answer this.

## Scope split

- **A. Sign-on identity (dj-site only)** — make the classic sign-on screen state whose show it is about to start, and give a way out to the login form. Ships alone, closes the reported incident's root cause.
- **B. Per-DJ sign-off (Backend-Service first, then dj-site)** — a new authorized capability to deactivate one `show_djs` membership without ending the show. The dj-site half is a thin follow-up, unbuildable until the endpoint exists.

A does not depend on B. Land A first.

## A. Sign-on identity — decisions

1. **The nav bar is the identity treatment; the sign-on form is not.** `Navigation.tsx` gains the signed-in DJ's real name, and it renders on every classic screen — catalog, playlists, library, missing releases, rotation, MD, and the flowsheet — which is the actual gap: classic never tells you who you are, anywhere. `real_name` primary — the incident was about *who* is signed in, not their on-air handle — and a bar slot has no room for two lines.

   This goes **further than modern**, which is not the precedent it looks like: `LeftbarLogout.tsx:14–59` renders `username` / `realName` / `djName` inside a hover `Tooltip` on an icon button, so modern shows no visible identity either. "Who am I signed in as?" is unanswerable at a glance on both experiences today. Classic gets the visible treatment here because that is where the incident happened; modern's hover-only identity is a real gap and is listed Out of scope.

2. **`StartShow` gets the door, not a second name.** `classic/flowsheet/Layout/Main.tsx` renders `<Navigation />` directly above `<StartShow />` in the `!live` branch, and the form already echoes `real_name` in its disabled *Real Name of DJ* input. A third rendering of the same string on the one screen the incident was about is noise, and noise is expensive for this surface's primary user. So the sign-on screen's addition is a single action — **"Not you? Sign in as a different DJ"** — placed in the *Real Name of DJ* row, immediately after the disabled input.

   **It must be `<button type="button" className="link-button">`.** That row sits inside `<form name="userpw" onSubmit={handleStartShow}>`, so a bare `<button>` defaults to `type="submit"` and starts a show under the departed DJ's name — the exact incident this plan closes, fired by the control meant to prevent it. `catalog/MultipleArtistsDisplay.tsx:70` and `catalog/ReleaseTracklistEditor.tsx:316` are the repo idiom. That is where the wrong name is read and where the question forms; an answer anywhere else on the page is an answer to a question the DJ has already given up on.

   The residual adjacency is deliberate and mild: the bar carries it as chrome, the form field as data. Recorded here so the next reader doesn't "fix" it by deleting one.

3. **The name was never the missing piece — the door was.** Worth stating plainly, because it is what keeps A this small: the disabled input already showed "DJ Houndstooth" throughout the incident. It read as the system's fixed idea of who was at the keyboard rather than as a session anyone could end. The fix is an exit, and the assertion of identity is what the nav bar adds elsewhere.

4. **Fallback when `real_name` is absent.** `useRegistry` (`src/hooks/authenticationHooks.ts:614–617`) returns `real_name: realName || undefined` and exposes no username, so the value can be missing. The bar falls back to `dj_name`, and when both are absent omits the slot entirely rather than rendering an empty inert item — an assertive blank is strictly worse than the defect it replaces. Reaching a username would mean `useAuthentication`, not `useRegistry`; not worth a second subscription in the bar. `StartShow` needs no fallback, because its addition carries no name.

   This ordering is **component-test-only** coverage: both e2e classic identities are provisioned with `realName` identical to `djName` (`auth.setup.ts:224–247`), so no end-to-end assertion can tell the two apart.

5. **No hook changes.** `useLogout().handleLogout` is called as-is — no signature change, no `returnTo` option. It already does `clearTokenCache()` → `signOut()` → `resetApplication()` → `clearSessionAuthData()` → `router.replace("/login")`. Note `LeftbarLogout.tsx:62` binds `handleLogout` directly as a form `onSubmit`, so any positional argument added to it would arrive there as a `FormEvent`.

6. **Experience resolution is deliberately untouched.** This was the open question, and the answer is that the existing precedence is already correct in both directions.

   *Outbound:* logout does not clear the `app_state` cookie, and an unauthenticated `/login` renders from it (`createServerSideProps` overrides it only once a session resolves). On the control-room machine the cookie says classic — `useThemePreferenceSync` re-persists the active experience's canonical preference during every classic session — so the door lands on the **classic** login form.

   *Inbound:* the arriving DJ's own account `appSkin` decides their post-login experience, and that is the right authority. The account field is the *only* lever a signed-in context reads (`lib/features/session.ts:112–121`; `e2e/helpers/experience.ts` documents this), so anyone habitually in classic necessarily carries `classic-*` — there is no other way to be there. The reporter is habitually in classic; once he can sign in as himself, he gets classic. A DJ still on the provisioned `modern-light` default landing in modern is the preference system working, not a defect.

   Preferences are account-level and must not vary by machine. Both alternatives are therefore rejected: a **device pin** outranking the account reintroduces "the last occupant's choice sticks to the machine", which is the same shape as the bug being fixed; **writing `appSkin` on arrival** rewrites a preference the DJ never chose, on every device they own.

7. **Do not add a password field to the sign-on form.** It is what was literally asked for, and it is the wrong shape: a second credential surface to keep in step with `useLogin`, the OIDC bounce, onboarding, and the QR path. Decisions 1–3 answer the same need — "let the new person establish who they are before they hit on-air" — with one door instead of a parallel front. Deliberate deviation from the request; if the extra hop proves unacceptable in practice, re-auth-in-place becomes its own plan.

8. **`MusicDepartmentLogOutLink` is untouched.** `/dashboard/md` renders through classic `Layout/Main`, which carries `Navigation`, so decision 1 already puts the identity on that screen. Adding a second treatment to the menu would drift from the `mainmenu.jsp` it xeroxes for no coverage gain.

### A. Coordination note

`StartShow.tsx` changed on main today (`bc91aa9e` removed the co-host join from the classic handoff; `GO_LIVE_HANDOFF_COPY` → `GO_LIVE_HANDOFF_TAKEOVER_ONLY_COPY`). This branch is cut from `5b34dffc`, a descendant. The new action lands in the *Real Name of DJ* row, away from the prompt markup, so overlap is layout-only — re-verify against main at implementation start if more handoff work lands.

### A. Files

| Path | Change |
|---|---|
**Source**

| Path | Change |
|---|---|
| `src/components/experiences/classic/Navigation.tsx` | signed-in real name in the bar; `useRegistry` fallback per A.4; slot omitted while loading and when no name resolves |
| `src/components/experiences/classic/flowsheet/StartShow.tsx` | "Not you? Sign in as a different DJ" in the *Real Name of DJ* row |
| `src/styles/classic/wxyc.css` | `.nav-bar .nav-identity` — scoped to the bar, matching every other rule in that section; written **standalone** — it copies `.nav-disabled`'s slot metrics (line 344) rather than inheriting from them, because that rule is dead (see Out of scope) and a new rule must not be anchored to one that is about to go; plus the sign-on row's link, following the file's existing `.link-button` idiom |

**Test infrastructure** (no product behaviour; listed so the diff reads as in-scope)

| Path | Change |
|---|---|
| `e2e/fixtures/auth.fixture.ts` | receives `CLASSIC_DJ_USER` / `CLASSIC_MD_USER` |
| `e2e/auth.setup.ts` | spreads them back in, as it already does for the takeover pair |
| `e2e/pages/login.page.ts` | classic-form marker |
| `tests/integration/components/classic/{Navigation,flowsheet/StartShow,playlists/ClassicPreviousSetsSurface}.test.tsx` | mock-factory exports per A.Tests |

No hook changes. No server changes. No experience-resolution changes. No new page object and no new `data-testid` — see A.Tests item 4.

### A. Tests (TDD order)

Both component test files **already exist** — extend them, don't create parallel ones. Component tests live under `tests/integration/` (see `docs/testing.md`), and the classic mirror drops the `experiences/` segment.

1. `tests/integration/components/classic/Navigation.test.tsx` — new describe block: real name rendered in the bar; falls back to `dj_name`; slot absent when neither resolves and while the registry is loading. **Mock-factory prerequisite:** its `vi.mock("@/src/hooks/authenticationHooks")` factory (line ~18) exports only `useLogout`; add `useRegistry` first, or every existing case in the file fails on `undefined` at render and red-first fails for the wrong reason.
2. `tests/integration/components/classic/flowsheet/StartShow.test.tsx` — new describe block: the "Not you?" action renders in the *Real Name of DJ* row, calls `handleLogout`, and — the case that matters most — does **not** reach `goLive`, which the file's existing `goLiveMock` (`:8`) makes a one-line assertion. **Prerequisite mirrored:** its factory (line ~28) exports only `useRegistry`; add `useLogout`.
3. `tests/integration/components/classic/playlists/ClassicPreviousSetsSurface.test.tsx` — no new assertions, but it renders `Navigation` and its factory (line ~11) exports only `useLogout`; add `useRegistry` so the suite keeps passing. (The classic library tests mock `useAuthentication` only and render without `Navigation` — unaffected. `MusicDepartmentMenu.test.tsx` is unaffected: the menu is untouched, and the MD *page* composes `Navigation` via `Layout/Main`, which that test does not render.)
4. `e2e/tests/classic/signon-identity.spec.ts` (new) — the regression that would have caught the incident.

   **Fixture prerequisite:** `CLASSIC_DJ_USER` / `CLASSIC_MD_USER` are module-local `const`s (`e2e/auth.setup.ts:224`, `:238`), and importing that file would register its top-level `setup()` tests into the spec. Move both into `e2e/fixtures/auth.fixture.ts` and spread them back into `auth.setup.ts` — exactly what `TAKEOVER_DJ_A` / `TAKEOVER_DJ_B` already do there, for this same reason.

   **Page-object prerequisite:** `e2e/pages/login.page.ts` has no classic selectors — its username/password locators match both forms, so "assert the classic login form" would be a shape coincidence. Add a classic marker: the `.signon-card` title "Please log in to WXYC Library:".

   The flow takes **no storage state**: it signs out mid-test, and burning a shared `.json` identity's server-side session breaks every parallel spec using it — `e2e/tests/auth/logout.spec.ts:10` invalidates `dj.json`, and `rbac/role-access.spec.ts:12` documents the suite routing around it ("Use dj2.json to avoid conflicts with logout tests that use dj1"). Start unauthenticated, `setExperienceCookie(context, "classic", baseURL)` — three arguments, `baseURL` from the test fixture as `e2e/tests/rbac/role-access.spec.ts:178` does — sign in as `CLASSIC_DJ_USER` through the classic form, assert the **nav bar** names that DJ — scoped to `getByRole("navigation")` or `.nav-identity`, mirroring how `Navigation.test.tsx:86` queries by class, since the same string also renders in `StartShow`'s *Real Name of DJ* input on that screen — follow "Not you?", assert the classic login form, sign in as `CLASSIC_MD_USER`, assert the bar now names the second DJ. Both identities carry account-level classic `appSkin` from `auth.setup.ts`, and UI-minted sessions are distinct tokens from the storage-state ones, so the flow is self-contained.

   **Preconditions:** no off-air machinery — assert `StartShow`'s presence directly and let the spec fail loudly if that ever stops holding. Two facts make the guard unnecessary: `Navigation` renders in **both** branches of `classic/flowsheet/Layout/Main.tsx` (`:63` and `:71`), so the identity assertions need no off-air state at all — only the "Not you?" hop does; and nothing in the suite takes these identities live (`classicDj.json` / `classicMd.json` appear only in `rbac/role-access.spec.ts`, `classic/rotation-authority.spec.ts`, and `classic/catalog-scroll.spec.ts`, all read-only). A new page object and a new `data-testid` built for a state no spec can produce would not pay for themselves.

   **Do not reach for `FlowsheetPage`** if that guard ever becomes necessary — it is a modern-only page object: `liveStatus` (`:61`) and `goLiveButton` (`:58`) target `flowsheet-live-status` / `flowsheet-go-live-button`, and the former exists only in `modern/flowsheet/GoLive.tsx:113`. Both `CLASSIC_*` identities resolve to the classic slot from their account `appSkin`, so the spec never sees a modern flowsheet, and `ensureOffAir()` (`:206–215`) swallows its own timeout in a `try/catch` — it would silently no-op while reading as a satisfied precondition, while `leave()` would hard-fail on `expect(goLiveButton).toBeEnabled()`. Classic's own sign-off is the `<a className="label">End Show</a>` at `classic/flowsheet/Layout/Main.tsx:73–81`.

   Make the storage-state opt-out explicit rather than relying on the config default: `test.use({ storageState: { cookies: [], origins: [] } })`, as `e2e/tests/rbac/role-access.spec.ts:171` does, so a later `test.use` addition cannot quietly reintroduce a shared identity. And `e2e/playwright.config.ts:139` sets a 20s per-test default against a login → navigate → logout → login → navigate flow; set `test.setTimeout(60_000)`, as `go-live-takeover.spec.ts:37` does.

All component renders through `renderWithProviders`; fixtures from `tests/helpers`.

## B. Per-DJ sign-off — decisions

1. **New endpoint, not a loosened `/end`.** `POST /flowsheet/shows/:showId/djs/:djId/sign-off` — casing settled here rather than at implementation time; the sibling `force-end` route spells its show param `:id`, so the Backend-Service ticket must state which convention wins for the pair. Keeping `/end` as "sign myself off" preserves BS#1102's invariant literally, so the fix cannot regress by someone later relaxing a shared branch.

2. **Two authorized callers, neither of them "any show member":**
   - the show's `primary_dj_id`, removing a co-host from their own show;
   - `flowsheet: ['manage']` (musicDirector / stationManager), the surgical sibling of force-end.

   Note what this does **not** cover: the reported incident, where the incoming DJ was the *co-host* and the stale DJ was the primary. That case is answered by A (don't inherit her session) plus the takeover that already works — not by letting a guest evict an owner, which is BS#1102 verbatim. Say so in the ticket so nobody "completes" the feature later by adding it.

3. **`:showId` must name the open show, or the endpoint refuses.** `leaveShow` resolves its target through `flowsheet_service.getLatestShow()` (`flowsheet.controller.ts:1080`) and reads no route id, so without this the param is decorative and an operator could sign a DJ off a show they did not name. Compare-and-set on the id, 409 otherwise — the same consent shape `force-end` uses. Reconcile the casing with `force-end`'s existing `/shows/:id/force-end` (`flowsheet.route.ts:116`) in the same ticket.

4. **Refuse to sign off the primary.** Removing the owner is `endShow`, which already exists and has its own consent gate. A 409 naming force-end is the honest answer.

5. **Reuse `leaveShow`'s marker path** so the flowsheet gets its `dj_leave` row with the correct `play_order` and the tubafrenzy mirror stays consistent.

### B. Delivery

Backend-Service ticket first (endpoint + authorization + tests + `wxyc-shared` contract if the DTO moves), then a dj-site follow-up adding the control to the classic flowsheet and the modern admin shows page. Chained, not bundled.

## Out of scope

- Re-auth-in-place on the sign-on form (A.7).
- A co-host evicting the primary DJ (B.2).
- Any change to experience-preference precedence (A.6 — the rejected device-pin and write-on-arrival options stay rejected).
- Discoverability of the classic↔modern switch for a classic-trained DJ whose account still holds the modern default: today the only path into classic is `ExperienceGap` on a classic-only route, which nobody would find on purpose. Real gap, separate ticket.
- **Deleting `.nav-disabled`** (`src/styles/classic/wxyc.css:344`) and its guard at `Navigation.test.tsx:86`. The rule has no callers in `src/` — its one entry, Previous Sets, became a real link — so it is dead by the repo's own deletion standard. Kept out of this branch deliberately: that assertion still reads as a live regression guard ("the bar must route there rather than render dead text"), and retiring it properly means replacing it with the positive link assertion on the line above, which is a separate judgement from this fix.
- **Modern's hover-only identity** (`LeftbarLogout.tsx:14–59`). Same gap as classic's, one experience over, and invisible on touch. Its own ticket.
- Session TTL on shared machines. The QR path's 12h expiry (`docs/adr/0005`) was built for this and is still behind an off flag; a separate decision.
