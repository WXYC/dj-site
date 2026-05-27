# SSE Tier 2 — operational behavior tests + AUTH_REWRITE_URL regression

Implements WXYC/dj-site#661 under the #664 SSE rollout epic. Tier 1 (#660, PR #665) pinned the cross-repo round-trip; Tier 2 pins the operational behaviors that fail silently rather than fail loud: polling cadence, reconnect-state transitions, and the server-side auth bug surfaced by the 2026-05-26 staging bring-up.

## Scope

Three Playwright specs plus a tiny shared helper, a runtime fix to `lib/features/authentication/server-client.ts`, and second-dj-site-instance plumbing for `scripts/e2e-local.sh` and `.github/workflows/e2e-tests.yml`.

Out of scope, filed as a follow-up: a parallel bug in `lib/features/authentication/organization-utils.server.ts:21` (`resolveOrganizationId` reads `NEXT_PUBLIC_BETTER_AUTH_URL` directly with no `AUTH_REWRITE_URL` precedence). Same shape as the `server-client.ts` bug, lives on admin pages (roster, role mgmt), not on the SSR `/dashboard/flowsheet` path test #7 exercises. Out of scope here; will file separately so the regression test for that bug isn't bundled with this one (it'd need its own admin-page E2E and an SM-storage-state fixture this PR doesn't add).

## Existing wiring to test against (from the merged Tier 1 code)

- `lib/features/flowsheet/constants.ts` — `FLOWSHEET_POLL_FAST_MS = 60_000`, `FLOWSHEET_POLL_SLOW_MS = 300_000`.
- `src/hooks/useSSEConnection.ts:useFlowsheetPollingInterval()` — returns SLOW when `selectLiveUpdatesIsConnected`, FAST otherwise. Wired into both `getInfiniteEntries` and `getNowPlaying` subscriptions in `src/hooks/flowsheetHooks.ts` and `src/widgets/NowPlaying/index.tsx`. RTK Query takes the MIN cadence across active subscribers, so every subscriber must read from this hook.
- `lib/features/flowsheet/live-updates-listener.ts` — `es.onerror` with `readyState===CONNECTING` -> `setConnectionStatusIfChanged("reconnecting")` + posthog `sse_reconnecting`; `readyState===CLOSED` -> `"closed"` + `sse_disconnected`. `es.onopen` -> `"connected"`.
- `src/components/shared/SSEConnectionIndicator.tsx` — single `<Box aria-label="Live updates: …" data-status={status}>`. Tier 1's `waitForSSEConnected` already targets the aria-label-prefixed selector.
- `e2e/helpers/pg-notify.ts` + `e2e/fixtures/sse-cdc-payloads.ts` + `e2e/helpers/sse-wait.ts` — all reused as-is from #660.

## Test 1 — `e2e/tests/sse/polling-rate.spec.ts`

Two scenarios in one file, each ~95s wall time. File-scoped serial mode + `test.setTimeout(120_000)`.

**Scenario A — SSE connected, slow cadence:**

1. Use authed storage state (`dj2.json`). Navigate to `/dashboard/flowsheet`.
2. Wait for SSE `data-status=connected` via `waitForSSEConnected`.
3. Wait for the initial `/flowsheet/get-entries` GET to land (RTK Query's first fetch on subscribe).
4. Mark `T0 = Date.now()`. Subscribe to `page.on("request")`; record every GET whose URL matches `/flowsheet/(get-entries|now-playing|latest)`.
5. `await page.waitForTimeout(90_000)`.
6. Filter recorded requests to those fired after `T0`. Assert `count === 0`.

Why this is robust: RTK Query's `pollingInterval` ticks from subscribe-time, not from last response. With SLOW=300s, the second fetch is scheduled at `subscribeAt + 300s`, well past `T0 + 90s`. Allowing a `count` of 0 (not "≤1 with slack") is correct because there's no boundary case at 90s — the next poll is 210s away from the window's right edge.

**Scenario B — SSE blocked, fast cadence:**

1. Before `goto`, `page.route("**/events/stream*", route => route.abort())` so the EventSource never connects. The Redux state stays `closed`, `useFlowsheetPollingInterval` returns FAST=60s.
2. Navigate; wait for the initial `/flowsheet/get-entries` to land.
3. Optional sanity: assert the indicator's `data-status` is one of `connecting | closed | reconnecting` (anything ≠ `connected`).
4. Mark `T0`. Same recording setup.
5. `await page.waitForTimeout(90_000)`.
6. Assert `count >= 1`. (At FAST=60s, the first poll fires at `subscribeAt + 60s`, comfortably inside a 90s window starting at `T0 ≈ subscribeAt + Δ` where Δ is the time to resolve the initial fetch — typically <1s.)

**Notes:**

- The 90s waits are intentional and called out in the spec's docstring + the issue. The whole file is ~3 min; not worth splitting fast/slow buckets for two specs.
- `page.on("request")` survives navigations within the same `page`, but each scenario uses a fresh `test()` (and therefore a fresh page), so we don't need to worry about cross-scenario leakage.

## Test 2 — `e2e/tests/sse/reconnect.spec.ts`

One test, ~10s wall time.

1. Authed `dj2.json`. Navigate to `/dashboard/flowsheet`. `ensureLive()` from `FlowsheetPage`.
2. `waitForSSEConnected`.
3. `page.context().setOffline(true)`. Native `EventSource` detects the dropped connection, fires `onerror` with `readyState=EventSource.CONNECTING`, listener dispatches `liveUpdatesConnectionStateChanged("reconnecting")`.
4. Assert `data-status=reconnecting` within 10s.
5. `page.context().setOffline(false)`. EventSource auto-retries, succeeds, `onopen` -> `"connected"`.
6. Assert `data-status=connected` within 10s.

Why `setOffline` over `page.route(..., route.abort())`: the existing long-lived EventSource connection is held open by the browser's network stack — `page.route` only intercepts *new* requests, so it can't kill the live socket. `setOffline` actively tears the stack down, which is what we need to exercise the reconnect path. Cost: the entire browser context is offline, so the dashboard's polling requests will also fail during the blackout. That's fine — the indicator is purely Redux-driven and doesn't need network to re-render.

Deferred: the issue's bullet (c) — "a `pg_notify` issued during the blackout window arrives via the 5-min safety poll" — is impractical in an E2E test (5 min wait). The cache-patch path for in-cache rows is already pinned by Tier 1 test #1; the safety-poll path will be covered by Tier 3 (#662) via the explicit refetch event. Note this deferral in the spec's docstring so a future reviewer knows it's intentional.

## Test 3 — `e2e/tests/auth/server-session-via-docker.spec.ts`

This is the trickiest. The bug only fires when `NEXT_PUBLIC_BETTER_AUTH_URL` is unreachable from inside the dj-site server process. In our existing `scripts/e2e-local.sh`, both `NEXT_PUBLIC_BETTER_AUTH_URL` and the auth service are on host-`localhost`, so the bug can't fire. We need a second build with a broken `NEXT_PUBLIC_BETTER_AUTH_URL`.

**Build & runtime config for the second instance:**

- Build: `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` (unreachable IP + port; `127.0.0.99` is a valid loopback but nothing listens, so connections fail fast with ECONNREFUSED rather than hanging).
- Runtime: `AUTH_REWRITE_URL=http://localhost:8084/auth` (the real auth, same as the primary instance).
- Port: `:3002` (primary stays on `:3001`).

**Why this is equivalent to the "auth at service-name address" scenario in the issue spec:**

- In the Docker scenario, dj-site's `localhost` is the container; `localhost:8082` resolves to the container itself, which has no auth. The container CAN reach auth at `http://auth:8082/auth` via Docker DNS.
- In the simulated scenario, dj-site's `localhost` is the host machine; `127.0.0.99:9999` is a valid loopback that nothing listens on, so connections fail. The host CAN reach auth at `http://localhost:8084/auth`.
- In both cases, `NEXT_PUBLIC_BETTER_AUTH_URL` is unreachable from the server process and `AUTH_REWRITE_URL` is reachable. The bug surface is identical: which env var does `getBaseURL()` prefer?

A docstring at the top of the test will explain this exactly so a reader doesn't think the test is bypassing the bug via host networking.

**Test body:**

1. `test.use({ storageState: DJ_STORAGE, baseURL: SECOND_INSTANCE_URL })` — points the test at `:3002`.
2. `await page.goto("/dashboard/flowsheet")`.
3. Assert `page.url()` ends with `/dashboard/flowsheet` (not `/login`, not `/login?error=...`).
4. Assert a known dashboard element is visible (e.g., the flowsheet entries container) to confirm rendered-not-just-redirected-to-similar.

**Browser-side auth verification (sanity check, not the main assertion):**

The browser-side `lib/features/authentication/client.ts:getBaseURL()` prefers `window.location.origin/auth` when `envURL`'s origin differs from `window.location.origin` (lines 18-22). Since `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` has a different origin from the browser's `http://localhost:3002`, the browser will use `http://localhost:3002/auth/*`, which the dj-site server rewrites to `AUTH_REWRITE_URL=http://localhost:8084/auth` (real auth). So browser-side auth works.

**Where the AUTH_REWRITE_URL fix lives:**

`lib/features/authentication/server-client.ts:getBaseURL()` — change:

```ts
return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "https://api.wxyc.org/auth";
```

to:

```ts
return (
  process.env.AUTH_REWRITE_URL ||
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
  "https://api.wxyc.org/auth"
);
```

with a comment that cites `next.config.mjs:7–10` so future readers see the cross-file contract. This is the change already stashed locally; applied to the worktree as part of the plan setup.

## Infrastructure changes

### `scripts/e2e-local.sh`

Add a second dj-site build + start sequence after the primary build:

```bash
echo "==> Building second dj-site (NEXT_PUBLIC_BETTER_AUTH_URL unreachable, for server-session test)..."
SECOND_FRONTEND_PORT=3002
# Same as primary, but with NEXT_PUBLIC_BETTER_AUTH_URL set to a loopback
# address nothing listens on. AUTH_REWRITE_URL (exported earlier) takes
# precedence at runtime in both the /auth rewrite and the SSR session check.
NEXT_PUBLIC_BACKEND_URL=http://localhost:$BACKEND_PORT \
NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth \
NEXT_PUBLIC_DASHBOARD_HOME_PAGE=/dashboard/flowsheet \
NEXT_PUBLIC_VERSION=e2e-broken-public-auth \
NEXT_PUBLIC_DEFAULT_EXPERIENCE=modern \
NEXT_PUBLIC_ENABLED_EXPERIENCES=modern,classic \
NEXT_PUBLIC_ALLOW_EXPERIENCE_SWITCHING=true \
NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD=temppass123 \
NEXT_PUBLIC_APP_ORGANIZATION=test-org \
NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true \
NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=true \
DJSITE_BUILD_DIR=.next-broken-auth \
npm run build  # see note below
```

The catch: `npm run build` writes to `.next/` by default. Verified Next 16 does NOT honor a `NEXT_DIST_DIR` env var, and `next build` has no `--config` flag — the config file is always loaded from cwd. Cleanest path: add a single conditional to `next.config.mjs`:

```js
const distDir = process.env.NEXT_BUILD_VARIANT === "broken-auth" ? ".next-broken-auth" : ".next";
// ...
const nextConfig = {
  // ...existing fields,
  distDir,
};
```

Then the second build is `NEXT_BUILD_VARIANT=broken-auth NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth … npm run build`, and the second start is `NEXT_BUILD_VARIANT=broken-auth PORT=3002 AUTH_REWRITE_URL=… npm run start`. The variant flag is a build-time-only signal; nothing in app code reads it. Total wall-time impact: +30–60s for the second build.

CI cache: `.github/workflows/e2e-tests.yml`'s `.next/` cache currently keys on package-lock + source files. The second build (`.next-broken-auth/`) would need its own cache entry — but it's a near-identical build, so simplest is to NOT cache it (savings on cache logic, ~30s rebuild cost on every run). The trade-off (no second-build cache vs. cache-key complexity) is logged in CLAUDE.md under E2E-only dependencies so future maintainers can revisit if E2E run frequency increases.

Export `SECOND_FRONTEND_PORT=3002` before Playwright invocation so the test can read `process.env.SECOND_FRONTEND_PORT`.

### `.github/workflows/e2e-tests.yml`

Mirror the same additions: second build step, second start step, `SECOND_FRONTEND_PORT=3002` exported to the Playwright run.

### `e2e/playwright.config.ts`

No webServer changes — both dj-site instances are started by the bash script before Playwright runs (matches current pattern for the primary instance).

## Risks

1. **Polling-rate test flake from clock jitter.** Mitigated by: (a) the SLOW cadence (300s) is way outside the 90s window, so count=0 isn't a boundary case; (b) the FAST cadence (60s) gives ~1.5 polls in 90s, so count≥1 has slack. If RTK Query introduces an initial-fetch jitter or a startup delay, the assertions still hold because they're inequality-based with comfortable margins.

2. **`setOffline` masking the reconnect indicator path.** If MUI Joy or React Strict Mode does something during offline that re-renders and clobbers the data-status attribute, the assertion would fail spuriously. Mitigated by: `selectLiveUpdatesConnectionStatus` is a plain Redux selector with no network dependency, and the indicator component has no other state. Should be stable.

3. **Second-build flake or cache miss.** A clean `.next-broken-auth/` build on every CI run adds 30-60s. Acceptable. If it turns out to be flaky (e.g., port conflicts on a busy runner), fall back to a Dockerfile-based second instance — more setup, more accurate to the original Docker bug surface.

4. **Spec-described "auth at service-name address" not literally reproduced.** The simulated `NEXT_PUBLIC_BETTER_AUTH_URL=http://127.0.0.99:9999/auth` is equivalent in failure mode but not literally Docker networking. The docstring in the test file will make this explicit so future readers don't think the test bypasses the bug. The alternative (full Docker compose for dj-site) is heavier infrastructure for the same regression coverage; deferred unless review demands it.

5. **Browser-side `client.ts:getBaseURL()` failure if window.location.origin equals `NEXT_PUBLIC_BETTER_AUTH_URL`'s origin.** That'd return the unreachable URL. Not applicable here because the browser is on `localhost:3002` and the inlined NEXT_PUBLIC is on `127.0.0.99:9999` — different origins, so the fallback to `window.location.origin/auth` kicks in. Verified by reading `lib/features/authentication/client.ts:14-31`.

## Files

- `e2e/tests/sse/polling-rate.spec.ts` (new)
- `e2e/tests/sse/reconnect.spec.ts` (new)
- `e2e/tests/auth/server-session-via-docker.spec.ts` (new)
- `lib/features/authentication/server-client.ts` (modify — AUTH_REWRITE_URL precedence; already applied from stash)
- `scripts/e2e-local.sh` (modify — second build + second start)
- `.github/workflows/e2e-tests.yml` (modify — same as e2e-local.sh)
- `CLAUDE.md` (modify — note the second dj-site instance under "E2E Testing")

No `NetworkBlocker` page object — `page.context().setOffline()` and `page.route()` are clear enough at the call sites, no abstraction win.

## Acceptance criteria

- All three new tests pass against `./scripts/e2e-local.sh`.
- E2E CI workflow passes on the PR.
- `npx tsc --noEmit` clean.
- `npm run test:run` no regressions.
- 10 repeat-each runs of the new tests, no flake.

## Cross-references

- Closes WXYC/dj-site#661
- Epic: WXYC/dj-site#664
- Depends on: #660 (merged in PR #665 — Tier 1 helpers and fixtures reused)
- Discovered (to file separately): parallel `AUTH_REWRITE_URL` precedence bug in `lib/features/authentication/organization-utils.server.ts:21`
