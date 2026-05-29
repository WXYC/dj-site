# Plan: dj-site subscribes to Backend-Service's liveFs SSE topic

## Summary

Wire dj-site to Backend-Service's `liveFs` SSE topic so that flowsheet updates land in the UI without waiting for the 60-second polling cycle. Two motivating cases: (1) when LML metadata enrichment finishes on a freshly-added row, that row's artwork/streaming URLs appear immediately instead of approximated by a 2-second blind timer; (2) when one DJ adds a song, another DJ's tab (and the public `/live` view) sees it within seconds via the same enrichment-driven event.

Architecture decision recorded in [`docs/adr/0001-listener-middleware-owns-sse.md`](./adr/0001-listener-middleware-owns-sse.md). Vocabulary captured in [`CONTEXT.md`](../CONTEXT.md).

## Scope of v0

- **In**: dj-site dashboards (modern + classic) and the public `/live` view subscribe to `liveFs`. The `update` event patches caches with inline row data. The `refetch` event invalidates the flowsheet cache, debounced. Connection lifecycle is ref-counted across mounted surfaces.
- **Out** (deferred to v1+): cross-tab leader election (each tab opens its own EventSource for now), reconnect-driven explicit refetch (5-minute safety poll covers gaps instead), `add`/`delete` SSE events from Backend-Service (cross-DJ visibility falls out of `update` semantics in v0), `whoIsLive` SSE (no Backend-Service emission for show/DJ state yet), Sentry adoption in dj-site (PostHog stays).

## Wire contract

All cross-repo shapes are defined in `wxyc-shared` so Backend-Service, dj-site, and any future consumer share types.

- `api.yaml` adds: `LiveFsUpdateEvent`, `LiveFsRefetchEvent`, `LiveFsEvent` union, plus the `GET /events/stream` endpoint description with `text/event-stream` response.
- `src/contracts.ts` adds named invariants (each with provider/consumer file refs in `INVARIANTS.md`):
  - `LIVE_FS_UPDATE_INCLUDES_FULL_ROW` — `liveFs:update` payload carries the full flowsheet row, not just `{id, metadata_status}`.
  - `LIVE_FS_PUBLIC_TOPIC_NO_AUTH` — `GET /events/stream?topics=live-fs-topic` accepts anonymous subscription.
  - `LIVE_FS_EVENT_ENVELOPE_SHAPE` — every event has `{ type, payload, timestamp }`.
- `tests/e2e-contracts.test.ts` adds one test per invariant that subscribes to the running stack and asserts the shape.

## Repo work breakdown

### Backend-Service PRs (sequenced; land first)

**BS-1 — `GET /events/stream` with no auth for public topics**
- Add a `GET /events/stream` route that accepts `?topics=<comma-separated>` in the query string. The values are topic **strings** (`live-fs-topic`, `test-topic`), not the JS constant names. dj-site's middleware opens `EventSource('${BACKEND_URL}/events/stream?topics=live-fs-topic')`.
- Reuse `serverEvents.registerEventClient` after parsing topics from `req.query`. Topics not present in `TopicAuthz` are silently dropped (matching existing `filterAuthorizedTopics` behavior).
- Drop `requirePermissions({ flowsheet: ['read'] })` for this route. `TopicAuthz[Topics.liveFs] = []` already encodes the intent; the route-level guard was overly broad (see the TODO in `events.route.ts:7`). Authenticated topics (`showDj`, `primaryDj`, `mirror`) remain gated via `filterAuthorizedTopics` — if a caller asks for one without `req.auth` set, it's filtered out of the subscription.
- Leave the `POST /events/register` route in place for any non-browser consumers; it's not the path browsers will use.
- Sentry: existing route auto-instrumentation covers errors.

Throughout this plan, `liveFs` (camelCase) refers to the JS constant `Topics.liveFs` and is the conventional name in conversation; `live-fs-topic` is the wire-format string value used in URLs, contract assertions, and `data:` payloads. The `wxyc-shared` contracts use the wire-format string as the source of truth.

**BS-2 — Inline row data in `liveFs:update` payload**
- Change `metadata-broadcast.ts:filterMetadataUpdate` to return the full row data from `event.data`, not just `{id, metadata_status}`.
- Document the payload shape with a TypeScript type that mirrors the `wxyc-shared` `LiveFsUpdateEvent` schema.
- Sentry: upgrade the `console.error` in `metadata-broadcast.ts` (currently around line 84 on `main` at the time of this plan, but re-check before editing) to `Sentry.captureException(err, { tags: { module: 'metadata-broadcast' }, extra: { ... } })`.

**BS-3 — `ServerEventsManager` connection-count metric**
- Emit `WXYC/Backend-Service/SSE/ClientCount` to CloudWatch as both per-topic dimensioned and dimensionless-companion series (per the org's "CloudWatch Metric & Alarm Conventions" CLAUDE.md section).
- Also emit `WXYC/Backend-Service/SSE/EventsBroadcast` (count, per topic) and `WXYC/Backend-Service/SSE/BroadcastFailures`.
- This is the prerequisite for opening `/live` to SSE — we need visibility before pointing public traffic at the SSE server.

**BS-4 — Sentry on broadcast failures in `serverEvents.ts`**
- Today's silent unsub-on-write-failure path adds `Sentry.captureException` so we see if the failure rate spikes.

### wxyc-shared PR

- Add the SSE schemas to `api.yaml` and the `CONTRACTS` entries listed above.
- Add the three contract tests to `tests/e2e-contracts.test.ts`.
- Regenerate the TypeScript types and bump `@wxyc/shared`.

### dj-site PR (single PR, feature-flagged OFF)

#### New files

**`lib/features/flowsheet/sse-flags.ts`** — two independent helpers mirroring `lib/features/catalog/flags.ts`. Each reads its own env var; build-time inlined so callers invoke at render time. The file-header comment makes the feature-vs-transport distinction explicit so a reader doesn't have to look up CONTEXT.md.

```ts
/**
 * Feature flags for Live Updates (per CONTEXT.md vocabulary). "Live updates"
 * is the feature — real-time UI refresh when the flowsheet changes. SSE is
 * the v0 transport that delivers them. Future transports (BroadcastChannel,
 * SharedWorker) would still be gated by these same flags; the file is named
 * after the v0 transport because that's the load-bearing detail for now.
 *
 * Two flags so dashboards (small, known audience) can roll out before /live
 * (unknown public audience). See docs/live-updates-sse.md.
 */

export function isFlowsheetSSEDashboardEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED;
  return v === "true" || v === "1";
}

export function isFlowsheetSSELiveViewEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED;
  return v === "true" || v === "1";
}
```

**`lib/features/flowsheet/live-updates-slice.ts`** — small slice named `liveUpdatesSlice`. "Live updates" is the feature (per `CONTEXT.md`); SSE is the transport. Built with `createAppSlice` (see `lib/createAppSlice.ts`) so selectors auto-expose via `liveUpdatesSlice.selectors.*`, matching the `flowsheetSlice.selectors.*` pattern at `lib/features/flowsheet/frontend.ts:167+`.

```ts
import { createAppSlice } from "@/lib/createAppSlice";
import type { PayloadAction } from "@reduxjs/toolkit";

type ConnectionStatus = 'closed' | 'connecting' | 'connected' | 'reconnecting';

type LiveUpdatesState = {
  connectionStatus: ConnectionStatus;
  lastEventAt: number | null;
  refCount: number; // listener-middleware bookkeeping
};

const initialState: LiveUpdatesState = {
  connectionStatus: 'closed',
  lastEventAt: null,
  refCount: 0,
};

export const liveUpdatesSlice = createAppSlice({
  name: "liveUpdates",
  initialState,
  reducers: (create) => ({
    liveUpdatesConnectionRequested: create.reducer((state) => { state.refCount += 1; }),
    liveUpdatesConnectionReleased: create.reducer((state) => {
      state.refCount = Math.max(0, state.refCount - 1);
    }),
    liveUpdatesConnectionStateChanged: create.reducer((state, action: PayloadAction<ConnectionStatus>) => {
      state.connectionStatus = action.payload;
    }),
    liveUpdatesLastEventAtUpdated: create.reducer((state, action: PayloadAction<number>) => {
      state.lastEventAt = action.payload;
    }),
  }),
  selectors: {
    selectLiveUpdatesConnectionStatus: (state) => state.connectionStatus,
    selectLiveUpdatesIsConnected: (state) => state.connectionStatus === 'connected',
    selectLiveUpdatesLastEventAt: (state) => state.lastEventAt,
    selectLiveUpdatesRefCount: (state) => state.refCount,
  },
});

export const {
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionStateChanged,
  liveUpdatesLastEventAtUpdated,
} = liveUpdatesSlice.actions;
```

**`lib/features/flowsheet/live-updates-listener.ts`** — built on `createListenerMiddleware()` from `@reduxjs/toolkit`. Owns the `EventSource` reference in a module-scoped closure (not in Redux state — the EventSource is not serializable). Three listeners:

1. `startListening({ actionCreator: liveUpdatesConnectionRequested, effect: ... })` — if `refCount` transitions 0→1, open the EventSource against `${NEXT_PUBLIC_BACKEND_URL}/events/stream?topics=live-fs-topic`. Attach `onopen`, `onmessage`, and `onerror` handlers (see EventSource lifecycle below).
2. `startListening({ actionCreator: liveUpdatesConnectionReleased, effect: ... })` — if `refCount` transitions to 0, call `eventSource.close()` and dispatch `liveUpdatesConnectionStateChanged('closed')`.
3. `startListening({ predicate: ..., effect: ... })` — on parsed `LiveFsEvent` actions dispatched by the `onmessage` handler, perform cache effects (see "Cache effect routing" below). Debouncing uses `listenerApi.cancelActiveListeners()` + `listenerApi.delay(500)` (RTK listener middleware's idiomatic debounce).

**EventSource lifecycle and ConnectionStatus mapping**

Native EventSource auto-reconnects on transient network errors with browser-managed exponential backoff (typically 3-10s). It does not give a separate "reconnecting" event; instead, `onerror` fires and `readyState` indicates intent: `0` (CONNECTING — a reconnect is in progress), `1` (OPEN — connected), `2` (CLOSED — permanently closed, no further reconnects).

We map this directly:

```ts
es.onopen = () => dispatch(liveUpdatesConnectionStateChanged('connected'));
es.onerror = () => {
  // EventSource sets readyState before firing onerror.
  // 0 = browser is retrying transparently; 2 = permanently closed.
  if (es.readyState === EventSource.CONNECTING) {
    dispatch(liveUpdatesConnectionStateChanged('reconnecting'));
  } else if (es.readyState === EventSource.CLOSED) {
    dispatch(liveUpdatesConnectionStateChanged('closed'));
    // PostHog: sse_disconnected with reason 'permanent'
  }
};
```

For v0 we keep the `reconnecting` state in the slice's `ConnectionStatus` because the dashboard indicator (Q9) needs to render yellow during it. We do **not** trigger a one-shot refetch on the `connected` → `reconnecting` → `connected` round trip in v0 — the 5-min safety poll covers gaps. Reconnect-driven explicit refetch is deferred to v1 (per Q6's staging).

**Cache effect routing**

The `update` handler must know whether the row id is in any cache before dispatching, because `patchEntryById` is a silent no-op on miss (see `lib/features/flowsheet/infinite-cache.ts:132`). Use `listenerApi.getState()` + `flowsheetApi.endpoints.getInfiniteEntries.select(undefined)` to inspect the cache before deciding the path:

```ts
const state = listenerApi.getState();
const infiniteData = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(state).data;
const nowPlayingData = flowsheetApi.endpoints.getNowPlaying.select(undefined)(state).data;

const idInCache =
  (infiniteData?.pages ?? []).some(page => page.some(e => e.id === payload.id)) ||
  nowPlayingData?.id === payload.id;

if (idInCache) {
  // Surgical patch with full row data inline. patchEntryById uses Object.assign
  // (shallow merge); since the payload IS the full row, this is effectively a
  // replace — RTK Query's Immer draft handles the immutability.
  listenerApi.dispatch(flowsheetApi.util.updateQueryData("getInfiniteEntries", undefined, draft => {
    patchEntryById(draft, payload.id, payload);
  }));
  if (nowPlayingData?.id === payload.id) {
    listenerApi.dispatch(flowsheetApi.util.updateQueryData("getNowPlaying", undefined, draft => {
      Object.assign(draft, payload);
    }));
  }
} else {
  // Unknown id — debounce + invalidate
  scheduleDebouncedInvalidate(listenerApi, ["Flowsheet"]);
}
```

For `refetch` events: always schedule the debounced invalidate (no id-in-cache check needed).

```ts
scheduleDebouncedInvalidate(listenerApi, ["Flowsheet", "NowPlaying"]);
```

RTK Query does not normalize cache data; the draft we mutate is exactly what consumers re-render against. There's no separate denormalization step that could obscure the patch.

**`src/hooks/useSSEConnection.ts`** — the ref-count request/release hook. Always called unconditionally from the wrapper component (which itself decides whether to mount based on the flag).

```ts
export function useSSEConnection(): void {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(sseConnectionRequested());
    return () => { dispatch(sseConnectionReleased()); };
  }, [dispatch]);
}
```

**`src/components/shared/SSESubscription.tsx`** — small client component that gates the hook on the appropriate flag. Returns `null`. Mountable from server-component layouts.

```tsx
"use client";
import { useSSEConnection } from "@/src/hooks/useSSEConnection";
import { isFlowsheetSSEDashboardEnabled, isFlowsheetSSELiveViewEnabled } from "@/lib/features/flowsheet/sse-flags";

type Surface = "dashboard" | "live";
export default function SSESubscription({ surface }: { surface: Surface }) {
  const enabled = surface === "dashboard"
    ? isFlowsheetSSEDashboardEnabled()
    : isFlowsheetSSELiveViewEnabled();
  if (!enabled) return null;
  return <SSESubscriptionInner />;
}
function SSESubscriptionInner() {
  useSSEConnection();
  return null;
}
```

(The inner component pattern keeps the hook call site unconditional, satisfying the rules-of-hooks lint.)

**`src/components/shared/SSEConnectionIndicator.tsx`** — small dot + tooltip listening to `selectSSEConnectionStatus`. Rendered only on dashboards (modern + classic chrome). Not rendered on `/live`.

#### Store wiring (`lib/store.ts`)

Three edits to `lib/store.ts`:

1. Import the new slice + listener (after the existing imports around line 18-30):
   ```ts
   import { liveUpdatesSlice } from "./features/flowsheet/live-updates-slice";
   import { liveUpdatesListenerMiddleware } from "./features/flowsheet/live-updates-listener";
   ```
2. Add `liveUpdatesSlice` to the `combineSlices(...)` call (currently lines 31-48). It joins the slice list alongside `flowsheetSlice`.
3. Add `liveUpdatesListenerMiddleware.middleware` to the middleware chain (currently lines 55-66, which today is a series of `.concat()` calls only). The listener must run **before** the RTK Query API middlewares in the dispatch pipeline so it can observe RTK Query actions; that requires `.prepend()` on the `getDefaultMiddleware()` result before any `.concat()` calls — the order matters.

   ```ts
   middleware: (getDefaultMiddleware) =>
     getDefaultMiddleware()
       .prepend(liveUpdatesListenerMiddleware.middleware)
       .concat(rtkQueryErrorLogger)
       .concat(applicationApi.middleware)
       .concat(experienceApi.middleware)
       // ...other API middlewares unchanged
   ```

   Builder rule: `.prepend()` can only be called before any `.concat()` on the same chain. The current `store.ts:55-66` chain uses `.concat()` exclusively (no existing `.prepend()` calls), so the new prepend slots in cleanly as the first call on the builder. TypeScript will catch any future reordering mistakes. Add a one-line comment at the `.prepend()` call so a maintainer reading the chain understands the constraint:

   ```ts
   // Listener must come first so it observes RTK Query dispatches before the
   // API middlewares process them. .prepend() is only legal before .concat().
   .prepend(liveUpdatesListenerMiddleware.middleware)
   ```

#### Mount points (one component per surface)

The wrapper component mounts in three places. All three are Next.js server-component files today. This works because Next.js App Router server components can render client-component children directly — the `"use client"` directive on `SSESubscription` only restricts where its hooks run (in the client bundle), not where it can be composed. None of the mount-point pages need to change their own server/client status.

- **Modern dashboard**: `app/dashboard/@modern/flowsheet/layout.tsx` (server component). Add `<SSESubscription surface="dashboard" />` alongside `<PageHeader>`. The layout wraps both `@entries` and `@queue` parallel routes, so the connection is held for the entire flowsheet view.
- **Classic dashboard**: `app/dashboard/@classic/flowsheet/page.tsx` (server component; currently returns `<Main />` — itself a client component at `src/components/experiences/classic/flowsheet/Layout/Main.tsx:1`). Update to `return <><SSESubscription surface="dashboard" /><Main /></>;`. The page remains a server component; both children are client components and that composition is supported.
- **Live view**: `app/live/page.tsx` (server component). Add `<SSESubscription surface="live" />` inside the page next to the existing `<NowPlaying mini={false} />`.

#### Polling adjustments

Polling slows when SSE is actively connected — not when the flag is on. This way, the catalog page (which uses `useShowControl` but does not mount `<SSESubscription>`) keeps its 60s polling, and any SSE outage automatically restores fast polling.

Edits happen **inside the wrapping hooks themselves**, not at their call sites — `useShowControl` and `useFlowsheet` are custom hooks that internally call `useGetInfiniteEntriesInfiniteQuery`, so the selector read + interval branch lives inline next to the existing options object. The catalog page, leftbar link, and other `useShowControl` callers inherit the new behavior automatically without changing.

```ts
// Inside useShowControl at src/hooks/flowsheetHooks.ts:59-76
const sseConnected = useAppSelector(liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected);
const pollingInterval = sseConnected ? 300_000 : 60_000;

const { data: infiniteData, ... } = useGetInfiniteEntriesInfiniteQuery(undefined, {
  skip: !userData || userloading,
  pollingInterval,
});
```

Three places change with this pattern. **Both `useShowControl` and `useFlowsheet` must be updated, not just one** — they each independently subscribe to `getInfiniteEntries`, and RTK Query takes the **minimum** `pollingInterval` across active subscribers. If only `useFlowsheet` slows to 300s and `useShowControl` stays at 60s, the effective interval remains 60s.

- `src/hooks/flowsheetHooks.ts:73` (inside `useShowControl`, before its `useGetInfiniteEntriesInfiniteQuery` call).
- `src/hooks/flowsheetHooks.ts:241` (inside `useFlowsheet`, before its `useGetInfiniteEntriesInfiniteQuery` call).
- `src/widgets/NowPlaying/index.tsx` — search for `useGetNowPlayingQuery(undefined, {` (currently exactly one match in the codebase) and insert the selector read just above it. This site IS the RTK Query call site directly. Documented exception: `useGetNowPlayingQuery` has one consumer today, so a wrapping `useNowPlaying` hook is unjustified extra indirection; extract one if a second consumer appears. Add a TODO at the site:
  ```ts
  // TODO: if a second useGetNowPlayingQuery consumer appears, hoist this
  //       SSE-aware polling-interval branch into a useNowPlaying() hook
  //       paralleling useShowControl/useFlowsheet.
  ```

**Transition timing**: the selector is read on each render. When SSE connects, `selectLiveUpdatesIsConnected` flips to `true`, the hook re-renders, the new `pollingInterval` is passed to RTK Query, and RTK Query reconfigures the poll loop on the next subscription update (typically within one tick — no manual reconfigure needed). When SSE disconnects, the reverse happens. There is no "double-poll" window because RTK Query owns the single timer per query. Behavior when the feature flag is OFF: SSE never connects, the selector stays `false`, polling stays at 60s — identical to today.

The `useWhoIsLiveQuery` call at `flowsheetHooks.ts:65` stays at 60s unchanged — SSE doesn't deliver `whoIsLive` updates today (deferred follow-up).

#### Other touchpoints

- Keep `lib/features/flowsheet/deferred-refetch.ts` intact during v0 (runs when SSE is disabled, which is the v0 default). Delete in the post-rollout cleanup PR.
- PostHog instrumentation in `live-updates-listener.ts` (see "Observability" below).
- `.env.example` adds the new flags using the existing comment-above-pattern (see the "Catalog Track Search v2" block at lines 20-25):

  ```
  # Live Updates (SSE): gates dj-site's subscription to Backend-Service's
  # liveFs SSE topic. Two independent flags so dashboards (small, known
  # audience) can roll out before /live (unknown public audience). Both
  # default OFF; flip to `true` (or `1`) per surface once Backend-Service's
  # GET /events/stream endpoint is live and the connection-count metric is
  # being observed. See docs/live-updates-sse.md.
  NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=false
  NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=false
  ```

## Feature flag rollout sequence

1. **Pre-launch**: BS-1, BS-2, BS-3, BS-4 land and deploy to staging. `wxyc-shared` PR lands. dj-site PR lands with both flags OFF in production. Verify that the Cloudflare Pages deployment's CSP (if any is set today, or before the next hardening pass adds one) permits `connect-src ${NEXT_PUBLIC_BACKEND_URL}` — a missing directive will cause the EventSource to fail silently and surface only as `sse_connection_error` in PostHog.
2. **Internal smoke**: flip `NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true` on a single staff DJ's local profile for one week. Watch PostHog events.
3. **Dashboard rollout** — **DONE 2026-05-29**: `NEXT_PUBLIC_FLOWSHEET_SSE_DASHBOARD_ENABLED=true` set on the Cloudflare Pages production env for `wxyc-dj`; deployment `524f2be5` rebuilt `main@fa72b041` with the flag baked in. All authenticated DJ tabs now subscribe. Observe `WXYC/Backend-Service/SSE/ClientCount` for a few days.
4. **Live view rollout**: flip `NEXT_PUBLIC_FLOWSHEET_SSE_LIVE_VIEW_ENABLED=true`. Public traffic now contributes to connection count. Watch the metric closely.
5. **Cleanup PR**: delete `lib/features/flowsheet/deferred-refetch.ts`, its test, and `FLOWSHEET_METADATA_REFETCH_DELAY_MS`. File a tracking issue at the end of Phase 4 (dashboard rollout stable) so the cleanup work has explicit ownership rather than living only in this plan document.

Rollback at any phase is a single env-var flip and redeploy.

## Testing

Three layers, all in scope for v0:

- **Unit (vitest + MSW)**: middleware parsing of synthetic events (including malformed frames — truncated JSON, missing `\n\n` boundary, unknown event types — assert each path calls `posthog.captureException` with the right context tag), ref-counted lifecycle, debouncer behavior, reconnection state machine (assert `onerror` while `readyState === CONNECTING` → `reconnecting`; `readyState === CLOSED` → `closed`), error paths, and the polling-interval branching logic (assert that `useShowControl` passes 300_000 when `selectLiveUpdatesIsConnected` returns true, 60_000 otherwise — easier and faster than driving it through Playwright). MSW v2 returns the SSE response as a stream that writes newline-delimited `data:` frames, e.g.:

  ```ts
  import { http, HttpResponse } from "msw";

  server.use(
    http.get(`${TEST_BACKEND_URL}/events/stream`, () => {
      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "update", payload: fullRowFixture, timestamp: NOW })}\n\n`));
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "refetch", payload: { source: "etl" }, timestamp: NOW })}\n\n`));
          controller.close();
        },
      });
      return new HttpResponse(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    })
  );
  ```

  Each `data:` frame must end with a blank line (`\n\n`) per the SSE spec. The middleware's native `EventSource.onmessage` parses these into individual events.

  **Test setup for EventSource**: vitest doesn't ship a built-in EventSource (jsdom doesn't implement it), so the middleware would throw `ReferenceError: EventSource is not defined` if a test caused it to instantiate one. Add a controllable `MockEventSource` class to `vitest.setup.ts` (must land in the same PR as the middleware, or the middleware unit tests can't run). Required surface, mirroring the MDN EventSource spec:

  ```ts
  // vitest.setup.ts additions
  class MockEventSource implements Partial<EventSource> {
    // Test assertions should use these constants, not magic numbers,
    // so the intent reads cleanly: `es.readyState === EventSource.CONNECTING`.
    static CONNECTING = 0 as const;
    static OPEN = 1 as const;
    static CLOSED = 2 as const;
    readyState: 0 | 1 | 2 = 0;
    url: string;
    onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
    onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
    onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
    constructor(url: string) {
      this.url = url;
      MockEventSource._instances.push(this);
    }
    close() { this.readyState = 2; }
    // Test helpers (not part of the EventSource spec):
    static _instances: MockEventSource[] = [];
    static _last(): MockEventSource { return this._instances[this._instances.length - 1]; }
    _fireOpen() { this.readyState = 1; this.onopen?.call(this as never, new Event('open')); }
    _fireMessage(data: string) { this.onmessage?.call(this as never, new MessageEvent('message', { data })); }
    _fireError(readyState: 0 | 2) { this.readyState = readyState; this.onerror?.call(this as never, new Event('error')); }
  }
  vi.stubGlobal('EventSource', MockEventSource);
  beforeEach(() => { MockEventSource._instances = []; });
  ```

  The MSW stream example above is for the **integration** layer of unit testing (does the middleware parse a real `text/event-stream` body correctly when run against MSW's fetch handler — useful as an end-to-end sanity check for the parser). The constructor mock covers **error paths** (truncated JSON in a `data:` payload, `readyState` transitions on `onerror`, the `connecting → reconnecting → connected` sequence) where driving via MSW would be awkward.
- **dj-site E2E (Playwright)**: one happy-path test — DJ A adds a song via the existing fixture; the test waits for the row to materialize in DJ B's rendered DOM via `expect(locator).toBeVisible({ timeout: 30_000 })`. 30s upper bound is generous for the enrichment chain (LML lookup + Postgres CDC + SSE broadcast typically completes in 2-5s in dev). Uses the existing `scripts/e2e-local.sh` Docker Compose stack. (The polling-rate verification belongs in the unit suite, not E2E — verifying request cadence over a 90s window via route interception is slow, flaky, and duplicates what a unit test of the hook can prove directly.)
- **wxyc-shared contract tests**: the three new invariants from the Wire Contract section, asserted against a running stack. These land with the BS PRs.

## Observability

Split by repo, following each codebase's existing convention.

**dj-site (PostHog, no Sentry)**:
- `posthog.captureException(err, { context: 'sse_parse_failure' | 'sse_dispatch_failure' | 'sse_connection_error' })` for the three error classes in the middleware.
- `posthog.capture('sse_connected' | 'sse_disconnected' | 'sse_reconnecting', { surface, ... })` for connection-state visibility.
- `posthog.capture('sse_unknown_event_id', { surface, event_type, payload_id, current_show_id })` as a counter for tuning the unknown-id debounce policy. `surface` distinguishes dashboard vs live consumer, `event_type` is `'update' | 'refetch'`, `payload_id` lets ops identify whether specific rows are systematically out-of-cache, and `current_show_id` (read from the loaded cache, or `null` if none) helps spot whether unknown ids cluster around show boundaries.

**Backend-Service (Sentry + CloudWatch)**:
- Sentry calls in `metadata-broadcast.ts` and `serverEvents.ts` per BS-2 and BS-4.
- CloudWatch metrics per BS-3.

## Risks

1. **Connection-count growth from `/live`**: unknown a priori. Mitigation: BS-3's metric is a hard prerequisite for Phase 4. If we exceed a threshold (TBD by ops), pause Phase 4 and file the `BroadcastChannel` leader-election work.
2. **`update` event flurry during nightly `flowsheet-metadata-backfill`**: many `update`s for old rows. Mitigation: the unknown-id path debounces (500ms) into a single cache invalidation. If even that's too costly, slow the backfill or batch its broadcasts (BS follow-up).
3. **EventSource native reconnect being too aggressive on flaky networks**: visible as toast spam. Mitigation: reconnect-state is only surfaced via the subtle dashboard indicator in v0 (no toasts), so this is just telemetry until proven otherwise.
4. **`/events/stream` GET endpoint without auth opens a public surface**: the topic was already designed public (`TopicAuthz[Topics.liveFs] = []`), but the route-level guard was a defense-in-depth layer. Mitigation: only the `liveFs` topic is publicly subscribable; the route filters topics against `TopicAuthz`. Authenticated topics (`showDj`, `primaryDj`, `mirror`) still gate on `hasAuth`.

## Follow-ups (post-v0, file as separate issues)

- **BS**: emit `liveFs:add` and `liveFs:delete` on the flowsheet controller so cross-DJ visibility doesn't rely on enrichment-driven `update`s.
- **BS**: new `liveShow` topic for show-started, dj-joined, dj-left so `whoIsLive` can drop its 60s poll.
- **dj-site**: drop `getInfiniteEntries` polling entirely (v1 of Q6 — reconnect-driven invalidation instead of the 5-min safety poll).
- **dj-site**: `BroadcastChannel` + leader election (when connection-count metric justifies it).
- **dj-site**: evaluate adopting Sentry alongside PostHog (separate decision, affects all error paths not just SSE).
- **Cleanup**: delete `deferred-refetch.ts` after both feature flags are stable in production.

## Open questions

- What's the right threshold on `WXYC/Backend-Service/SSE/ClientCount` to gate Phase 4 of the rollout? Ops conversation — TBD before flipping the `/live` flag.
- Are Backend-Service instances behind a sticky-session load balancer? If clients can reconnect to a different instance, they miss any events emitted on the old instance during the gap. The 5-min safety poll catches this in v0, but if we drop polling in v1 it becomes more material.
- Does any upstream proxy (nginx/ALB) buffer `text/event-stream` despite `X-Accel-Buffering: no`? Confirm before BS-1 deploys to production.
