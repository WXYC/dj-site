import { createListenerMiddleware } from "@reduxjs/toolkit";
import type { TypedStartListening } from "@reduxjs/toolkit";
import { posthog } from "@/lib/posthog";
import type { AppDispatch, RootState } from "@/lib/store";
import { flowsheetApi } from "./api";
import { patchEntryById } from "./infinite-cache";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesConnectionStateChanged,
  liveUpdatesLastEventAtUpdated,
  liveUpdatesSlice,
} from "./live-updates-slice";
import type { FlowsheetEntry } from "./types";

const LIVE_FS_TOPIC = "live-fs-topic";
const REFETCH_DEBOUNCE_MS = 500;

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
let pendingInvalidateTags: Set<"Flowsheet" | "NowPlaying"> = new Set();

function isLiveFsEvent(value: unknown): value is LiveFsEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown };
  return v.type === "update" || v.type === "refetch";
}

function safeCaptureException(err: unknown, context: Record<string, unknown>) {
  try {
    posthog.captureException(
      err instanceof Error ? err : new Error(String(err)),
      context
    );
  } catch {
    // PostHog may not be initialized (tests, SSR); never let telemetry crash the dispatch path.
  }
}

function safeCapture(event: string, props: Record<string, unknown>) {
  try {
    posthog.capture(event, props);
  } catch {
    // See safeCaptureException — telemetry is best-effort.
  }
}

function scheduleDebouncedInvalidate(
  dispatch: AppDispatch,
  tags: Array<"Flowsheet" | "NowPlaying">
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
        context: "sse_dispatch_failure",
        event_type: "update",
        payload_id: payload.id,
      });
    }
    return;
  }

  // Unknown id — schedule debounced invalidate.
  const currentShowId =
    (infiniteData?.pages ?? []).find((p) => p.length > 0)?.[0]?.show_id ?? null;
  safeCapture("sse_unknown_event_id", {
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

    listenerApi.dispatch(liveUpdatesConnectionStateChanged("connecting"));

    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch (err) {
      safeCaptureException(err, { context: "sse_connection_error", url });
      listenerApi.dispatch(liveUpdatesConnectionStateChanged("closed"));
      return;
    }
    eventSource = es;

    es.onopen = () => {
      listenerApi.dispatch(liveUpdatesConnectionStateChanged("connected"));
      safeCapture("sse_connected", { topic: LIVE_FS_TOPIC });
    };

    es.onerror = () => {
      // EventSource sets readyState before firing onerror.
      // 0 = CONNECTING (browser is retrying transparently);
      // 2 = CLOSED (permanently closed).
      if (es.readyState === EventSource.CONNECTING) {
        listenerApi.dispatch(liveUpdatesConnectionStateChanged("reconnecting"));
        safeCapture("sse_reconnecting", { topic: LIVE_FS_TOPIC });
      } else if (es.readyState === EventSource.CLOSED) {
        listenerApi.dispatch(liveUpdatesConnectionStateChanged("closed"));
        safeCapture("sse_disconnected", {
          topic: LIVE_FS_TOPIC,
          reason: "permanent",
        });
      }
    };

    es.onmessage = (msgEvent: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(msgEvent.data as string);
      } catch (err) {
        safeCaptureException(err, {
          context: "sse_parse_failure",
          raw_sample:
            typeof msgEvent.data === "string"
              ? msgEvent.data.slice(0, 200)
              : null,
        });
        return;
      }
      if (!isLiveFsEvent(parsed)) {
        safeCapture("sse_unknown_event_type", {
          topic: LIVE_FS_TOPIC,
          raw_type:
            typeof parsed === "object" && parsed !== null
              ? (parsed as { type?: unknown }).type
              : null,
        });
        return;
      }
      listenerApi.dispatch(liveUpdatesLastEventAtUpdated(Date.now()));

      if (parsed.type === "refetch") {
        scheduleDebouncedInvalidate(listenerApi.dispatch, [
          "Flowsheet",
          "NowPlaying",
        ]);
        return;
      }

      // parsed.type === "update"
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
    listenerApi.dispatch(liveUpdatesConnectionStateChanged("closed"));
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
  if (debouncedInvalidateTimer !== null) {
    clearTimeout(debouncedInvalidateTimer);
    debouncedInvalidateTimer = null;
  }
  pendingInvalidateTags = new Set();
}

/** Test-only accessor for the live EventSource reference. */
export function __getLiveUpdatesEventSourceForTests(): EventSource | null {
  return eventSource;
}
