import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { TypedStartListening } from "@reduxjs/toolkit";
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
// contract-drift signal, not per-connection noise. See WXYC/dj-site#673.
const BENIGN_HANDSHAKE_TYPES = new Set<string>([
  "connection-established",
  "subscription",
]);

type FlowsheetTag = "Flowsheet" | "NowPlaying";

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

let eventSource: EventSource | null = null;
let debouncedInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
let pendingInvalidateTags: Set<FlowsheetTag> = new Set();

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
  const current = liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(
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
  const nowPlayingData = flowsheetApi.endpoints.getNowPlaying.select(undefined)(
    state
  ).data;

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
    (infiniteData?.pages ?? []).find((p) => p.length > 0)?.[0]?.show_id ?? null;
  safeCapture(SSE_EVENTS.UNKNOWN_EVENT_ID, {
    surface: "listener",
    event_type: "update",
    payload_id: payload.id,
    current_show_id: currentShowId,
  });
  scheduleDebouncedInvalidate(dispatch, ["Flowsheet"]);
}

export const liveUpdatesListenerMiddleware = createListenerMiddleware();

const startListening =
  liveUpdatesListenerMiddleware.startListening as TypedStartListening<
    RootState,
    AppDispatch
  >;

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
      safeCaptureException(err, { context: SSE_EVENTS.CONNECTION_ERROR, url });
      setConnectionStatusIfChanged(listenerApi, "closed");
      return;
    }
    eventSource = es;

    es.onopen = () => {
      if (setConnectionStatusIfChanged(listenerApi, "connected")) {
        safeCapture(SSE_EVENTS.CONNECTED, { topic: LIVE_FS_TOPIC });
      }
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
      if (typeof rawType === "string" && BENIGN_HANDSHAKE_TYPES.has(rawType)) {
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
        ]);
        return;
      }

      routeUpdateEvent(listenerApi.dispatch, listenerApi.getState, parsed.payload);
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
    clearDebouncedInvalidate();
    setConnectionStatusIfChanged(listenerApi, "closed");
  },
});

/** Test-only escape hatch: clears the module-scoped EventSource reference. */
export function __resetLiveUpdatesEventSourceForTests(): void {
  if (eventSource) {
    try {
      eventSource.close();
    } catch {
      // ignore
    }
  }
  eventSource = null;
  clearDebouncedInvalidate();
}

/** Test-only accessor for the live EventSource reference. */
export function __getLiveUpdatesEventSourceForTests(): EventSource | null {
  return eventSource;
}
