import { describe, it, expect, beforeEach, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { getLiveUpdatesListenerHandle } from "@/lib/features/flowsheet/live-updates-listener";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesSlice,
} from "@/lib/features/flowsheet/live-updates-slice";
import type { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { makeStore } from "@/lib/store";
import { makePublicStore } from "@/lib/store-public";
import { server, TEST_BACKEND_URL } from "@/tests/helpers";

// The live-updates connection state is owned per store. Reach a store's
// EventSource / reconnect flag through its listener handle.
function esOf(store: object): EventSource | null {
  const handle = getLiveUpdatesListenerHandle(store);
  if (!handle) throw new Error("store has no live-updates listener handle");
  return handle.getEventSource();
}
function hasEverConnectedOf(store: object): boolean {
  const handle = getLiveUpdatesListenerHandle(store);
  if (!handle) throw new Error("store has no live-updates listener handle");
  return handle.getHasEverConnected();
}

const { captureSpy, captureExceptionSpy } = vi.hoisted(() => ({
  captureSpy: vi.fn(),
  captureExceptionSpy: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({
  safeCapture: captureSpy,
  safeCaptureException: captureExceptionSpy,
}));

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

describe("live-updates listener middleware", () => {
  beforeEach(() => {
    captureSpy.mockClear();
    captureExceptionSpy.mockClear();
  });

  it("opens an EventSource on the 0->1 refCount transition", () => {
    const store = makeStore();
    expect(esOf(store)).toBeNull();

    store.dispatch(liveUpdatesConnectionRequested());

    expect(esOf(store)).not.toBeNull();
    const es = getLastMock();
    expect(es.url).toContain("/events/stream?topics=live-fs-topic");
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("connecting");
  });

  it("does not open a second EventSource on the 1->2 refCount transition", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    const first = esOf(store);
    store.dispatch(liveUpdatesConnectionRequested());
    expect(esOf(store)).toBe(first);
    expect(MockEventSourceCtor._instances).toHaveLength(1);
  });

  it("closes the EventSource on the N->0 refCount transition", () => {
    const store = makeStore();
    store.dispatch(liveUpdatesConnectionRequested());
    store.dispatch(liveUpdatesConnectionRequested());
    expect(esOf(store)).not.toBeNull();
    store.dispatch(liveUpdatesConnectionReleased());
    expect(esOf(store)).not.toBeNull();
    store.dispatch(liveUpdatesConnectionReleased());
    expect(esOf(store)).toBeNull();
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(store.getState())
    ).toBe("closed");
  });

  it("gives each store its own EventSource, independently held", () => {
    // Each store scopes its own ref-count, so each owns a separate connection.
    // A second store requesting while the first is still connected opens its
    // OWN stream rather than aliasing the first's.
    const storeA = makeStore();
    storeA.dispatch(liveUpdatesConnectionRequested());
    const esA = esOf(storeA);
    expect(esA).not.toBeNull();
    expect(MockEventSourceCtor._instances).toHaveLength(1);

    const storeB = makeStore();
    storeB.dispatch(liveUpdatesConnectionRequested());
    const esB = esOf(storeB);
    expect(esB).not.toBeNull();
    expect(esB).not.toBe(esA);
    expect(MockEventSourceCtor._instances).toHaveLength(2);

    // Releasing storeA closes only storeA's stream; storeB keeps its own.
    storeA.dispatch(liveUpdatesConnectionReleased());
    expect(esOf(storeA)).toBeNull();
    expect((esA as unknown as MockES).readyState).toBe(MockEventSourceCtor.CLOSED);
    expect(esOf(storeB)).toBe(esB);
    expect((esB as unknown as MockES).readyState).not.toBe(
      MockEventSourceCtor.CLOSED
    );
  });

  it("keeps the surviving store connected when a subscriber moves between stores and the new request lands before the old release", () => {
    // Soft nav between a public route (public store) and the dashboard (full
    // store) can run the destination's connectionRequested before the source's
    // connectionReleased cleanup. With connection state shared across stores,
    // the old store's release would close a stream the new store still needs,
    // stranding it at ref-count 1 with no EventSource. Per-store ownership must
    // keep the surviving store's stream live through the overlap.
    const oldStore = makePublicStore();
    oldStore.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireOpen();
    const oldEs = esOf(oldStore);
    expect(oldEs).not.toBeNull();

    const newStore = makeStore();
    // New subtree mounts and requests BEFORE the old subtree's release fires.
    newStore.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireOpen();
    const newEs = esOf(newStore);
    expect(newEs).not.toBeNull();
    expect(newEs).not.toBe(oldEs);

    // Old subtree finally unmounts and releases.
    oldStore.dispatch(liveUpdatesConnectionReleased());

    // Invariant: a store with ref-count > 0 still owns a live EventSource.
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesRefCount(newStore.getState())
    ).toBe(1);
    expect(esOf(newStore)).toBe(newEs);
    expect((newEs as unknown as MockES).readyState).not.toBe(
      MockEventSourceCtor.CLOSED
    );
    expect(
      liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus(
        newStore.getState()
      )
    ).toBe("connected");
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

  it.each(["connection-established", "subscription"])(
    "silently drops the %s handshake frame",
    (handshakeType) => {
      const store = makeStore();
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(frame({ type: handshakeType }));
      expect(captureSpy).not.toHaveBeenCalled();
      expect(captureExceptionSpy).not.toHaveBeenCalled();
    }
  );

  it("rejects an update event whose payload is null", () => {
    const store = makeStore();
    const updateSpy = vi.spyOn(flowsheetApi.util, "updateQueryData");
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "update", payload: null, timestamp: 1 })
    );
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it("rejects an update event whose payload has no numeric id", () => {
    const store = makeStore();
    const updateSpy = vi.spyOn(flowsheetApi.util, "updateQueryData");
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "update", payload: {}, timestamp: 1 })
    );
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
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

  describe("reconnect refetch", () => {
    it("does not schedule an invalidate on the first onopen (initial connect)", () => {
      vi.useFakeTimers();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      try {
        const store = makeStore();
        store.dispatch(liveUpdatesConnectionRequested());
        getLastMock()._fireOpen();
        vi.advanceTimersByTime(600);
        expect(invalidateSpy).not.toHaveBeenCalled();
      } finally {
        invalidateSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("schedules a Flowsheet + NowPlaying + WhoIsLive invalidate on the second onopen (browser reconnect after transient drop)", () => {
      vi.useFakeTimers();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      try {
        const store = makeStore();
        store.dispatch(liveUpdatesConnectionRequested());
        // First open — initial connect.
        getLastMock()._fireOpen();
        // Browser sees a transient drop and is retrying transparently.
        getLastMock()._fireError(MockEventSourceCtor.CONNECTING);
        // Browser-initiated retry succeeds — onopen fires again.
        getLastMock()._fireOpen();
        expect(invalidateSpy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(600);
        expect(invalidateSpy).toHaveBeenCalledTimes(1);
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.arrayContaining(["Flowsheet", "NowPlaying", "WhoIsLive"])
        );
      } finally {
        invalidateSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("the refetch envelope also invalidates Flowsheet + NowPlaying + WhoIsLive so DJ join/leave during the ETL window doesn't lag the on-air indicator", () => {
      vi.useFakeTimers();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      try {
        const store = makeStore();
        store.dispatch(liveUpdatesConnectionRequested());
        getLastMock()._fireMessage(
          frame({ type: "refetch", payload: { source: "etl" }, timestamp: 1 })
        );
        vi.advanceTimersByTime(600);
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.arrayContaining(["Flowsheet", "NowPlaying", "WhoIsLive"])
        );
      } finally {
        invalidateSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("coalesces a reconnect-driven refetch with a coincident refetch envelope into one invalidate", () => {
      vi.useFakeTimers();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      try {
        const store = makeStore();
        store.dispatch(liveUpdatesConnectionRequested());
        getLastMock()._fireOpen();
        getLastMock()._fireError(MockEventSourceCtor.CONNECTING);
        getLastMock()._fireOpen();
        getLastMock()._fireMessage(
          frame({ type: "refetch", payload: { source: "etl" }, timestamp: 1 })
        );
        vi.advanceTimersByTime(600);
        expect(invalidateSpy).toHaveBeenCalledTimes(1);
      } finally {
        invalidateSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("resets the reconnect-detect flag on connectionReleased so a fresh subscriber's first onopen is not treated as a reconnect", () => {
      vi.useFakeTimers();
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      try {
        const store = makeStore();

        // First subscriber: connect, fully release.
        store.dispatch(liveUpdatesConnectionRequested());
        getLastMock()._fireOpen();
        store.dispatch(liveUpdatesConnectionReleased());

        // Fresh subscriber after full teardown — first onopen should be
        // treated as an initial connect, not a reconnect. Asserting that a
        // second EventSource was actually constructed guards against a
        // regression that would suppress the re-open path (in which case
        // getLastMock() returns the original ES and _fireOpen() reads a
        // correctly-reset flag for the wrong reason).
        store.dispatch(liveUpdatesConnectionRequested());
        expect(MockEventSourceCtor._instances).toHaveLength(2);
        getLastMock()._fireOpen();
        vi.advanceTimersByTime(600);
        expect(invalidateSpy).not.toHaveBeenCalled();
      } finally {
        invalidateSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("the reconnect-detect flag follows the request → open → release lifecycle", () => {
      const store = makeStore();
      expect(hasEverConnectedOf(store)).toBe(false);
      store.dispatch(liveUpdatesConnectionRequested());
      expect(hasEverConnectedOf(store)).toBe(false);
      getLastMock()._fireOpen();
      expect(hasEverConnectedOf(store)).toBe(true);
      store.dispatch(liveUpdatesConnectionReleased());
      expect(hasEverConnectedOf(store)).toBe(false);
    });

    it("does not set the reconnect-detect flag when the onopen handler's status read throws", () => {
      const store = makeStore();
      store.dispatch(liveUpdatesConnectionRequested());
      // Spy AFTER the requested-effect's initial "connecting" status set, so
      // the next call into the selector is the one inside onopen.
      const selectorSpy = vi
        .spyOn(liveUpdatesSlice.selectors, "selectLiveUpdatesConnectionStatus")
        .mockImplementationOnce(() => {
          throw new Error("simulated status dispatch failure");
        });
      try {
        expect(() => getLastMock()._fireOpen()).toThrow(
          "simulated status dispatch failure"
        );
        // If a future refactor moves `hasEverConnected = true` back above the
        // status dispatch, this assertion flips to true and the test fails —
        // which is the regression we want.
        expect(hasEverConnectedOf(store)).toBe(false);
      } finally {
        selectorSpy.mockRestore();
      }
    });
  });

});
