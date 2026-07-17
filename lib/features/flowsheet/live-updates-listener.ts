import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { Middleware, TypedStartListening } from "@reduxjs/toolkit";
import { safeCapture, safeCaptureException } from "@/lib/posthog";
import type { AppDispatch, RootState } from "@/lib/store";
import { flowsheetApi } from "./api";
import { patchEntryById } from "./infinite-cache";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionStateChanged,
  liveUpdatesSlice,
  type LiveUpdatesConnectionStatus,
} from "./live-updates-slice";
import type { FlowsheetEntry } from "./types";

const LIVE_FS_TOPIC = "live-fs-topic";
const REFETCH_DEBOUNCE_MS = 500;

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
  PARSE_FAILURE: "sse_parse_failure",
  DISPATCH_FAILURE: "sse_dispatch_failure",
  CONNECTION_ERROR: "sse_connection_error",
} as const;

type LiveFsUpdateEvent = {
  type: "update";
  payload: FlowsheetEntry;
  timestamp: number;
};

type LiveFsRefetchEvent = {
  type: "refetch";
  payload: { source: string };
  timestamp: number;
};

type LiveFsEvent = LiveFsUpdateEvent | LiveFsRefetchEvent;

function isLiveFsEvent(value: unknown): value is LiveFsEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; payload?: unknown };
  if (typeof v.payload !== "object" || v.payload === null) return false;
  if (v.type === "update") {
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
      clearTimeout(debouncedInvalidateTimer);
    }
    debouncedInvalidateTimer = setTimeout(() => {
      debouncedInvalidateTimer = null;
      const toInvalidate = Array.from(pendingInvalidateTags);
      pendingInvalidateTags = new Set();
      if (toInvalidate.length === 0) return;
      dispatch(flowsheetApi.util.invalidateTags(toInvalidate));
    }, REFETCH_DEBOUNCE_MS);
  }

  function routeUpdateEvent(
    dispatch: AppDispatch,
    getState: () => RootState,
    payload: FlowsheetEntry
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

    if (inInfinite || inNowPlaying) {
      try {
        if (inInfinite) {
          dispatch(
            flowsheetApi.util.updateQueryData(
              "getInfiniteEntries",
              undefined,
              (draft) => {
                patchEntryById(draft, payload.id, payload);
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
                if (draft) Object.assign(draft, payload);
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
