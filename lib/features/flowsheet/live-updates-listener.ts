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
 * Ceiling on per-row cache patches between backstop refetches: the counter
 * resets when a drain that includes a Flowsheet invalidate fires, so the
 * limit literally means "patches since the last entries refetch". Each
 * patched insert runs a full Immer produce over every loaded page; a burst
 * past this limit (bulk historical import — the BS-side broadcast comment
 * explicitly contemplates one) skips the per-row patch and leans on the
 * scheduled invalidate, which the max-wait ceiling guarantees fires within
 * REFETCH_DEBOUNCE_MAX_WAIT_MS even while the stream continues — one refetch
 * for every skipped row instead of N sequential produces + renders.
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
    if (typeof (v.payload as { id?: unknown }).id !== "number") return false;
    // An insert payload is contractually a TRACK row (BS broadcasts only
    // entry_type='track'). Any other entry_type would convert to a corrupt
    // row — the marker arms derive display dates from fields a track row
    // carries differently — so contract drift must surface as
    // sse_unknown_event_type, never as a silent bad splice.
    if (v.type === "insert") {
      return (
        (v.payload as { entry_type?: unknown }).entry_type === "track"
      );
    }
    return true;
  }
  return v.type === "refetch";
}

/**
 * Which consumer this store serves, stamped onto every telemetry capture that
 * carries a `surface` property. The split is what makes `sse_cache_uninitialized`
 * diagnostic: on "live" (the public page never mounts the entries query) the
 * event is expected on every station-wide add, while on "dashboard" it signals
 * a real cache-init defect (auth-gated skip, rejected initial fetch).
 */
export type LiveUpdatesSurface = "dashboard" | "live";

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
export function createLiveUpdatesListenerMiddleware(
  surface: LiveUpdatesSurface
): LiveUpdatesListenerHandle {
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
  // Patches applied since the last Flowsheet-including drain — the counter
  // INSERT_PATCH_BURST_LIMIT caps. Reset by the drain and on teardown.
  let insertBurstCount = 0;
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
    insertBurstCount = 0;
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
      // An entries refetch is on its way: reopen the per-refetch patch
      // budget (see INSERT_PATCH_BURST_LIMIT).
      if (toInvalidate.includes("Flowsheet")) insertBurstCount = 0;
      dispatch(flowsheetApi.util.invalidateTags(toInvalidate));
    }, REFETCH_DEBOUNCE_MS);
  }

  /**
   * Keys that exist only on the wire row, or that map to a DIFFERENT key in
   * the converted shape. Grafting them onto a cached converted row would
   * fork the cache's shape by event history (the insert path's conversion
   * invariant is that none of these ever appear on a cached entry), and
   * `rotation_bin` specifically converts to the `rotation` key — a raw merge
   * would write a field the badge never reads while the real badge field
   * silently stays stale.
   */
  const WIRE_ONLY_UPDATE_KEYS = new Set([
    "entry_type",
    "metadata_status",
    "add_time",
    "radio_hour",
    "dj_name",
    "rotation_bin",
  ]);

  /**
   * The RAW wire fields an update may merge over the cached CONVERTED row.
   * Null-valued keys are dropped: the wire row carries `null` for every
   * unset column (`record_label: null` on webhook-shaped rows, `show_id:
   * null` on stub-showless rows, and `artwork_url: null` on linked rows
   * whose artwork lives in album_metadata and is coalesced at read time),
   * and Object.assign would copy those over the converted values — the
   * folded `""` varchars (rendered downstream as the literal string "null")
   * and the `-1` orphan show_id sentinel (whose loss collapses the
   * live-show partition). The cost: a genuine upstream non-null-to-null
   * clear (host-guard remediation) doesn't propagate until the next refetch
   * or poll — accepted, since no currently rendered field is reachable by
   * such a clear and stale-for-minutes beats corrupt-now.
   */
  function nonNullWirePatch(
    payload: FlowsheetEntryResponse
  ): Partial<FlowsheetEntry> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && !WIRE_ONLY_UPDATE_KEYS.has(key)) out[key] = value;
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
      // A row can reach getNowPlaying without ever entering the entries
      // cache (a skip-lane NowPlaying nudge, or the /latest poll), and this
      // terminal-enrichment update is that row's only guaranteed follow-up
      // event — so when the entries cache is loaded but missing the row,
      // this update must carry the entries repair the insert lane deferred.
      if (inNowPlaying && !inInfinite && infiniteData) {
        scheduleDebouncedInvalidate(dispatch, ["Flowsheet"]);
      }
      return;
    }

    const currentShowId =
      (infiniteData?.pages ?? []).find((p) => p.length > 0)?.[0]?.show_id ??
      null;
    safeCapture(SSE_EVENTS.UNKNOWN_EVENT_ID, {
      surface,
      event_type: "update",
      payload_id: payload.id,
      current_show_id: currentShowId,
    });
    scheduleDebouncedInvalidate(dispatch, ["Flowsheet"]);
  }

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
   * — BS only broadcasts `entry_type='track'`), (c) repairs the
   * page-boundary drift a growing pages[0] causes for offset-based
   * fetchNextPage, and (d) bounds every SSE-vs-optimistic race window at
   * ~one debounce interval instead of the 5-minute slow poll.
   *
   * Two lanes skip the splice and never schedule a Flowsheet invalidate — a
   * refetch replays only the recorded pageParams, so a per-self-add refetch
   * collapses the sender's optimistic rows past the page size out of the
   * list during rapid adds (the entry-caching E2E pins exactly this):
   *
   * 1. The id is already cached. Either the sender's own broadcast echo
   *    (their `addToFlowsheet` pipeline owns the row — optimistic insert →
   *    temp-id resolve — and merging the raw pre-enrichment echo over it
   *    would downgrade enriched fields), or a receiver whose refetch raced
   *    the frame and delivered the row first. This lane nudges NowPlaying:
   *    the receiver's NowPlaying cache never learns about the row otherwise
   *    (later updates take the inInfinite branch), so without the nudge the
   *    card sticks on the previous track for a full slow-poll interval.
   *
   * 2. A pending optimistic song row (negative temp id) is in the cache. BS
   *    broadcasts at commit, BEFORE the sender's own POST response resolves
   *    the temp id, so a frame arriving now is almost certainly that echo
   *    under its not-yet-known real id — splicing it would render a
   *    duplicate beside the optimistic row. The mutation pipeline installs
   *    the row on fulfillment (replaceEntryIdAllPages dedupes on the real
   *    id) and its own invalidatesTags refreshes NowPlaying, so this lane
   *    schedules nothing. The heuristic can misfire on a genuinely
   *    concurrent other-client insert inside the sender's POST window; the
   *    miss is bounded — that row's terminal-enrichment update schedules
   *    the Flowsheet refetch (routeUpdateEvent's miss lanes), and the
   *    sender's own post-add NowPlaying refetch surfaces it on the card.
   */
  function routeInsertEvent(
    dispatch: AppDispatch,
    getState: () => RootState,
    payload: FlowsheetEntryResponse
  ) {
    const state = getState();
    const entriesQuery = flowsheetApi.endpoints.getInfiniteEntries.select(
      undefined
    )(state);
    const infiniteData = entriesQuery.data;

    // RTK's updateQueryData silently no-ops on an uninitialized cache (public
    // /live page, auth-gated dashboard skip, rejected initial fetch) — the
    // recipe never runs, so nothing would throw and nothing would render.
    // The invalidate refetches existing or previously-rejected substates (it
    // is what keeps /live's NowPlaying card fresh); it cannot START a
    // never-initiated entries query, so on /live this lane recurs by
    // construction — hence the once-per-connection capture. A pending first
    // GET is a benign mount race, not a defect signal, so it must not spend
    // the connection's single capture; the invalidate is still scheduled,
    // since that in-flight response may have been served before this row
    // committed.
    if (!infiniteData) {
      if (
        !entriesQuery.isLoading &&
        !capturedCacheUninitializedThisConnection
      ) {
        capturedCacheUninitializedThisConnection = true;
        safeCapture(SSE_EVENTS.CACHE_UNINITIALIZED, {
          surface,
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
      return;
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
          safeCapture(SSE_EVENTS.CONNECTED, { topic: LIVE_FS_TOPIC, surface });
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
            safeCapture(SSE_EVENTS.RECONNECTING, {
              topic: LIVE_FS_TOPIC,
              surface,
            });
          }
        } else if (es.readyState === EventSource.CLOSED) {
          if (setConnectionStatusIfChanged(listenerApi, "closed")) {
            safeCapture(SSE_EVENTS.DISCONNECTED, {
              topic: LIVE_FS_TOPIC,
              surface,
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
      // Drop — never flush — the pending invalidate: with the live surfaces
      // unmounting, an invalidateTags dispatch reaches zero-subscriber
      // queries, and RTK responds with removeQueryResult (a hard DELETE of
      // the cache entry, pageParams included), not a mark-stale — destroying
      // the warm cache keepUnusedDataFor exists to preserve; and any
      // still-subscribed query would refetch every recorded page into a tree
      // being torn down. The dropped repair window is bounded by the poll on
      // the next mount.
      clearDebouncedInvalidate();
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
