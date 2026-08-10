import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { Middleware, TypedStartListening } from "@reduxjs/toolkit";
import type { FlowsheetEntryResponse, LiveFsEvent } from "@wxyc/shared/dtos";
import { safeCapture, safeCaptureException } from "@/lib/posthog";
import type { AppDispatch, RootState } from "@/lib/store";
import { flowsheetApi } from "./api";
import { convertV2Entry } from "./conversions";
import { insertEntrySortedFirstPage, patchEntryById } from "./infinite-cache";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionStateChanged,
  liveUpdatesSlice,
  type LiveUpdatesConnectionStatus,
} from "./live-updates-slice";
import type { FlowsheetEntry, FlowsheetV2EntryJSON } from "./types";

const LIVE_FS_TOPIC = "live-fs-topic";
const REFETCH_DEBOUNCE_MS = 500;

/**
 * Hard ceiling on how long the trailing debounce may keep deferring the
 * invalidate. A trailing-only debounce never fires while events keep arriving
 * closer together than REFETCH_DEBOUNCE_MS, so a sustained insert stream
 * (bulk historical import) would starve the backstop refetch exactly when
 * burst-skipped rows depend on it.
 */
const REFETCH_DEBOUNCE_MAX_WAIT_MS = 2000;

/**
 * Ceiling on per-row cache patches within one debounce window. Each patched
 * insert runs a full Immer produce over every loaded page; a burst past this
 * limit (bulk historical import — the BS-side broadcast comment explicitly
 * contemplates one) skips the per-row patch and leans on the debounced
 * invalidate scheduled for the window, which the max-wait ceiling guarantees
 * fires within REFETCH_DEBOUNCE_MAX_WAIT_MS even while the stream continues —
 * one refetch for every skipped row instead of N sequential produces +
 * renders.
 */
const INSERT_PATCH_BURST_LIMIT = 5;

// Drop benign SSE handshake frames so `sse_unknown_event_type` stays a
// contract-drift signal, not per-connection noise.
const BENIGN_HANDSHAKE_TYPES = new Set<string>([
  "connection-established",
  "subscription",
]);

type FlowsheetTag = "Flowsheet" | "NowPlaying" | "WhoIsLive";

const SSE_EVENTS = {
  CONNECTED: "sse_connected",
  RECONNECTING: "sse_reconnecting",
  DISCONNECTED: "sse_disconnected",
  UNKNOWN_EVENT_TYPE: "sse_unknown_event_type",
  UNKNOWN_EVENT_ID: "sse_unknown_event_id",
  CACHE_UNINITIALIZED: "sse_cache_uninitialized",
  PARSE_FAILURE: "sse_parse_failure",
  DISPATCH_FAILURE: "sse_dispatch_failure",
  CONNECTION_ERROR: "sse_connection_error",
} as const;

// Wire types come from the @wxyc/shared SSOT (api.yaml's LiveFsEvent union):
// the payload is the raw client-facing flowsheet ROW (FlowsheetEntryResponse —
// snake_case, nullable varchars, no read-time JOIN fields like rotation_bin),
// NOT a converted FlowsheetEntry, and timestamp is an ISO date-time string.

function isLiveFsEvent(value: unknown): value is LiveFsEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; payload?: unknown };
  if (typeof v.payload !== "object" || v.payload === null) return false;
  if (v.type === "update" || v.type === "insert") {
    // Require a numeric id so `payload.id === undefined` can't sneak through
    // and match `nowPlayingData?.id === undefined` (which is `true` whenever
    // no row is now-playing, corrupting the cache via empty Object.assign).
    return typeof (v.payload as { id?: unknown }).id === "number";
  }
  return v.type === "refetch";
}

/**
 * Inspection surface for one store's live-updates connection. The EventSource,
 * reconnect flag, and debounce timer live in the middleware instance's closure,
 * so this is the only way to observe them.
 */
export type LiveUpdatesListenerHandle = {
  middleware: Middleware;
  getEventSource: () => EventSource | null;
  getHasEverConnected: () => boolean;
  /** Closes the connection and clears the reconnect flag and pending timer. */
  reset: () => void;
};

/**
 * Builds a live-updates listener middleware bound to a single store. The
 * connection lifecycle (EventSource, reconnect-detect flag, debounce timer) is
 * owned per instance and MUST NOT be shared across stores: each store scopes
 * its own `liveUpdates` ref-count, so a shared connection could be closed by
 * one store's release while another store still holds a positive ref-count,
 * leaving that store with a ref-count but no stream. Per-store ownership makes
 * request/release from different stores independent, so a store with
 * ref-count > 0 always retains its own live EventSource.
 */
export function createLiveUpdatesListenerMiddleware(): LiveUpdatesListenerHandle {
  const listenerMiddleware = createListenerMiddleware();
  const startListening =
    listenerMiddleware.startListening as TypedStartListening<
      RootState,
      AppDispatch
    >;

  let eventSource: EventSource | null = null;
  let debouncedInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingInvalidateTags: Set<FlowsheetTag> = new Set();
  // When the currently-armed debounce window opened; bounds total deferral.
  let debounceFirstScheduledAt = 0;
  // One `sse_cache_uninitialized` capture per connection: on surfaces that
  // never mount the entries query (the public /live page), the uninitialized
  // lane fires for EVERY station-wide track add, so a per-insert capture is a
  // permanent telemetry flood that buries the lanes where the event signals a
  // real defect (auth-gated dashboard skip, rejected initial fetch).
  let capturedCacheUninitializedThisConnection = false;
  // Tracks whether the current EventSource has ever fired onopen. The browser
  // fires onopen again after a transparent reconnect; if hasEverConnected was
  // already true when onopen fires, anything the backend pushed during the
  // blackout window is missing from local cache, so we schedule an explicit
  // refetch to repair it. Reset on connectionReleased so a fresh subscriber's
  // first open is treated as an initial connect, not a reconnect.
  let hasEverConnected = false;

  function clearDebouncedInvalidate(): void {
    if (debouncedInvalidateTimer !== null) {
      clearTimeout(debouncedInvalidateTimer);
      debouncedInvalidateTimer = null;
    }
    pendingInvalidateTags = new Set();
  }

  /**
   * Fire the pending invalidate now instead of waiting out the debounce.
   * Used on connection release: dropping the pending tags there would lose
   * the repair for rows spliced or burst-skipped during the final window,
   * while invalidating with no subscribers merely marks the caches stale for
   * the next mount — free.
   */
  function flushPendingInvalidate(dispatch: AppDispatch): void {
    if (debouncedInvalidateTimer !== null) {
      clearTimeout(debouncedInvalidateTimer);
      debouncedInvalidateTimer = null;
    }
    const toInvalidate = Array.from(pendingInvalidateTags);
    pendingInvalidateTags = new Set();
    if (toInvalidate.length === 0) return;
    dispatch(flowsheetApi.util.invalidateTags(toInvalidate));
  }

  function setConnectionStatusIfChanged(
    listenerApi: { dispatch: AppDispatch; getState: () => RootState },
    next: LiveUpdatesConnectionStatus
  ): boolean {
    const current =
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(
        listenerApi.getState()
      );
    if (current === next) return false;
    listenerApi.dispatch(liveUpdatesConnectionStateChanged(next));
    return true;
  }

  function scheduleDebouncedInvalidate(
    dispatch: AppDispatch,
    tags: FlowsheetTag[]
  ) {
    for (const t of tags) pendingInvalidateTags.add(t);
    if (debouncedInvalidateTimer !== null) {
      // Trailing debounce with a max-wait: resetting the timer on every event
      // would defer the invalidate for as long as events keep arriving. Once
      // another full debounce interval would push total deferral past the
      // ceiling, keep the already-armed timer instead of resetting it.
      if (
        Date.now() + REFETCH_DEBOUNCE_MS - debounceFirstScheduledAt >
        REFETCH_DEBOUNCE_MAX_WAIT_MS
      ) {
        return;
      }
      clearTimeout(debouncedInvalidateTimer);
    } else {
      debounceFirstScheduledAt = Date.now();
    }
    debouncedInvalidateTimer = setTimeout(() => {
      debouncedInvalidateTimer = null;
      const toInvalidate = Array.from(pendingInvalidateTags);
      pendingInvalidateTags = new Set();
      if (toInvalidate.length === 0) return;
      dispatch(flowsheetApi.util.invalidateTags(toInvalidate));
    }, REFETCH_DEBOUNCE_MS);
  }

  /**
   * The RAW wire fields an update may merge over the cached CONVERTED row.
   * Null-valued keys are dropped: the wire row carries `null` for every unset
   * column (`record_label: null` on webhook-shaped rows, `show_id: null` on
   * stub-showless rows), and Object.assign would copy those over the
   * converted values — the folded `""` varchars (rendered downstream as the
   * literal string "null") and the `-1` orphan show_id sentinel (whose loss
   * collapses the live-show partition). Enrichment only ever fills fields, so
   * dropping nulls never suppresses a real value transition.
   */
  function nonNullWirePatch(
    payload: FlowsheetEntryResponse
  ): Partial<FlowsheetEntry> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null) out[key] = value;
    }
    return out as Partial<FlowsheetEntry>;
  }

  function routeUpdateEvent(
    dispatch: AppDispatch,
    getState: () => RootState,
    payload: FlowsheetEntryResponse
  ) {
    const state = getState();
    const infiniteData = flowsheetApi.endpoints.getInfiniteEntries.select(
      undefined
    )(state).data;
    const nowPlayingData = flowsheetApi.endpoints.getNowPlaying.select(
      undefined
    )(state).data;

    const inInfinite = (infiniteData?.pages ?? []).some((page) =>
      page.some((e) => e.id === payload.id)
    );
    const inNowPlaying = nowPlayingData?.id === payload.id;

    // Updates deliberately merge the RAW wire fields over the cached row
    // (nonNullWirePatch, not convertV2Entry): the wire row has no
    // rotation_bin, so a converted row would carry `rotation: undefined` as
    // an OWN property and Object.assign would clobber the cached badge; the
    // raw row simply lacks the key and leaves it alone. The overlapping
    // snake_case field names (track_title, artist_name, artwork_url, ...)
    // are what make the merge deliver enrichment fills; the helper drops the
    // null-valued keys that would otherwise clobber converted sentinels.
    if (inInfinite || inNowPlaying) {
      const patch = nonNullWirePatch(payload);
      try {
        if (inInfinite) {
          dispatch(
            flowsheetApi.util.updateQueryData(
              "getInfiniteEntries",
              undefined,
              (draft) => {
                patchEntryById(draft, payload.id, patch);
              }
            )
          );
        }
        if (inNowPlaying) {
          dispatch(
            flowsheetApi.util.updateQueryData(
              "getNowPlaying",
              undefined,
              (draft) => {
                if (draft) Object.assign(draft, patch);
              }
            )
          );
        }
      } catch (err) {
        safeCaptureException(err, {
          context: SSE_EVENTS.DISPATCH_FAILURE,
          event_type: "update",
          payload_id: payload.id,
        });
      }
      return;
    }

    const currentShowId =
      (infiniteData?.pages ?? []).find((p) => p.length > 0)?.[0]?.show_id ??
      null;
    safeCapture(SSE_EVENTS.UNKNOWN_EVENT_ID, {
      surface: "listener",
      event_type: "update",
      payload_id: payload.id,
      current_show_id: currentShowId,
    });
    scheduleDebouncedInvalidate(dispatch, ["Flowsheet"]);
  }

  // Burst accounting for routeInsertEvent's patch ceiling — windowed by wall
  // clock, no reset needed on disconnect (a stale window start just admits
  // the next patch, which is the safe direction).
  let insertBurstWindowStart = 0;
  let insertBurstCount = 0;

  /**
   * A BS `insert` event's payload is the raw client-facing flowsheet ROW —
   * the CDC allow-list projection, which carries no read-time JOIN fields
   * (rotation_bin, on_streaming) and NULLs where the converted cache uses ""
   * — so it MUST go through `convertV2Entry` before touching the cache, or
   * the row renders shape-corrupt (literal "null" labels, broken show
   * partition via the unmapped `show_id: null`).
   *
   * Hybrid patch-plus-invalidate: for a genuinely new row the converted
   * entry is spliced in for instant UI, and a debounced Flowsheet+NowPlaying
   * invalidate is scheduled as the consistency backstop. The refetch is what
   * (a) keeps the NowPlaying card in step with a brand-new row it can't know
   * about, (b) carries along non-broadcast marker rows (breakpoints/talksets
   * — BS only broadcasts `entry_type='track'`), preserving the
   * pre-insert-handling repair behavior, (c) repairs the page-boundary drift
   * a growing pages[0] causes for offset-based fetchNextPage, and (d) bounds
   * every SSE-vs-optimistic race window at ~one debounce interval instead of
   * the 5-minute slow poll.
   *
   * Two lanes skip the splice and downgrade the backstop to NowPlaying-only
   * (never Flowsheet — a refetch replays only the recorded pageParams, so a
   * per-self-add refetch collapses the sender's optimistic rows past the
   * page size out of the list during rapid adds; the entry-caching E2E pins
   * exactly this):
   *
   * 1. The id is already cached. Either the sender's own broadcast echo
   *    (their `addToFlowsheet` pipeline owns the row — optimistic insert →
   *    temp-id resolve — and merging the raw pre-enrichment echo over it
   *    would downgrade enriched fields), or a receiver whose refetch raced
   *    the frame and delivered the row first. The receiver's NowPlaying
   *    cache never learns about the row otherwise (later updates take the
   *    inInfinite branch), so the NowPlaying nudge is load-bearing there —
   *    without it the card sticks on the previous track for a full slow-poll
   *    interval.
   *
   * 2. A pending optimistic song row (negative temp id) is in the cache. BS
   *    broadcasts at commit, BEFORE the sender's own POST response resolves
   *    the temp id, so a frame arriving now is almost certainly that echo
   *    under its not-yet-known real id — splicing it would render a
   *    duplicate beside the optimistic row. The mutation pipeline installs
   *    the row on fulfillment (replaceEntryIdAllPages dedupes on the real
   *    id). A genuinely concurrent other-client insert in this narrow window
   *    is repaired by its later enrichment update via the unknown-id lane's
   *    Flowsheet refetch.
   */
  function routeInsertEvent(
    dispatch: AppDispatch,
    getState: () => RootState,
    payload: FlowsheetEntryResponse
  ) {
    const state = getState();
    const infiniteData = flowsheetApi.endpoints.getInfiniteEntries.select(
      undefined
    )(state).data;

    // RTK's updateQueryData silently no-ops on an uninitialized cache (public
    // /live page, auth-gated dashboard skip, rejected initial fetch) — the
    // recipe never runs, so nothing would throw and nothing would render.
    // The invalidate refetches existing or previously-rejected substates (it
    // is what keeps /live's NowPlaying card fresh); it cannot START a
    // never-initiated entries query, so on /live this lane recurs by
    // construction — hence the once-per-connection capture.
    if (!infiniteData) {
      if (!capturedCacheUninitializedThisConnection) {
        capturedCacheUninitializedThisConnection = true;
        safeCapture(SSE_EVENTS.CACHE_UNINITIALIZED, {
          surface: "listener",
          event_type: "insert",
          payload_id: payload.id,
        });
      }
      scheduleDebouncedInvalidate(dispatch, ["Flowsheet", "NowPlaying"]);
      return;
    }

    const alreadyCached = infiniteData.pages.some((page) =>
      page.some((e) => e.id === payload.id)
    );
    if (alreadyCached) {
      scheduleDebouncedInvalidate(dispatch, ["NowPlaying"]);
      return;
    }

    const hasPendingOptimisticAdd = infiniteData.pages.some((page) =>
      page.some((e) => e.id < 0 && "track_title" in e)
    );
    if (hasPendingOptimisticAdd) {
      scheduleDebouncedInvalidate(dispatch, ["NowPlaying"]);
      return;
    }

    const now = Date.now();
    if (now - insertBurstWindowStart > REFETCH_DEBOUNCE_MS) {
      insertBurstWindowStart = now;
      insertBurstCount = 0;
    }

    if (insertBurstCount < INSERT_PATCH_BURST_LIMIT) {
      try {
        // Converted inside the try: convertV2Entry throws on an entry_type
        // outside its switch while isLiveFsEvent only vets a numeric id, and
        // an uncaught throw here would escape es.onmessage — skipping both
        // the telemetry and the backstop invalidate below.
        const entry = convertV2Entry(
          payload as unknown as FlowsheetV2EntryJSON
        );
        dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              insertEntrySortedFirstPage(draft, entry);
            }
          )
        );
        // Only a successful patch consumes a burst slot — a throwing convert
        // or dispatch must not push later rows in the window into the skip
        // lane.
        insertBurstCount += 1;
      } catch (err) {
        safeCaptureException(err, {
          context: SSE_EVENTS.DISPATCH_FAILURE,
          event_type: "insert",
          payload_id: payload.id,
        });
      }
    }

    scheduleDebouncedInvalidate(dispatch, ["Flowsheet", "NowPlaying"]);
  }

  startListening({
    actionCreator: liveUpdatesConnectionRequested,
    effect: (_action, listenerApi) => {
      const refCount = liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(
        listenerApi.getState()
      );
      if (refCount !== 1 || eventSource !== null) return;

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
      const url = `${backendUrl}/events/stream?topics=${LIVE_FS_TOPIC}`;

      setConnectionStatusIfChanged(listenerApi, "connecting");

      let es: EventSource;
      try {
        es = new EventSource(url);
      } catch (err) {
        safeCaptureException(err, {
          context: SSE_EVENTS.CONNECTION_ERROR,
          url,
        });
        setConnectionStatusIfChanged(listenerApi, "closed");
        return;
      }
      eventSource = es;
      capturedCacheUninitializedThisConnection = false;

      es.onopen = () => {
        const isReconnect = hasEverConnected;
        if (setConnectionStatusIfChanged(listenerApi, "connected")) {
          safeCapture(SSE_EVENTS.CONNECTED, { topic: LIVE_FS_TOPIC });
        }
        if (isReconnect) {
          scheduleDebouncedInvalidate(listenerApi.dispatch, [
            "Flowsheet",
            "NowPlaying",
            "WhoIsLive",
          ]);
        }
        // Set last so a throwing dispatch above leaves the flag false and the
        // next onopen is treated as the first observable connect, not a
        // reconnect.
        hasEverConnected = true;
      };

      es.onerror = () => {
        // EventSource sets readyState before firing onerror.
        // 0 = CONNECTING (browser is retrying transparently);
        // 2 = CLOSED (permanently closed).
        if (es.readyState === EventSource.CONNECTING) {
          if (setConnectionStatusIfChanged(listenerApi, "reconnecting")) {
            safeCapture(SSE_EVENTS.RECONNECTING, { topic: LIVE_FS_TOPIC });
          }
        } else if (es.readyState === EventSource.CLOSED) {
          if (setConnectionStatusIfChanged(listenerApi, "closed")) {
            safeCapture(SSE_EVENTS.DISCONNECTED, {
              topic: LIVE_FS_TOPIC,
              reason: "permanent",
            });
          }
        }
      };

      es.onmessage = (msgEvent: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(msgEvent.data as string);
        } catch (err) {
          safeCaptureException(err, {
            context: SSE_EVENTS.PARSE_FAILURE,
            raw_sample:
              typeof msgEvent.data === "string"
                ? msgEvent.data.slice(0, 200)
                : null,
          });
          return;
        }
        const rawType =
          typeof parsed === "object" && parsed !== null
            ? (parsed as { type?: unknown }).type
            : null;
        if (
          typeof rawType === "string" &&
          BENIGN_HANDSHAKE_TYPES.has(rawType)
        ) {
          return;
        }
        if (!isLiveFsEvent(parsed)) {
          safeCapture(SSE_EVENTS.UNKNOWN_EVENT_TYPE, {
            topic: LIVE_FS_TOPIC,
            raw_type: rawType,
          });
          return;
        }

        if (parsed.type === "refetch") {
          scheduleDebouncedInvalidate(listenerApi.dispatch, [
            "Flowsheet",
            "NowPlaying",
            "WhoIsLive",
          ]);
          return;
        }

        if (parsed.type === "insert") {
          routeInsertEvent(
            listenerApi.dispatch,
            listenerApi.getState,
            parsed.payload
          );
          return;
        }

        routeUpdateEvent(
          listenerApi.dispatch,
          listenerApi.getState,
          parsed.payload
        );
      };
    },
  });

  startListening({
    actionCreator: liveUpdatesConnectionReleased,
    effect: (_action, listenerApi) => {
      const refCount = liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(
        listenerApi.getState()
      );
      if (refCount !== 0 || eventSource === null) return;
      eventSource.close();
      eventSource = null;
      hasEverConnected = false;
      capturedCacheUninitializedThisConnection = false;
      // Flush, don't drop: a release mid-burst would otherwise discard the
      // pending repair for rows the final debounce window never fetched.
      flushPendingInvalidate(listenerApi.dispatch);
      setConnectionStatusIfChanged(listenerApi, "closed");
    },
  });

  return {
    middleware: listenerMiddleware.middleware,
    getEventSource: () => eventSource,
    getHasEverConnected: () => hasEverConnected,
    reset: () => {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
      }
      eventSource = null;
      hasEverConnected = false;
      clearDebouncedInvalidate();
    },
  };
}

// Associates a store with its live-updates connection handle so the SSE
// lifecycle can be inspected or torn down per store. Weak so a discarded
// store's handle is collectible and per-request server stores don't accumulate.
const handleByStore = new WeakMap<object, LiveUpdatesListenerHandle>();

export function attachLiveUpdatesListener(
  store: object,
  handle: LiveUpdatesListenerHandle
): void {
  handleByStore.set(store, handle);
}

export function getLiveUpdatesListenerHandle(
  store: object
): LiveUpdatesListenerHandle | undefined {
  return handleByStore.get(store);
}
