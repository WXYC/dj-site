import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  __getLiveUpdatesEventSourceForTests,
  __resetLiveUpdatesEventSourceForTests,
} from "@/lib/features/flowsheet/live-updates-listener";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesSlice,
} from "@/lib/features/flowsheet/live-updates-slice";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { posthog } from "@/lib/posthog";
import { makeStore } from "@/lib/store";
import { server, TEST_BACKEND_URL } from "@/lib/test-utils";

const captureSpy = vi.spyOn(posthog, "capture").mockImplementation(() => undefined as never);
const captureExceptionSpy = vi
  .spyOn(posthog, "captureException")
  .mockImplementation(() => undefined as never);

type MockES = {
  url: string;
  readyState: 0 | 1 | 2;
  close: () => void;
  _fireOpen: () => void;
  _fireMessage: (data: string) => void;
  _fireError: (readyState: 0 | 2) => void;
};
type MockESCtor = {
  new (url: string): MockES;
  CONNECTING: 0;
  OPEN: 1;
  CLOSED: 2;
  _instances: MockES[];
  _last(): MockES | undefined;
};

const MockEventSourceCtor = globalThis.EventSource as unknown as MockESCtor;

function getLastMock(): MockES {
  const es = MockEventSourceCtor._last();
  if (!es) throw new Error("No MockEventSource constructed yet");
  return es;
}

function makeSongEntry(overrides: Partial<FlowsheetSongEntry> = {}): FlowsheetSongEntry {
  return {
    id: 9001,
    play_order: 1,
    show_id: 7000,
    track_title: "la paradoja",
    artist_name: "Juana Molina",
    album_title: "DOGA",
    record_label: "Sonamos",
    request_flag: false,
    ...overrides,
  };
}

function frame(payload: unknown): string {
  return JSON.stringify(payload);
}

describe("liveUpdatesListenerMiddleware", () => {
  beforeEach(() => {
    captureSpy.mockClear();
    captureExceptionSpy.mockClear();
    __resetLiveUpdatesEventSourceForTests();
  });

  afterEach(() => {
    __resetLiveUpdatesEventSourceForTests();
  });

  it("opens an EventSource on the 0->1 refCount transition", () => {
    const store = makeStore();
    expect(__getLiveUpdatesEventSourceForTests()).toBeNull();

    store.dispatch(liveUpdatesConnectionRequested());

    expect(__getLiveUpdatesEventSourceForTests()).not.toBeNull();
    const es = getLastMock();
    expect(es.url).toContain("/events/stream?topics=live-fs-topic");
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("connecting");
  });

  it("does not open a second EventSource on the 1->2 refCount transition", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    const first = __getLiveUpdatesEventSourceForTests();
    store.dispatch(liveUpdatesConnectionRequested());
    expect(__getLiveUpdatesEventSourceForTests()).toBe(first);
    expect(MockEventSourceCtor._instances).toHaveLength(1);
  });

  it("closes the EventSource on the N->0 refCount transition", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    store.dispatch(liveUpdatesConnectionRequested());
    expect(__getLiveUpdatesEventSourceForTests()).not.toBeNull();
    store.dispatch(liveUpdatesConnectionReleased());
    expect(__getLiveUpdatesEventSourceForTests()).not.toBeNull();
    store.dispatch(liveUpdatesConnectionReleased());
    expect(__getLiveUpdatesEventSourceForTests()).toBeNull();
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("closed");
  });

  it("marks status connected on onopen", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireOpen();
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("connected");
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_connected",
      expect.objectContaining({ topic: "live-fs-topic" })
    );
  });

  it("maps onerror with readyState CONNECTING to 'reconnecting'", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireOpen();
    getLastMock()._fireError(MockEventSourceCtor.CONNECTING);
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("reconnecting");
  });

  it("maps onerror with readyState CLOSED to 'closed'", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireOpen();
    getLastMock()._fireError(MockEventSourceCtor.CLOSED);
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("closed");
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_disconnected",
      expect.objectContaining({ reason: "permanent" })
    );
  });

  it("captures a parse failure to PostHog when JSON is malformed", async () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage("{not valid json");
    expect(captureExceptionSpy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: "sse_parse_failure" })
    );
  });

  it("captures an unknown event type", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "noSuchEventType", payload: {}, timestamp: 0 })
    );
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.objectContaining({ raw_type: "noSuchEventType" })
    );
  });

  it("patches getInfiniteEntries when an update arrives for a cached id", async () => {
    const initialEntry = makeSongEntry({ id: 9001, artwork_url: undefined });

    // Populate the cache via a real GET through MSW so RTK Query treats it as
    // a fully-initialized cache entry (upsertQueryData proved unreliable for
    // infinite queries on this RTK Query version).
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json([
          {
            id: initialEntry.id,
            entry_type: "track",
            play_order: initialEntry.play_order,
            show_id: initialEntry.show_id,
            track_title: initialEntry.track_title,
            artist_name: initialEntry.artist_name,
            album_title: initialEntry.album_title,
            record_label: initialEntry.record_label,
            request_flag: initialEntry.request_flag,
          },
        ])
      )
    );

    const store = makeStore();
    await store
      .dispatch(
        flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined)
      )
      .unwrap();

    const cached =
      flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
        store.getState()
      ).data;
    expect(cached?.pages?.[0]?.[0]?.id).toBe(9001);

    const updatedEntry = makeSongEntry({
      id: 9001,
      artwork_url: "https://cdn.example/artwork.jpg",
      on_streaming: true,
    });

    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "update", payload: updatedEntry, timestamp: 1 })
    );

    const after = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
      store.getState()
    ).data;
    expect(after?.pages?.[0]?.[0]).toMatchObject({
      id: 9001,
      artwork_url: "https://cdn.example/artwork.jpg",
      on_streaming: true,
    });
  });

  it("schedules a refetch invalidate when an update arrives for an unknown id", async () => {
    vi.useFakeTimers();
    try {
      const store = makeStore();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(
        frame({
          type: "update",
          payload: makeSongEntry({ id: 12345 }),
          timestamp: 1,
        })
      );
      expect(invalidateSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.arrayContaining(["Flowsheet"])
      );
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("debounces back-to-back refetch events into a single invalidate", () => {
    vi.useFakeTimers();
    try {
      const store = makeStore();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      const f = (i: number) =>
        frame({
          type: "refetch",
          payload: { source: `etl-${i}` },
          timestamp: i,
        });
      getLastMock()._fireMessage(f(1));
      vi.advanceTimersByTime(100);
      getLastMock()._fireMessage(f(2));
      vi.advanceTimersByTime(100);
      getLastMock()._fireMessage(f(3));
      expect(invalidateSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

});
