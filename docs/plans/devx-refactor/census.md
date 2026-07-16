# dj-site Architectural Census (2026-07-15)

Repo: `/home/jmeade/Desktop/Projects/dj-site-worktrees/refactor-root` (read-only census).
Governing ruleset: `CLAUDE.md` (root). Domain language: `CONTEXT.md`.

## 1. Current-state architecture map

Next.js 16 App Router + React 19 + Redux Toolkit 2 / RTK Query, deployed to Cloudflare
Pages via `@opennextjs/cloudflare` (`open-next.config.ts`, `wrangler.jsonc`).

Top-level layout (measured):

| Dir | Role |
|---|---|
| `app/` | App Router routes. Two parallel-route "experiences": `@classic` and `@modern` under `app/dashboard`, `app/login`, `app/onboarding`. Route handlers under `app/api/*` (experiences, view/rightbar), `app/auth/[...path]` (better-auth proxy/handler), `app/auth/verify-email`, `app/.well-known/apple-app-site-association`. |
| `lib/` | Redux store (`lib/store.ts`), 12 feature modules under `lib/features/*` (admin, application, authentication, autoDJ, bin, catalog, experiences, flowsheet, lml, metadata, playlist-search, rotation) + `backend.ts`, `session.ts`, `session-guards.ts` (api/frontend/types/conversions per feature), `lib/posthog.ts`, `lib/csp-violation-reporter.ts`, `lib/hooks.ts` (typed useAppDispatch/Selector), `lib/createAppSlice.ts`, plus `lib/__tests__` and `lib/test-utils` (msw harnesses). |
| `src/` | All React components (`src/components/experiences/{classic,modern}`, `src/components/shared`), hook bundles (`src/hooks/*Hooks.ts`), `src/widgets/NowPlaying`, `src/Layout`, `src/styles`, `src/utilities`. |
| `tests/` | Nearly empty top-level test dir: `tests/capabilities.test.ts`, `tests/components/EmailChangeModal.test.tsx`, `tests/fixtures/`. The intended destination per CLAUDE.md; ~99% of tests are NOT here yet. |
| `e2e/` | Playwright suite (own tsconfig + config), page objects, docker-compose e2e services. |
| `scripts/` | Deploy shell scripts w/ bats tests in `scripts/__tests__`, devtools. |
| `docs/` | ADRs, architecture notes, testing docs, plans. |

State plumbing:
- Single store factory `lib/store.ts` → `makeStore()`; `combineSlices` of 7 client slices
  (authentication, application, catalog, flowsheet, liveUpdates, playlistSearch, rotation, admin)
  and 10 RTK Query APIs (applicationApi, autoDJApi, experienceApi, catalogApi, binApi,
  flowsheetApi, lmlApi, metadataApi, playlistSearchApi, rotationApi).
- One global middleware `rtkQueryErrorLogger` (lib/store.ts:89) → toast on every rejected
  query/mutation + `safeCaptureException` to PostHog.
- `liveUpdatesListenerMiddleware` (lib/features/flowsheet/live-updates-listener.ts) owns the
  module-scoped `EventSource` for SSE live updates; ref-counted via `liveUpdatesSlice`.
- Two StoreProvider implementations exist: `app/StoreProvider.tsx` and `src/StoreProvider.tsx`
  (duplicate-implementations finding, see §14/§6).

Experiences system: `lib/features/experiences/*` (registry, preferences cookie, RTK
`experienceApi` hitting local `/api/experiences` route handlers) selects `@classic` vs
`@modern` parallel route slots; theme systems per experience under
`lib/features/experiences/{classic,modern}`. Both experiences are enabled in
`EXPERIENCE_REGISTRY`; classic is a maintained alternative UI, not dead code —
`NEXT_PUBLIC_ENABLED_EXPERIENCES` / `DEFAULT_EXPERIENCE` / `ALLOW_EXPERIENCE_SWITCHING`
gates live in `lib/features/experiences/registry.ts`.

Server/client component boundaries (measured):
- 181 files carry `"use client"` (out of 383 prod TS files). `app/` itself is almost
  entirely server components: only 11 `app/` files are client (providers, slot
  switchers, flowsheet search/queue pages, reset pages, telemetry components).
- Root `app/layout.tsx` nests `<html>` inside `StoreProvider` → `PostHogProvider` →
  `ThemeRegistry` (all client); children pass through as server-rendered slots. The
  entire app is therefore inside the Redux/PostHog client boundary — PostHogProvider
  placement is the CLAUDE.md "optional provider above everything" flag (see §2.3);
  `PostHogPageView` also drags `useSearchParams` into the root.
- `server-only` correctly guards `lib/features/session.ts` / `session-guards.ts`.
- `src/ThemedLayout.tsx` is the server-side experience switch (cookie → slot); carries
  two `@deprecated` type aliases (`DashboardLayoutProps`, `LoginLayoutProps`) —
  deletion candidates.

## 2. Dependency and integration inventory

### 2.1 Backend-Service (the one sanctioned core dependency)

Access paths (all measured):

1. **`lib/features/backend.ts` → `backendBaseQuery(domain)`** — the primary path. Wraps
   `fetchBaseQuery` with `NEXT_PUBLIC_BACKEND_URL/{domain}`, JWT bearer from
   `getJWTToken()` (better-auth `/token`, 4-min module-scoped cache in
   `lib/features/authentication/client.ts`), `X-Request-Id`, and the #519/#606 non-JSON
   GET soft-fail (`{data: null}` + PostHog capture). Used by 6 API slices:
   `binApi` ("djs/bin"), `catalogApi` ("library"), `flowsheetApi` ("flowsheet"),
   `lmlApi` ("proxy"), `metadataApi` ("proxy"), `rotationApi` ("library/rotation"),
   `playlistSearchApi` ("flowsheet").
2. **SSE**: `lib/features/flowsheet/live-updates-listener.ts` opens `EventSource` on
   `${NEXT_PUBLIC_BACKEND_URL}/events/stream?topics=live-fs-topic` — module-scoped
   singleton, ref-counted by `liveUpdatesSlice`, opened/closed by listener middleware
   (ADR 0001). No auth header (EventSource limitation); public topic.
3. That is all — no other direct fetch to `NEXT_PUBLIC_BACKEND_URL` exists in prod code
   (grep-verified; e2e helpers hit it directly but that's test infra).

Failure behavior: global `rtkQueryErrorLogger` middleware (lib/store.ts:89–123) toasts
every rejected query/mutation and captures to PostHog. GET soft-fail path returns null
data instead. Primary rendering (flowsheet/catalog pages) does wait on these queries —
appropriate, since this is the sanctioned core dependency.

### 2.2 better-auth (auth service — second de-facto core dependency)

- Third-party imports confined to 3 files: `lib/features/authentication/client.ts`
  (`better-auth/react`, `better-auth/client/plugins`), `server-client.ts`
  (`better-auth/client`), plus type re-use of `@wxyc/shared/auth-client/auth`.
- BUT the `authClient` object leaks widely: consumed directly by
  `src/hooks/authenticationHooks.ts`, `adminHooks.ts`, `djHooks.ts`,
  `themePreferenceHooks.ts`, `src/components/experiences/modern/settings/*`,
  `admin/roster/*` (10+ component files call `authClient.admin.*` /
  `authClient.organization.*`). App-owned types exist
  (`lib/features/authentication/types.ts`, `lib/features/admin/types.ts` +
  `conversions-better-auth.ts`) but call sites frequently cast `as any`.
- Server side: `lib/features/session.ts` (`createServerSideProps`, React `cache()`d),
  `lib/features/session-guards.ts` (`requireAuth`), `lib/features/admin/better-auth-client.ts`
  (`verifyAdminAccess`), all via `serverAuthClient`.
- Same-origin proxying: `app/auth/[...path]/route.ts` reverse-proxies `/auth/*` to
  `AUTH_REWRITE_URL || NEXT_PUBLIC_BETTER_AUTH_URL` re-emitting each `Set-Cookie`
  (opennextjs-cloudflare#501 workaround — do NOT convert back to a rewrite).
- Failure behavior: session fetch failures are swallowed to "not authenticated"
  (session.ts catch blocks); client hooks surface toasts via `useAsyncAction`.
- Admin roster path bypasses RTK Query entirely (manual `useState`/`useEffect` in
  `src/hooks/adminHooks.ts` + module-scoped pub/sub `lib/features/admin/roster-events.ts`
  — a hand-rolled cache-invalidation bus that duplicates what RTK Query tags do).

### 2.3 PostHog (analytics + error sink) — the main CLAUDE.md-violation surface

- SDK imports of `posthog-js`: exactly 2 files — `lib/posthog.ts` (init + `safeCapture`,
  `safeCaptureException`, re-exports raw `posthog`) and
  `src/components/shared/PostHogProvider.tsx` (`posthog-js/react` `PHProvider`).
- Call sites (10 prod files): `lib/store.ts` (rtkQueryErrorLogger), `lib/features/backend.ts`
  (uses RAW re-exported `posthog.captureException` inside its own try/catch — duplicate of
  `safeCaptureException`), `lib/features/flowsheet/live-updates-listener.ts` (8 SSE events),
  `lib/features/flowsheet/infinite-cache.ts` (optimistic-replace miss),
  `lib/csp-violation-reporter.ts`, `app/global-error.tsx` (raw `posthog.captureException`),
  `app/login/LoginBounceTelemetry.tsx`, `src/hooks/authenticationHooks.ts` (login redirect).
- **PostHogProvider wraps the entire app above `<html>`** (`app/layout.tsx:48`) —
  the whole tree sits beneath an optional provider (CLAUDE.md violation in letter;
  in practice `posthog.init` no-ops without `NEXT_PUBLIC_POSTHOG_KEY` and PHProvider
  renders children regardless, so failure impact is low but the *pageview capture*
  component (`PostHogPageView`) forces `useSearchParams` into the root client tree).
- Failure behavior: good — `safeCapture*` never throw; init is guarded (no key → no-op).
- App-owned contract: partial. `safeCapture`/`safeCaptureException` in `lib/posthog.ts`
  are the de-facto contract and are the **strongest existing local pattern**; the gaps
  are (a) raw `posthog` re-export consumed by `backend.ts` + `global-error.tsx`,
  (b) `posthog-js/react` provider import in the component tree, (c) `__loaded` peek.
- Smallest appropriate contract: a `lib/telemetry` (or keep `lib/posthog.ts` name)
  module exposing `init()`, `capture(event, props)`, `captureException(err, ctx)`,
  `capturePageview(url)` — all no-op-safe; delete the raw re-export; PostHogProvider
  becomes the only adapter-aware component and stops importing `posthog-js/react`
  (the PHProvider context is only needed by `posthog-js/react` hooks, which nothing
  uses — grep shows zero `usePostHog` consumers, so PHProvider wrapper is removable).

### 2.4 Library metadata lookup (Discogs-shaped, via Backend-Service proxy)

Not a separate SDK — all metadata goes through Backend-Service `/proxy/*`, so transport
failure isolation is inherited from `backendBaseQuery`. Paths:

- `lib/features/metadata/api.ts` (`metadataApi`, domain "proxy"): `getAlbumMetadata`
  (`/metadata/album`), `getArtistMetadata` (`/metadata/artist`), `getLibraryTracks`
  (`/library/{id}/tracks`). App-owned types in `lib/features/metadata/types.ts`
  (`AlbumMetadata` with Discogs ids/urls, `ResolvedToken` for Discogs markup,
  `LibraryTracksResponse`).
- Hooks `lib/features/metadata/hooks.ts`: `useAlbumArtwork` (fallback
  `/img/cassette.png`), `useArtistMetadata`. Both skip-gated, both fail to defaults —
  good fallback behavior; rendering never blocks (artwork defaults to cassette image).
- `lmlApi` (`lib/features/lml/api.ts`): `/proxy/library/search` → `AlbumEntry[]`,
  consumed only via `src/hooks/lml/useLmlLibrarySearch.ts` (debounced 350ms).
  Anomaly: the lib-level API imports its conversion + response types from
  `src/hooks/lml/*` — dependency direction inverted (lib → src).
- Consumers of Discogs markup: `src/components/experiences/modern/Rightbar/panels/album/*`
  (`DiscogsMarkupRenderer.tsx`, `AlbumCard`, `Tracklist`, `StreamingLinks`).
- SSE `liveFs:update` events deliver LML enrichment results (see CONTEXT.md);
  `lib/features/flowsheet/deferred-refetch.ts` does a surgical one-shot now-playing
  refetch 2s after adds to pick up enrichment without invalidating all pages.

### 2.5 Auto-DJ orchestrator (separate service)

- `lib/features/autoDJ/api.ts`: own `fetchBaseQuery` at
  `NEXT_PUBLIC_ORCHESTRATOR_URL/api/auto-dj`, same JWT. `orchestratorBaseQuery`
  swallows ALL errors to `{data: undefined}` so the 10s poll can never toast or
  reach PostHog. Skip-gated when env unset (`lib/features/autoDJ/flags.ts`).
- Consumers: `lib/features/autoDJ/hooks.ts` (`useAutoDJStatus`, `useAutoDJActive`) →
  `AutoDJBanner.tsx`, `AutoDJGreyscale.tsx`. Types from `@wxyc/shared/auto-dj`.
- **This is the strongest existing fail-open adapter pattern in the repo** — silent
  degradation, feature-gate on config, no rendering dependency, poll deduped by RTK.
  Recommend it as the repository standard for optional-service slices.

### 2.6 Audio stream (ibiblio)

- `src/widgets/NowPlaying/{index,Main,Mini,GradientAudioVisualizer}.tsx`: `new Audio`
  / `AudioContext` against `https://audio-mp3.ibiblio.org` (constant `AUDIO_SRC` in
  `src/widgets/NowPlaying/index.tsx`; also hard-coded in next.config.mjs CSP).
  Browser-API integration, fails open (no playback), no app-owned contract needed
  beyond the constant.

### 2.7 Local Next route-handlers acting as micro-services (cookie state)

- `/api/view` (GET app_state cookie), `/api/view/rightbar` (POST toggle) ←
  `applicationApi`.
- `/api/experiences/{active,switch,preferences}` ← `experienceApi`.
- Same-origin, part of the app; failure behavior is RTK default (global toast).

### 2.8 Dead dependencies (0 prod imports, grep-verified)

`@uidotdev/usehooks`, `webcrypt-session`, `jose`, `cookie`, `react-fast-marquee`.
(`server-only` is used via bare import in session/session-guards; `jwt-decode` used in
2 files; `qrcode.react` in QRCodeForm; `motion` in 6 flowsheet files.)

### 2.9 Telemetry / error-reporting summary

- Error sinks: PostHog exceptions (`capture_exceptions: true` + explicit calls);
  `app/global-error.tsx` (root error boundary → posthog + reload button);
  `lib/csp-violation-reporter.ts` (securitypolicyviolation → `csp_violation` event,
  installed in PostHogProvider effect; sampled? no — dedupe via Set of directive+URI).
- Toast layer: `sonner` (19 prod files + the global RTK middleware).
- No Sentry or other APM. CSP is Report-Only (next.config.mjs, #631).

### 2.10 `@wxyc/shared`

Wire DTOs/validation/auto-dj types; imported by 20 lib files + 10 component files.
Component-level imports of `@wxyc/shared/dtos` (e.g. classic `EntryForm.tsx`,
`BreakpointButton.tsx`, `TalksetButton.tsx`) bypass the feature-module type layer;
minor dependency-direction wart, not a failure-isolation issue.

## 3. Hook-performance audit (per bundle)

Hook bundles live in `src/hooks/` (feature bundles) + `src/hooks/lml/` + a few
component-adjacent hooks (`usePlayNow.ts`, `useBinEntryActions.ts`) + lib-level hooks
(`lib/features/{autoDJ,experiences,metadata}/hooks.ts`, `src/hooks/themePreferenceHooks.ts`).

### flowsheetHooks.ts (682 lines) — flowsheet domain, the hot path
- **useShowControl**: live/currentShow via `whoIsLive` (60s poll) +
  `getInfiniteEntries` (SSE-aware poll), both already narrowed with
  `selectFromResult` to primitives (deliberate, documented — this hook runs per row).
  Mutations joinShow/leaveShow. GOOD pattern; the per-row narrowing +
  `NO_MUTATION_STATE` (`selectFromResult: () => ({})`) is the **strongest local
  subscription-hygiene pattern**; recommend as standard.
- **useFlowsheet**: full entries subscription; flatten+dedupe+sort memo, partition
  memo. Fine at page level; docs warn against row-level use.
- **useFlowsheetActions**: mutation callbacks only, stable identities. GOOD.
- **useFlowsheetPagination**: narrowed pagination-only subscription. GOOD.
- **useFlowsheetSearch vs useFlowsheetSubmit**: DUPLICATED work — both
  independently subscribe to bin+catalog+rotation+LML search sources and both
  contain byte-similar `lmlResults` dedupe memo and `allSearchResults` cap/concat memo
  (lines 194–216 vs 561–585). Both mount simultaneously in the searchbar tree →
  double memo computation and double LML/catalog subscriptions (RTK dedupes the
  network fetch, but the derived-array work and re-renders double). Likely-unnecessary
  work: extract one `useFlowsheetSearchResults()` source of truth.
- **useQueue**: 3 effects — localStorage load-on-mount (justified external sync),
  logout-transition clear, and two-consecutive-settled-off-air clear (#644 —
  necessarily effectful, well-commented). `useWhoIsLiveQuery` 3rd subscription here
  (also in useShowControl via useFlowsheetSearch chain) — all share one poll.
- **useFlowsheetSubmit**: document-level keydown/keyup listeners per mount (searchbar
  only, OK), ref+state mirror for ctrl key (justified race, documented).
- `selectFlowsheetMutationPending` iterates `state.flowsheetApi.mutations` on every
  store notify for subscribers of `useFlowsheetSaving` — allocation-free `some`, OK,
  but reaches into RTKQ internals (fragile across RTK upgrades).

### catalogHooks.ts (410 lines) — catalog query builder + flowsheet autofill
- `useCatalogQuerySearch`: pure slice state + 14 `useCallback`-wrapped dispatchers
  (mostly unnecessary memoization per CLAUDE.md; components could take dispatch
  directly, but harmless). Returns `dispatch` and the whole `catalogSlice` object —
  leaky API.
- `useCatalogQueryResults`: infinite query with derived filter; contains a
  fetch-next-page auto-drain effect for the client-side rotation filter (justified —
  server can't filter by bin yet). Memo hygiene good.
- `useCatalogFlowsheetSearch` / `useRotationFlowsheetSearch`: skip-gated, derive from
  `flowsheetSlice.getSearchQuery`. Rotation search subscribes to full `getRotation`
  then filters client-side per keystroke (`filterBySearchTerms`) — acceptable
  (rotation list is small) but runs in 2 hooks × 2 mounted bundles (search + submit).

### authenticationHooks.ts (730 lines) — login/session flows
- `useAuthentication`: **mirrored server state** — copies `authClient.useSession()`
  into `useState` via effect to await the async org-role fetch (#612). Every consumer
  (there are many: every guard, registry, catalog hooks, etc.) gets its OWN copy of
  this state + its own org-role fetch effect per mount. `useRegistry` builds `info`
  object without memo → new object identity every render, feeding dependency arrays
  in flowsheetHooks/binHooks callbacks (invalidates `useCallback` stability). This is
  the single highest-leverage hook to fix (share via context or move role into RTKQ).
- `useLogin`/`useOTPVerify`/`useNewUser`/`useResetPassword`/`useLogout`: imperative
  flows on `useAsyncAction`; `useEffect(() => dispatch(reset()), [])` with missing
  dep warnings (intentional mount-only). `confirmSessionVisible` poll loop (5×150ms,
  2s timeout) — justified, heavily documented (no-session race).
- `useDeviceAuthorization`: RFC 8628 QR polling via setTimeout chain; cancellation
  handled; restart nonce pattern. Sound.

### binHooks.ts (128 lines)
- `useBinMutation` helper: toast-on-error via `useEffect([result])` — effect dep is
  the whole `result` object → effect re-runs every render during a mutation; benign
  but an unnecessary-effect smell (toast could live in the callback's `.catch`).
- `useClearBin`: N parallel deletes (no bulk endpoint), `Promise.allSettled`,
  local `pending` state (justified, documented).
- `useBinResults`: full-bin client-side filter per keystroke — small data, OK.

### adminHooks.ts (117 lines) — roster
- `useAccountListResults`: hand-rolled server-state management (useState accounts +
  isLoading + error + `useEffect(fetchAccounts)`), bypassing RTK Query entirely;
  paired with module pub/sub `roster-events.ts` for invalidation and a
  `listMembers({limit: 1000})` secondary fetch per page load. Contains embedded
  better-auth JSON-string workaround diagnostics (4 console.warns). This is the
  weakest server-state pattern in the repo; candidate for RTK Query api-slice
  (`createApi` with `queryFn` calling authClient) — but admin-only surface, low risk,
  do late.

### playlistSearchHooks.ts (266 lines)
- `usePlaylistSearch`: lazy query + accumulated results in state + 3 coordinated
  effects (reset-on-param-change, accumulate-on-data, fire-on-change with in-flight
  deferral) with declared ordering invariant between effects (#604, #623). This is an
  effect-chain per CLAUDE.md but each link is documented and bug-numbered; it
  reimplements what RTK `infiniteQuery` now provides (catalogApi already uses
  `builder.infiniteQuery` — the **stronger local pattern**). Migration candidate,
  but behavior-sensitive (cursor vs page semantics).

### themePreferenceHooks.ts (242 lines)
- `useThemePreferenceSync`: the most complex effect in the repo — 6 refs, promise
  chain serialization, self-heal persistence, and a conditional
  `window.location.reload()`. All (#611) justified by Joy CssVars limitation
  (documented in memory too: reload-only theme repaint). High-risk area; touch last.
- Persistence spans 3 stores: localStorage + app_state cookie (via experienceApi
  mutation) + better-auth user record — deliberate 3-tier fallback.

### useSSEConnection.ts / sse-flags.ts / live-updates-*
- `useSSEConnection`: ref-count dispatch on mount/unmount. Minimal, correct.
- `useFlowsheetPollingInterval`: two narrow selectors; poll suspension while dragging.
  GOOD — cited as the standard for coordinated polling.
- `SSESubscription.tsx` (shared component) gates by surface flag; used by
  `app/live/page.tsx` and dashboard flowsheet.

### lml/useLmlLibrarySearch.ts (84 lines)
- Debounce state + skip logic + live-args result gating (#625). Sound; duplicate
  debounce implementations exist though (`useDebouncedValue.ts` vs inline timer here
  vs `adminHooks` usage of useDebouncedValue).

### Small hooks
- `useAsyncAction`: loading/error/toast wrapper — clean, widely used; keep as standard.
- `useCanEditCatalog`: JWT-decode role check with mirrored state + effect; overlaps
  `useAuthentication`'s org-role fetch (two independent role paths — JWT claim vs
  org-membership API). Consolidation candidate with the auth ownership fix.
- `useMediaQuery`, `useDebouncedValue`, `useShiftKey` (in applicationHooks),
  `useWindowSize` (applicationHooks; boilerplate comments), `useGhostText`,
  `usePublicRoutes` (trivial; `useMemo` over an includes — unnecessary memo).
- Dead: `lib/features/experiences/hooks.ts` — `useActiveExperience`,
  `useExperienceConfig`, `useIsExperience`, `useExperienceFeatures` have **zero
  consumers** (grep-verified) and `useActiveExperience` reads
  `state.application.experience`, a key that does not exist on
  `ApplicationFrontendState` (would always return "modern"). Delete.

### Duplicated/overlapping server state (measured)
1. **Rightbar mini**: `applicationApi.getRightbar` (cookie via `/api/view`) consumed by
   `RightbarMiniSwitcher.tsx`, `NowPlayingContent.tsx`; `applicationSlice.rightbar.mini`
   (+`setRightbarMini`) exists in Redux with `getRightbarMini` selector — two owners of
   the same concept (Redux copy appears write-only/vestigial in the mini case; panel and
   sidebarOpen are genuinely Redux-owned).
2. **Experience id**: SSR cookie (`createServerSideProps` → layout props) AND
   `experienceApi.getActiveExperience` (client re-fetch of the same cookie) AND the dead
   `useActiveExperience` Redux read. Three read paths, two live.
3. **Library search**: 4 sources for one search box (bin/rotation/catalog/LML) — by
   design (different corpora), but the merge/cap/dedupe pipeline is duplicated in two
   hooks (see flowsheetHooks above).
4. **User/role**: better-auth session (client hook) + org-role fetch (`useAuthentication`
   per-mount state) + JWT-claim role (`useCanEditCatalog`) + SSR session
   (`createServerSideProps`). Four resolution paths for authorization.
5. Duplicate test pairs: `src/utilities/closesthour.test.ts` vs
   `src/utilities/__tests__/closesthour.test.ts` (both run; differ), same for
   `stringutilities`; `app/StoreProvider.tsx` is a byte-identical unimported duplicate
   of `src/StoreProvider.tsx` (only src/ is imported, app/layout.tsx:2).

## 4. Test-migration map

Current state (measured):
- 272 vitest test files total under `app/`, `lib/`, `src/`, `tests/`.
  - 168 colocated beside source (`Foo.test.tsx` next to `Foo.tsx`) — dominant in `src/`.
  - 102 in `__tests__/` directories — dominant in `lib/` (`lib/__tests__` mirrors
    `lib/features/*`), plus `src/hooks/__tests__`, scattered component `__tests__`,
    and `app/**/__tests__` for route handlers.
  - 2 already in top-level `tests/` (`tests/capabilities.test.ts`,
    `tests/components/EmailChangeModal.test.tsx`) + `tests/fixtures/charset-torture.json`.
- 26 Playwright specs in `e2e/tests/{admin,auth,catalog,flowsheet,onboarding,rbac,settings,sse}`
  — already organized by semantic feature; own config/tsconfig; leave in place (or
  alias later — CLAUDE.md names `tests/e2e` but e2e/ already satisfies the intent;
  moving it churns playwright.config paths, docker scripts, CI; recommend keeping
  `e2e/` and treating `tests/` as the vitest hierarchy, or move LAST as a mechanical
  slice).
- 3 bats suites in `scripts/__tests__/deploy/*` (runner: `npm run test:scripts`);
  shell-script tests, keyed to `scripts/deploy/*`; leave with scripts.

Runner assumptions that make migration cheap:
- `vitest.config.mts` includes `**/*.test.{ts,tsx}` from the repo root — tests can move
  anywhere without config changes; only intra-file relative imports need updating
  (most tests already import via the `@/` alias; colocated ones use `./`).
- `vitest.setup.ts` is global (msw server, env pinning, localStorage/matchMedia mocks).
- Coverage excludes `**/__tests__/**` and `**/test-utils/**` — update excludes when
  `lib/test-utils` moves to `tests/helpers`.

Proposed `tests/` hierarchy (preserves semantic discoverability; mirrors source paths
under a purpose bucket):

```
tests/
  unit/
    lib/features/<feature>/…      ← from lib/__tests__/features/** and colocated lib tests
    lib/{posthog,store,csp-violation-reporter,next.config}.test.ts
    hooks/…                       ← from src/hooks/*.test.ts + src/hooks/__tests__/**
    utilities/…                   ← from src/utilities (drop the 2 duplicate pairs)
  integration/
    components/<experience>/<feature>/…  ← component tests using renderWithProviders+msw
    routes/…                      ← app/api/** and app/auth/** __tests__ (route handlers)
    app/…                         ← page-level tests (app/**/page.test.tsx, layout switchers)
  contract/
    charset-torture.test.ts       ← lib/__tests__/charset-torture.test.ts (fixture-hash based)
    transformResponse-soft-fail.test.ts, soft-fail.test.ts (wire-shape contracts)
  fixtures/                       ← tests/fixtures (already exists) + lib/test-utils/fixtures.ts data
  helpers/                        ← lib/test-utils/* (render, harnesses, msw, time)
  fakes/                          ← msw handlers (lib/test-utils/msw) if split from helpers
  e2e/                            ← optionally alias/move e2e/ last; otherwise leave e2e/ top-level
```

Mapping rules (mechanical): `lib/__tests__/features/X/Y.test.ts` →
`tests/unit/lib/features/X/Y.test.ts`; `src/components/**/Z.test.tsx` and
`src/components/**/__tests__/Z.test.tsx` → `tests/integration/components/**/Z.test.tsx`;
`src/hooks/*.test.ts*` → `tests/unit/hooks/`; `app/**/__tests__/*` →
`tests/integration/routes|app/`. The unit/integration line: pure-function and
slice/api-harness tests → unit; anything rendering React or exercising route handlers
with msw → integration. `lib/test-utils/index.ts` keeps its barrel so the `@/lib/test-utils`
import specifier can be preserved via a re-export shim during migration or a codemod
to `@/tests/helpers` (prefer the codemod; delete shim same slice).

## 5. Comment-reduction audit

Measured across 383 production files (32,905 lines): 3,115 comment lines (9.5%).
143 comment lines carry issue refs (#NNN) — most encode real invariants/races and are
the kind CLAUDE.md says to KEEP (concise, non-obvious reason). ~60 lines match pure
narration patterns (`// Get/Set/Add/Check/Handle/... X`).

Highest-density offenders (comment-lines / file-lines, non-test):
1. `src/hooks/authenticationHooks.ts` — 145/730. Mix: long JSDoc essays on
   `confirmSessionVisible`/`redirectAfterAuth` (compress, keep the race + telemetry
   rationale), inline narration (`// Get JWT token from better-auth /token endpoint`).
2. `src/hooks/flowsheetHooks.ts` — 93/682. Perf-rationale comments are valuable;
   step-narration (`// Load queue from localStorage on mount`, `// Combine both
   keyboard listeners into one effect`) removable.
3. `app/auth/verify-email/route.ts` — 84/212 (40%). Likely essay-style; compress.
4. `lib/features/authentication/organization-utils.ts` — 71/260.
5. `src/hooks/playlistSearchHooks.ts` — 60/266 (ordering invariants: keep, tighten).
6. `lib/features/authentication/server-utils.ts` — 60/197.
7. `lib/features/backend.ts` — 56/151 (soft-fail policy docs: keep most; it IS the
   contract documentation).
8. `lib/features/catalog/conversions.ts` — 54/162.
9. `src/hooks/themePreferenceHooks.ts` — 53/242 (#611 saga; keep invariants, cut history).
10. `src/components/.../flowsheet/Entries/tableStyles.tsx` — 50/123 (decorative/section
    comments in style files).
Also: `applicationHooks.ts` `useWindowSize` carries tutorial-style boilerplate comments
(`// Add event listener`, `// Remove event listener on cleanup`) — pure narration.

Policy for the campaign: comment reduction happens per-slice on touched files (CLAUDE.md
change discipline), not as one repo-wide sweep; exception — one dedicated slice for the
top-10 files above that no other slice touches.


## 6. Highest-risk behavior-preservation areas

Ranked; each encodes hard-won bug fixes (issue numbers in comments + tests):

1. **SSE live-updates pipeline** — `lib/features/flowsheet/live-updates-listener.ts`,
   `live-updates-slice.ts`, `infinite-cache.ts`, `deferred-refetch.ts`,
   `useSSEConnection.ts`. Invariants: single EventSource; ref-count transitions;
   reconnect → coarse invalidate (#682/#685); update events patch caches without
   refetch; unknown-id → debounced invalidate; benign handshake frames dropped (#673);
   `hasEverConnected` ordering. e2e: `e2e/tests/sse/*` (3 specs) + unit tests.
2. **Flowsheet mutation/optimistic layer** — `lib/features/flowsheet/api.ts`
   (joinShow optimistic patch #619/#621, addToFlowsheet, switchEntries), `reorder.ts`,
   drag pipeline (`setIsDragging` suspends polling), queue clear gating (#644),
   album-linkage sanitization (#702/#703/#704). Play-order monotonicity contract.
3. **Login/session flows** — `authenticationHooks.ts`: no-session race
   (`confirmSessionVisible`), OIDC authorize resume (#836 A+B, #849), token cache
   invalidation (#596), org-role fallback (#612). e2e: `e2e/tests/auth/*` (6 specs).
4. **Auth reverse proxy** — `app/auth/[...path]/route.ts`: multiple `Set-Cookie`
   re-emission (opennextjs-cloudflare#501). Never fold back into a rewrite.
5. **Non-JSON soft-fail contract** — `lib/features/backend.ts` (#519/#606): GETs
   resolve `{data: null}`; mutations stay loud; per-endpoint opt-out. Tests:
   `lib/__tests__/features/transformResponse-soft-fail.test.ts`, flowsheet
   `soft-fail.test.ts`.
6. **Theme/experience sync** — `themePreferenceHooks.ts` (#611): serialized sync
   chain, reload-only repaint (Joy CssVars limitation), 3-tier persistence. A wrong
   change here causes reload loops.
7. **Search-result index space** — capped concat ordering shared between
   `flowsheetHooks` and `FlowsheetSearchResults` (#657): highlighted row and submitted
   entry must resolve to the same album.
8. **Global RTK error middleware semantics** — which failures toast vs stay silent
   (autoDJ swallows, backend soft-fails, everything else toasts). Changing adapter
   plumbing must not re-route optional-service errors into the toast path.

## 7. Ordered refactoring campaign

Verification baseline for EVERY slice: `npx tsc --noEmit` && `npm run test:run` &&
`npm run build` (plus named focused tests). Baseline `npx tsc --noEmit` confirmed
green during this census (exit 0, 2026-07-15). e2e (`npm run test:e2e`) where flagged.
Each slice = one PR, repo green after each. "Simple" = mechanical, suited to a smaller
model; "Risky" = architecturally sensitive, wants a stronger model + review.

**S1. dead-code-sweep** — Simple.
Touches: delete `app/StoreProvider.tsx` (byte-identical unimported dup),
`lib/features/experiences/hooks.ts` (+ its test `lib/__tests__/features/experiences/hooks.test.ts`),
`src/utilities/closesthour.test.ts` + `src/utilities/stringutilities.test.ts` (keep the
newer `__tests__/` versions), `COLOR_SYSTEM_PROGRESS.md` (stale progress doc for merged
PR #853); remove `@deprecated` aliases in `src/ThemedLayout.tsx` (update
`app/{dashboard,login,onboarding}/layout.tsx` + `src/ThemedLayout.test.tsx` to
`ThemedLayoutProps`); drop dead deps from `package.json`: `@uidotdev/usehooks`,
`webcrypt-session`, `jose`, `cookie`, `react-fast-marquee` (+ lockfile).
Invariants: no runtime path changes; experiences registry untouched.
Verify: baseline. (~300 lines, mostly deletions.)

**S2. telemetry-contract** — Risky (small but architectural).
Touches: `lib/posthog.ts` (remove raw `posthog` re-export; expose `initTelemetry`,
`safeCapture`, `safeCaptureException`, `safeCapturePageview`; keep provider-specific
types inside), `lib/features/backend.ts` (use `safeCaptureException` instead of raw
`posthog.captureException`), `app/global-error.tsx` (same),
`src/components/shared/PostHogProvider.tsx` (drop `posthog-js/react` PHProvider —
zero `usePostHog` consumers, grep-verified; keep init + pageview + CSP-reporter
install; consider renaming to `TelemetryProvider`), `lib/__tests__/posthog.test.ts`.
Invariants: telemetry never throws; init no-ops without key; pageview events unchanged
(`$pageview` with `$current_url`); RTK error middleware behavior unchanged; CSP
reporter still installed once. After this, `posthog-js` imports exist ONLY in
`lib/posthog.ts` — the CLAUDE.md adapter requirement is satisfied.
Verify: baseline + `vitest run lib/__tests__/posthog.test.ts lib/__tests__/store.test.ts
lib/__tests__/csp-violation-reporter.test.ts`; manual: dev run, confirm pageview in
network tab (or PostHog debug).

**S3. lml-module-consolidation** — Simple.
Touches: move `src/hooks/lml/{lml-conversions,types}.ts` (+tests) into
`lib/features/lml/`; `useLmlLibrarySearch` moves to `src/hooks/` root or stays as
`src/hooks/useLmlLibrarySearch.ts`; fix the inverted import in `lib/features/lml/api.ts`;
update importers (`flowsheetHooks.ts`, index barrel).
Invariants: identical debounce/skip semantics (#625, #563); wire shape unchanged.
Verify: baseline + lml tests.

**S4. tests-helpers-move** — Simple (bulk mechanical).
Touches: `lib/test-utils/**` → `tests/helpers/` (msw handlers → `tests/fakes/`,
fixture factories → `tests/fixtures/`), codemod all `@/lib/test-utils` imports
(measured: 116 files), `vitest.setup.ts` import path, `vitest.config.mts`
coverage excludes, `docs/testing.md` pointers. The codemod is one-line-per-file, so
the diff is large but uniform; treat as a moves-PR.
Invariants: no test weakened; msw lifecycle unchanged; charset fixture hash intact.
Verify: `npm run test:run` full pass with SAME test count as before the move
(record count pre/post), tsc, build.

**S5. tests-unit-move (lib)** — Simple.
Touches: `lib/__tests__/**` → `tests/unit/lib/**` (charset-torture +
soft-fail wire-shape tests → `tests/contract/`); relative-import fixes only.
Verify: baseline; test count preserved.

**S6. tests-hooks-and-utilities-move** — Simple.
Touches: `src/hooks/**/*.test.*`, `src/hooks/__tests__/**`, `src/utilities/**` tests →
`tests/unit/hooks/`, `tests/unit/utilities/`; `src/ThemedLayout.test.tsx` →
`tests/integration/app/`.
Verify: baseline; count preserved.

**S7. tests-components-move-1 (shared + widgets + Layout + classic)** — Simple.
Touches: tests under `src/components/shared`, `src/widgets`, `src/Layout`,
`src/components/experiences/classic` → `tests/integration/components/...`.
Verify: baseline; count preserved.

**S8. tests-components-move-2 (modern + app routes/pages)** — Simple.
Touches: tests under `src/components/experiences/modern`, `app/**` (`__tests__` route
tests → `tests/integration/routes/`, page/component tests → `tests/integration/app/`),
`tests/components/EmailChangeModal.test.tsx` → same bucket. After S8: zero colocated
tests remain (CLAUDE.md tests rule satisfied); consider CI grep guard.
Verify: baseline; count preserved (272 vitest files accounted for across S4–S8).

**S9. auth-session-ownership** — Risky (highest-leverage perf fix).
Touches: `src/hooks/authenticationHooks.ts` (`useAuthentication`, `useRegistry`),
likely a small provider or module-level dedupe for the org-role fetch;
`src/hooks/useCanEditCatalog.ts` (consolidate role resolution). Consumers keep the
same hook signatures.
Invariants: `authenticating` semantics (#612 cancellation), role fallback order,
`useRegistry` output shape; JWT-claim vs org-role precedence in useCanEditCatalog.
Add memoization so `info` is referentially stable.
Verify: baseline + `vitest run` on auth hook tests; e2e `auth/` + `rbac/` suites.

**S10. flowsheet-search-results-single-source** — Risky.
Touches: `src/hooks/flowsheetHooks.ts` (extract shared `useFlowsheetSearchResults`
used by `useFlowsheetSearch` + `useFlowsheetSubmit`), no component API changes.
Invariants: #657 capped index space; dedupe order bin→rotation→catalog→lml;
`MAX_VISIBLE_RESULTS` coupling with `FlowsheetSearchResults` offsets.
Verify: baseline + flowsheet hook/component tests; e2e `flowsheet/` suite.

**S11. rightbar-and-experience-read-consolidation** — Simple-to-moderate.
Touches: `lib/features/application/frontend.ts` (remove vestigial `rightbar.mini` +
`setRightbarMini`/`getRightbarMini` if truly unconsumed — re-verify), decide single
read path for experience id (SSR prop vs `experienceApi`), delete
`docs/NewExperience.md` references if APIs change.
Invariants: rightbar mini toggle persists via cookie; panel/sidebar behavior unchanged.
Verify: baseline + application/experiences tests.

**S12. bin-hooks-cleanup** — Simple.
Touches: `src/hooks/binHooks.ts` (replace toast-on-error effect with `.catch`/unwrap
in the action callback; drop whole-`result` effect dep).
Invariants: same toast messages on failure; clearBin partial-failure reporting intact.
Verify: baseline + bin tests.

**S13. admin-roster-server-state** — Risky (admin-only blast radius).
Touches: `src/hooks/adminHooks.ts` → RTK Query api slice with `queryFn` over
`authClient.admin.*` (tags replace `lib/features/admin/roster-events.ts`; delete the
bus), roster components that call `invalidateRoster()`.
Invariants: debounced search (300ms), pagination, org-role merge, better-auth
string-JSON workaround (keep, with its diagnostics compressed).
Verify: baseline + roster component tests; e2e `admin/` suite (5 specs).

**S14. comment-reduction-pass** — Simple (dedicated pass for files no earlier slice
touched).
Touches: `app/auth/verify-email/route.ts`, `lib/features/authentication/
{organization-utils,server-utils}.ts`, `lib/features/catalog/conversions.ts`,
`src/components/experiences/modern/flowsheet/Entries/tableStyles.tsx`,
`applicationHooks.ts` (useWindowSize narration), remaining top-density files.
Rule: keep issue-numbered invariant/race comments (compress); delete narration,
history, section banners. No code changes.
Verify: baseline (behavior-neutral diff review).

**S15. playlist-search-infinite-migration** — Risky, OPTIONAL (do only if the
`usePlaylistSearch` effect chain causes real defects; catalog's `builder.infiniteQuery`
is the proven local pattern to copy — cursor-based `getNextPageParam`).
Touches: `lib/features/playlist-search/api.ts`, `src/hooks/playlistSearchHooks.ts`,
playlist components.
Invariants: #604 replace-vs-append, #623 mid-flight deferral, empty-q default listing.
Verify: baseline + playlistSearch tests (412-line test file is the spec).

**S16. e2e-relocation** — Simple, OPTIONAL, LAST. Move `e2e/` → `tests/e2e/` updating
`package.json` scripts, `e2e/playwright.config.ts` relative paths, docker/CI scripts.
Only if strict CLAUDE.md layout compliance is wanted; otherwise document e2e/ as the
sanctioned location.

Sequencing rationale: S1–S3 shrink the surface before moves; S4 must precede S5–S8
(helper import paths); S9 before S10 (stable `useRegistry` identities change memo
behavior S10 depends on); S11–S13 independent after S9; S14 after all code slices so
touched-file comment work doesn't double; S15/S16 optional tail.
