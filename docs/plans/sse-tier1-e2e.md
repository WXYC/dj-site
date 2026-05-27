# Plan: Tier 1 SSE round-trip Playwright coverage (#660)

Implements the rollout-gate test net for the Live Updates SSE feature. Closes [WXYC/dj-site#660](https://github.com/WXYC/dj-site/issues/660), which is the hard prerequisite for [#663](https://github.com/WXYC/dj-site/issues/663) (production flag flip) under the [#664 epic](https://github.com/WXYC/dj-site/issues/664).

## Goal

Pin the cross-repo SSE round-trip — Backend-Service's PG-CDC → `metadata-broadcast` → `serverEvents` → dj-site's `live-updates-listener` → RTK Query cache → DOM — with four Playwright tests that will fail if any link silently degrades. Without this net, flipping `NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true` in production means a regression in BS-1/BS-2/BS-3/BS-4 or the dj-site listener falls back to the 60s safety poll invisibly.

## Strategy: `pg_notify` shortcut around enrichment

The plan's design discussion in [`docs/live-updates-sse.md`](../live-updates-sse.md) and [#660's body](https://github.com/WXYC/dj-site/issues/660) settled on **firing `pg_notify('cdc', '<json>')` directly to the e2e Postgres** instead of driving the full LML enrichment chain.

Rationale:
- LML is unreachable from `scripts/e2e-local.sh` (`LIBRARY_METADATA_URL=""`), so a real enrichment can never fire.
- The CDC → broadcast → SSE → DOM portion of the chain is deterministic ms-scale, so tests can use `{ timeout: 5_000 }` real time — no clock injection or `repeat-each` flake masking.
- By specifying the exact `data` payload in the test, we **pin the wire contract** instead of integrating against a moving LML output shape.

Backend-Service's `setupMetadataBroadcast` ([`metadata-broadcast.ts:86`](https://github.com/WXYC/Backend-Service/blob/main/apps/backend/services/metadata-broadcast/metadata-broadcast.ts#L86)) subscribes to the `cdc` channel and filters on:

```
event.table === 'flowsheet'
event.action === 'UPDATE'
event.data.metadata_status ∈ { 'enriched_match', 'enriched_no_match', 'failed_no_retry' }
typeof event.data.id === 'number'
```

A NOTIFY matching that filter is broadcast as a `liveFs:update` SSE event to every connected client on every BS instance (per-process LISTEN, no de-dupe needed because each client is attached to one instance).

dj-site's listener ([`live-updates-listener.ts:100`](../../lib/features/flowsheet/live-updates-listener.ts)) routes the payload through `routeUpdateEvent`: if `payload.id` is in the `getInfiniteEntries` cache it `patchEntryById`s, otherwise it debounces 500ms then invalidates the `Flowsheet` tag.

So the test recipe is:
1. Open a surface that loads `payload.id` into cache (dashboard adds + GETs; `/live` GETs `getNowPlaying`).
2. `pg_notify` an UPDATE for that row with one mutated field.
3. Assert the field renders within 5s.

## File layout

### New files

| File | Purpose |
| --- | --- |
| `e2e/tests/sse/round-trip.spec.ts` | Tests #1–3 consolidated. Single-file = single Playwright worker = no cross-file race on the shared `dj2.json` go-live state and afterAll cleanup |
| `e2e/fixtures/sse-cdc-payloads.ts` | Typed `CdcEvent` payload builders mirroring `@wxyc/database`'s `CdcEvent` |
| `e2e/helpers/pg-notify.ts` | Thin `pg.Client` wrapper for `NOTIFY` from tests |
| `e2e/helpers/sse-wait.ts` | `waitForSSEConnected` (dashboard indicator) and `waitForSSEHandshake` (`/events/stream` response) helpers |
| `lib/__tests__/features/flowsheet/sse-flags.test.ts` | Test #4a — flag-coercion unit tests |
| `src/components/shared/SSESubscription.test.tsx` | Test #4b — component-level gate unit tests |

### Modified files

| File | Change |
| --- | --- |
| `scripts/e2e-local.sh` | Export `NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true` and `..._LIVE_VIEW_ENABLED=true` for the primary build. Optionally build + serve a flag-off variant for test #4 — see "Test #4 mechanics". Export the existing `DB_*` variables to Playwright so `pg-notify` can connect. |
| `.github/workflows/e2e-tests.yml` | Same env additions. Second build step iff we keep test #4 as E2E. |
| `e2e/playwright.config.ts` | Add a second `project: "flag-off"` with a different `baseURL` for test #4 (only if we keep #4 as E2E). |
| `package.json` | Add `pg` (`^8.x`) and `@types/pg` (`^8.x`) to `devDependencies`. |

## Test #4 mechanics — the build-time-inlining tradeoff

`NEXT_PUBLIC_*` env vars are **inlined at build time** by Next.js. Tests #1–#3 need the dashboard flag ON, test #4 needs it OFF. One build cannot satisfy both.

Two practical options:

**Option A — second build (preserves the issue's intent of an E2E flag-off test):**
- `scripts/e2e-local.sh` runs `npm run build` twice with different env, into two separate directories (`.next` and `.next-flag-off`, swapped via `cp -r`/symlink dance, or build in two clones of `dj-site/`).
- A second `npm start` listens on port 3002.
- Playwright config adds a `flag-off` project with `baseURL: http://localhost:3002` that runs only `flag-off-stays-off.spec.ts`.
- CI cost: roughly +30–60s build, +5–10s server start.

**Option B — unit test + smaller-E2E fallback:**
- Add `lib/__tests__/features/flowsheet/sse-flags.test.ts` (covers `isFlowsheetSSEDashboardEnabled` / `isFlowsheetSSELiveViewEnabled`).
- Add `src/components/shared/SSESubscription.test.tsx` (covers the component-level gate — mount with flag false, assert `useSSEConnection` never runs; mount with flag true, assert it does).
- No Playwright change. CI cost: ~0.
- Tradeoff: doesn't catch a regression where the gate works but something else accidentally constructs an EventSource (e.g. a future hardcoded module). Low-probability scenario but real.

**Recommendation: Option B for this PR + leave a follow-up note in `docs/live-updates-sse.md` if we want Option A later.** The other three tests already cover the listener's connection path; a unit test on the gate is structurally adequate for the rollout-gate question ("can flipping the flag re-enable SSE?"). If review pushes back I'll switch to Option A — the second-build mechanics are mechanical, just bulky.

## `pg-notify` helper

Add `pg` (node-postgres) as a devDep. It's the standard PG client for Node and is already a transitive dep of better-auth's PG adapter, so the install footprint is negligible.

```ts
// e2e/helpers/pg-notify.ts
import { Client } from "pg";

const config = {
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5436),
  database: process.env.DB_NAME ?? "wxyc_db",
  user: process.env.DB_USERNAME ?? "wxyc_admin",
  password: process.env.DB_PASSWORD ?? "RadioIsEpic$1100",
};

export async function pgNotify(channel: string, payload: object): Promise<void> {
  const client = new Client(config);
  await client.connect();
  try {
    // NOTIFY's payload is a SQL literal — parameter binding is not allowed.
    // JSON.stringify cannot produce a backslash-escaped single quote, so SQL
    // single-quote doubling is sufficient and matches Postgres lexer rules.
    const literal = JSON.stringify(payload).replace(/'/g, "''");
    await client.query(`NOTIFY ${channel}, '${literal}'`);
  } finally {
    await client.end();
  }
}
```

Channel name is `cdc` (matches `CDC_CHANNEL` in [`Backend-Service/shared/database/src/cdc-listener.ts:28`](https://github.com/WXYC/Backend-Service/blob/main/shared/database/src/cdc-listener.ts#L28)).

## Payload fixtures

```ts
// e2e/fixtures/sse-cdc-payloads.ts
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";

/**
 * Build a CDC UPDATE payload that BS's metadata-broadcast will broadcast
 * verbatim as a liveFs:update SSE event. Mirrors @wxyc/database CdcEvent.
 *
 * BS filter requirements (apps/backend/services/metadata-broadcast/metadata-broadcast.ts):
 *   - table === 'flowsheet'
 *   - action === 'UPDATE'
 *   - data.metadata_status is a terminal state
 *   - typeof data.id === 'number'
 */
export type TerminalMetadataStatus =
  | "enriched_match"
  | "enriched_no_match"
  | "failed_no_retry";

export function buildFlowsheetUpdatePayload(
  row: Partial<FlowsheetSongEntry> & { id: number; metadata_status?: TerminalMetadataStatus }
) {
  return {
    table: "flowsheet",
    schema: "public",
    action: "UPDATE" as const,
    data: {
      ...row,
      metadata_status: row.metadata_status ?? "enriched_match",
    },
    timestamp: Date.now(),
  };
}
```

## Test #1 — `cross-dj-update.spec.ts`

```ts
test("liveFs:update patches an in-cache dashboard row within 5s", async ({ page }) => {
  const flowsheet = new FlowsheetPage(page);
  await flowsheet.goto();
  await flowsheet.waitForEntriesLoaded();
  if (!(await isLive(flowsheet))) await flowsheet.goLive();

  // Add a row (artwork_url starts empty → entry renders /img/cassette.png)
  const addResp = page.waitForResponse(
    (r) => r.url().includes("/flowsheet/") && r.request().method() === "POST" && r.status() < 300
  );
  await flowsheet.addTrack({ song: `tier1-${Date.now()}`, artist: "Juana Molina", album: "DOGA" });
  const newRow = await (await addResp).json();

  const newArtworkUrl = `https://example.org/tier1-test-1-${newRow.id}.jpg`;

  // Wait for SSE to actually be connected. Without this, a NOTIFY fired before
  // BS's setupMetadataBroadcast has any client to broadcast to is silently lost.
  await waitForSSEConnected(page);

  await pgNotify(
    "cdc",
    buildFlowsheetUpdatePayload({ id: newRow.id, artwork_url: newArtworkUrl })
  );

  const entry = page.locator(`[data-testid="flowsheet-entry-${newRow.id}"]`);
  await expect(entry.locator("img").first()).toHaveAttribute("src", newArtworkUrl, {
    timeout: 5_000,
  });
});

test.afterAll(async ({ browser }) => {
  // Reuse the entry-caching.spec.ts off-air cleanup pattern.
});
```

`waitForSSEConnected(page)` reads the `data-status` attribute on the dashboard's `<SSEConnectionIndicator>` (currently `data-status="connected"` when open — see [`SSEConnectionIndicator.tsx:35`](../../src/components/shared/SSEConnectionIndicator.tsx#L35)). If the indicator isn't rendered on the test surface, fall back to polling the Redux store via `page.evaluate(() => window.__REDUX_DEVTOOLS_EXTENSION__?...)` is too brittle; instead, listen for the actual GET `/events/stream` request via `page.waitForRequest` and a short post-handshake delay.

Use `dj2.json` for storage state (same rationale as `entry-caching.spec.ts:18`: dj.json gets revoked by `auth/logout.spec.ts`).

## Test #2 — anonymous `/live` (round-trip.spec.ts)

Two contexts in one test: an authenticated context to set up a now-playing row, and an anonymous context to observe `/live`.

```ts
test("/live anonymous viewer receives liveFs:update", async ({ browser }) => {
  const authedContext = await browser.newContext({
    storageState: path.join(authDir, "dj2.json"),
    baseURL: process.env.E2E_BASE_URL,
  });
  const authedPage = await authedContext.newPage();
  const fs = new FlowsheetPage(authedPage);
  await fs.goto();
  await fs.waitForEntriesLoaded();
  if (!(await isLive(fs))) await fs.goLive();

  const addResp = authedPage.waitForResponse(/* POST /flowsheet/ */);
  await fs.addTrack({ song: `tier1-2-${Date.now()}`, artist: "Stereolab", album: "Aluminum Tunes" });
  const newRow = await (await addResp).json();

  const anonContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL }); // no storageState
  const anonPage = await anonContext.newPage();

  const sseHandshake = anonPage.waitForResponse(
    (r) => r.url().includes("/events/stream") && r.status() === 200
  );
  await anonPage.goto("/live");
  const handshakeResponse = await sseHandshake;
  expect(handshakeResponse.headers()["content-type"]).toContain("text/event-stream");

  // Now playing GET races the page load; give it a small budget to settle.
  await anonPage.waitForResponse((r) => r.url().includes("/flowsheet/nowPlaying"));

  const newArtworkUrl = `https://example.org/tier1-test-2-${newRow.id}.jpg`;
  await pgNotify(
    "cdc",
    buildFlowsheetUpdatePayload({ id: newRow.id, artwork_url: newArtworkUrl })
  );

  await expect(
    anonPage.locator(`img[src="${newArtworkUrl}"]`)
  ).toBeVisible({ timeout: 5_000 });

  await authedContext.close();
  await anonContext.close();
});
```

## Test #3 — `full-row-payload.spec.ts`

Same shape as test 2 but with a richer payload (e.g. `release_year`, `artwork_url`, `album_title` all set) to surgically pin BS-2's "full row, not just `{id, metadata_status}`" promise. Assertion is that all three observable fields appear in the DOM. If anyone reverts the broadcast to the old `{id, metadata_status}` shape, only this test will fail loudly — tests 1/2 would still pass on the `id`-only path because the listener's `Object.assign` is shallow.

## Test #4 — `flag-off-stays-off.spec.ts`

Per the recommendation in "Test #4 mechanics" above, replace this with two unit tests:

```ts
// lib/__tests__/features/flowsheet/sse-flags.test.ts
describe("sse-flags", () => {
  it.each([
    ["true", true],
    ["1", true],
    ["false", false],
    ["", false],
    [undefined, false],
  ])("isFlowsheetSSEDashboardEnabled returns %s for env=%s", (value, expected) => {
    /* stub process.env via vi.stubEnv */
  });
  // mirror for isFlowsheetSSELiveViewEnabled
});
```

```ts
// src/components/shared/SSESubscription.test.tsx
describe("<SSESubscription>", () => {
  it("does not call useSSEConnection when surface=dashboard and flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED", "");
    const { rerender } = renderWithProviders(<SSESubscription surface="dashboard" />);
    // Inspect Redux store: refCount should be 0; no liveUpdatesConnectionRequested dispatched
  });
  // mirror for flag on (refCount === 1)
  // mirror for surface="live"
});
```

If review pushes for a true E2E flag-off test, swap to Option A from "Test #4 mechanics".

## `scripts/e2e-local.sh` changes

In the dj-site build env block (around the `NEXT_PUBLIC_VERSION=e2e` line), add:

```bash
NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true \
NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=true \
```

And before the `npx playwright test` line, export the DB connection vars so `pg-notify` can find Postgres (they're already exported earlier in the script — just need to confirm they're inherited by the Playwright subprocess):

```bash
DB_HOST=$DB_HOST \
DB_PORT=$DB_PORT \
DB_NAME=$DB_NAME \
DB_USERNAME=$DB_USERNAME \
DB_PASSWORD="$DB_PASSWORD" \
E2E_BASE_URL=http://localhost:$FRONTEND_PORT \
npx playwright test --config=e2e/playwright.config.ts "$@"
```

## `.github/workflows/e2e-tests.yml` changes

Add the two SSE flags to the workflow-level `env:` block:

```yaml
NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED: "true"
NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED: "true"
```

No DB env additions needed — `wxyc_admin` / `RadioIsEpic$1100` against `localhost:5434` are already in the workflow and inherited by every step.

## Constraints from the issue

| Constraint | How the plan satisfies it |
| --- | --- |
| Don't wait for real enrichment | `pg_notify` bypasses the worker entirely |
| Payload matches `CdcEvent` shape | `buildFlowsheetUpdatePayload` mirrors the published shape with TS types |
| Per-test row id isolation | Each test gets its row from the POST response — IDs are server-assigned and globally unique inside the run |
| `page.route()` for any interception | Only test #2 needs response observation, and that's `page.waitForResponse`, not network mocking |

## Risks

1. **Race between "row exists in cache" and "NOTIFY fires"**: if dj-site hasn't yet refetched after the POST, the listener treats the row as not-in-cache and goes the debounced-invalidate path — which works but takes 500ms longer and exercises a different code path than the cache-patch one we want to pin. Mitigation: the existing FlowsheetPage `addTrack` helper already waits for the POST response, which means the row is in the optimistic cache before we issue the NOTIFY. Test #1's NOTIFY targets the server-assigned id, which is what the cache patches into the optimistic temp row after the response — so the in-cache check passes.
2. **NOTIFY before client connects**: if `pgNotify()` fires before BS's SSE client list has the page subscribed, the message is lost (LISTEN/NOTIFY has no replay). Mitigation: `waitForSSEConnected` blocks until the handshake completes (test #1) or `waitForResponse` on `/events/stream` does the same (tests #2/#3).
3. **CI Postgres port differs from local**: CI uses 5434, local script uses 5436. The pg-notify helper reads `DB_PORT` from env — both are exported.
4. **Optimistic temp ids vs server ids**: the optimistic entry inserted before the POST resolves has a `temp_*` id. `routeUpdateEvent` checks `e.id === payload.id`, which matches only the server-assigned id. Since the test waits for the POST response before issuing the NOTIFY, the temp id has already been swapped for the real one. Verified against `entry-caching.spec.ts`'s `editEntry` flow (line 230) which depends on the same swap.
5. **`/latest` is globally scoped — `/live` may show another test's row**: `getNowPlaying` returns the most recent flowsheet entry across all shows/DJs, so parallel tests adding rows can make any "wait for *my* row on /live" assertion flake (observed under `--repeat-each=5`). Mitigation: tests #2 and #3 read whichever id `/latest` actually returns from the anon page's GET response and NOTIFY for *that*, decoupling from "did our authed POST end up as the latest." The dashboard test (#1) is immune because it queries by specific entry-id locator, not by latest.
6. **Backend-Service `CDC_SECRET` gates `startCdcListener()`**: discovered while bringing the first run up locally. `setupMetadataBroadcast()` registers a CDC callback at app start, but the only call site for `startCdcListener()` is inside `setupCdcWebSocket()`, which returns early if `CDC_SECRET` is unset. Result: with `CDC_SECRET` unset, every `pg_notify('cdc', ...)` is dropped on the floor and the SSE `liveFs:update` feature silently degrades to the 60s safety poll. This is a BS bug — `setupMetadataBroadcast` doesn't need the WebSocket secret. Worked around for now by setting a throwaway `CDC_SECRET` in both env profiles; will file a Backend-Service follow-up to split `startCdcListener` startup out of the secret-gated path.

## Test-running expectations

- `npm run test:e2e -- e2e/tests/sse/` runs all four (or three, under Option B) specs.
- `npm run test:e2e -- e2e/tests/sse/ --repeat-each=10` for flake check.
- Local-only verification command: `./scripts/e2e-local.sh e2e/tests/sse/`.
- Tests should be tagged `.serial` to avoid contention on the shared go-live state and to keep the row-id reasoning simple.

## Out of scope (deferred to other tickets in the epic)

- `polling-rate.spec.ts`, `reconnect.spec.ts`, `server-session-via-docker.spec.ts` — #661 (Tier 2)
- `refetch-event.spec.ts` — #662 (Tier 3, dj-site half)
- BS-side `sse-metrics.spec.js` — #662 (Tier 3, BS half, separate PR)
- Un-skip 3 `LIVE_FS_*` contract tests — wxyc-shared#145
- Production flag flip — #663
