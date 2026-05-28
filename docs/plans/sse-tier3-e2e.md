# Plan: Tier 3 SSE refetch-event E2E

## Issue

[WXYC/dj-site#662](https://github.com/WXYC/dj-site/issues/662) — Tier 3 covers the `liveFs:refetch` event and the `WXYC/BackendService/SSE/ClientCount` metric. This plan is the **dj-site half** only: a single new Playwright spec that exercises Backend-Service's refetch broadcast → dj-site listener middleware's debounced cache invalidation. The Backend-Service `sse-metrics.spec.js` half lands in that repo as a separate PR and is **out of scope here** (the issue text confirms this: "the BS test lands there").

## Goal

Pin the dj-site refetch path so a regression in either (a) Backend-Service's `liveFs:refetch` envelope or (b) dj-site's `scheduleDebouncedInvalidate` wiring is caught before flag flip.

## Wire contract recap

The flow is:

```
ETL/tubafrenzy bulk-sync
  → POST /internal/flowsheet-sync-notify (X-Internal-Key: $ETL_NOTIFY_KEY)
    → serverEventsMgr.broadcast(Topics.liveFs, { type: 'refetch', payload: { source: 'etl' }, timestamp })
      → SSE frame to every liveFs subscriber
        → dj-site listener middleware: scheduleDebouncedInvalidate(['Flowsheet', 'NowPlaying']) after REFETCH_DEBOUNCE_MS (500ms)
          → RTK Query re-fires GET /flowsheet/* for any active subscriber (the dashboard's getInfiniteEntries)
```

The receiver side lives at `lib/features/flowsheet/live-updates-listener.ts:243`:

```ts
if (parsed.type === "refetch") {
  scheduleDebouncedInvalidate(listenerApi.dispatch, ["Flowsheet", "NowPlaying"]);
  return;
}
```

The Tier 3 issue body suggests `pg_notify('cdc', '<refetch payload>')` as the trigger, but that is mistaken: there is no production code path mapping a CDC event to a `liveFs:refetch` broadcast — the refetch broadcast lives behind the four `internal.route.ts` handlers (`flowsheet-sync-notify`, `flowsheet-webhook`, etc.). The test will therefore POST to `/internal/flowsheet-sync-notify` (the cleanest, side-effect-free of the four) with the shared secret.

## New file

`e2e/tests/sse/refetch-event.spec.ts` — single test, file-scoped serial mode, dj2.json storage (matches Tier 1 + Tier 2 SSE specs since dj.json is invalidated by auth/logout.spec.ts).

```ts
import { test, expect } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { waitForSSEConnected } from "../../helpers/sse-wait";
import { triggerFlowsheetSyncNotify } from "../../helpers/internal-refetch";
import { ensureOffAirInFreshContext } from "../../helpers/flowsheet-cleanup";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

test.describe("SSE Tier 3 — refetch event", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.afterAll(async ({ browser }) => {
    await ensureOffAirInFreshContext(browser, DJ_STORAGE);
  });

  test("liveFs:refetch triggers a debounced GET /flowsheet/* within 5s", async ({ page }) => {
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureLive();
    await waitForSSEConnected(page);

    // Capture the very next GET against the infinite-entries endpoint
    // *after* we fire the refetch trigger. Polling is in slow mode (60s)
    // while SSE is connected, so anything that arrives within 5s is
    // attributable to our trigger.
    const refetchResp = page.waitForResponse(
      (resp) =>
        /\/flowsheet\/?(\?|$)/.test(resp.url()) &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 }
    );

    await triggerFlowsheetSyncNotify();

    const resp = await refetchResp;
    expect(resp.ok()).toBe(true);
  });
});
```

## New helper

`e2e/helpers/internal-refetch.ts` — minimal POST helper, env-var-validated like `pg-notify.ts`:

```ts
/**
 * Fire BS's POST /internal/flowsheet-sync-notify so it broadcasts a
 * `liveFs:refetch` to every subscribed SSE client. Used by the Tier 3
 * refetch test as the trigger for dj-site's debounced invalidate path.
 *
 * Env from scripts/e2e-local.sh / the E2E workflow:
 *   E2E_BACKEND_URL — the BS origin (e.g. http://localhost:8085)
 *   ETL_NOTIFY_KEY  — shared secret BS uses to authenticate internal callers
 */
export async function triggerFlowsheetSyncNotify(): Promise<void> {
  const backend = process.env.E2E_BACKEND_URL;
  const key = process.env.ETL_NOTIFY_KEY;
  const missing: string[] = [];
  if (!backend) missing.push("E2E_BACKEND_URL");
  if (!key) missing.push("ETL_NOTIFY_KEY");
  if (missing.length > 0) {
    throw new Error(
      `triggerFlowsheetSyncNotify: missing env: ${missing.join(", ")}. ` +
        `Ensure scripts/e2e-local.sh (or the CI workflow) exports them before running Playwright.`
    );
  }

  const resp = await fetch(`${backend}/internal/flowsheet-sync-notify`, {
    method: "POST",
    headers: { "X-Internal-Key": key! },
  });
  if (!resp.ok) {
    throw new Error(
      `POST /internal/flowsheet-sync-notify returned ${resp.status}: ${await resp.text()}`
    );
  }
}
```

## Test-env wiring

Two infra files need new exports:

**`scripts/e2e-local.sh`** — add an `ETL_NOTIFY_KEY` for both Backend-Service (server) and the Playwright env (client). Place it near the existing `CDC_SECRET` block since both serve the "test-secret for an in-prod auth gate" pattern:

```bash
# Backend-Service's internal-route refetch endpoint (POST
# /internal/flowsheet-sync-notify) is gated on ETL_NOTIFY_KEY. The Tier 3
# refetch test posts with this same value to trigger a liveFs:refetch
# broadcast without going through the real ETL.
export ETL_NOTIFY_KEY=e2e-etl-notify-key
export E2E_BACKEND_URL=http://localhost:$BACKEND_PORT
```

**`.github/workflows/e2e-tests.yml`** — same two exports added to the test step's env block (alongside the existing `CDC_SECRET` carry-through).

`E2E_BACKEND_URL` is a new var; pg-notify.ts already infers its config from `DB_*` vars and doesn't need the backend URL. The new internal-refetch helper does because it's hitting BS over HTTP, not Postgres.

## Why not assert on a unique source label

The Tier 3 issue body suggests `source: e2e-${Date.now()}` for log debuggability. The current `internal.route.ts:34` hardcodes `payload: { source: 'etl' }` and does not accept a body-passed override. Plumbing a per-request source through would be a BS-side change (out of scope here) and would not strengthen the dj-site assertion — the receiver code (`live-updates-listener.ts:243`) treats every refetch identically (it never inspects `source`). The test instead observes the only causal signal that matters to the consumer: a GET /flowsheet/* request fired within the 500ms debounce window + reasonable margin.

If BS later grows a body-passed `source`, the test could be tightened to assert PostHog telemetry includes that label, but that's a follow-up.

## Why not `waitForLoadState("networkidle")`

Same reason as Tier 2's polling-rate spec (per `docs/plans/sse-tier2-e2e.md`): the SSE EventSource holds the `GET /events/stream` connection open indefinitely, so networkidle never resolves. The test uses targeted `waitForResponse` / `waitForEntriesLoaded` instead.

## Why serial mode

All SSE specs are serial-within-file because dj2.json is the only authed storage state available (dj.json is invalidated by `auth/logout.spec.ts`) and parallel workers would race the `afterAll` `ensureOffAir`. Single test in this file means serial mode has no current effect, but encoding it now prevents a future second test in this file from silently parallelising.

## Constraints honored

| Issue constraint | How it's met |
|---|---|
| "Refetch test uses a unique `source` label per run" | Not honored as stated — see rationale above. Test observes the network-level effect, which is the strongest assertion the dj-site receiver path can make. |
| "Metric test needs to wait ≥ `SSE_METRICS_INTERVAL_MS` (60s default) for the gauge to publish — gate behind a slow-CI bucket" | N/A — Backend-Service half, out of scope. |
| "Tagged appropriately so CI doesn't time out" | 60s test timeout (vs. 30s default for normal e2e specs); the actual wait budget is 5s, so the timeout is just a safety net. |

## Out of scope

- The Backend-Service `tests/integration/sse-metrics.spec.js` half (separate PR in WXYC/Backend-Service).
- Hardening source-label plumbing in `internal.route.ts`.
- Asserting PostHog telemetry shape on refetch — already covered at the unit layer in `lib/__tests__/features/flowsheet/live-updates-listener.test.ts`.

## Acceptance

- New spec passes against `scripts/e2e-local.sh` locally.
- Same spec passes in CI's E2E workflow with the new `ETL_NOTIFY_KEY` / `E2E_BACKEND_URL` exports wired through.
- `tsc --noEmit`, `vitest run`, and `next build` stay clean (no app-code changes; new file is e2e-only).
- No new dependencies (`fetch` is built into Node 22+ which the workflow already uses).
- PR body cites issue #662 and the listener-middleware line that this test exercises.

## File summary

| File | Action | Notes |
|---|---|---|
| `e2e/tests/sse/refetch-event.spec.ts` | new | The only test |
| `e2e/helpers/internal-refetch.ts` | new | HTTP POST helper, env-validated |
| `scripts/e2e-local.sh` | modify | Add `ETL_NOTIFY_KEY` + `E2E_BACKEND_URL` exports |
| `.github/workflows/e2e-tests.yml` | modify | Same exports in test step env block |
| `docs/plans/sse-tier3-e2e.md` | new | This file |
