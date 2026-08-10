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
import {
  createTestInsertWirePayload,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

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

const SEED_WIRE_ROW = {
  id: 5000,
  entry_type: "track",
  play_order: 1,
  show_id: 7000,
  track_title: "la paradoja",
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  request_flag: false,
};

/**
 * Prime getInfiniteEntries through a real MSW GET so RTK Query treats the
 * cache as a fully-initialized entry (upsertQueryData proved unreliable for
 * infinite queries on this RTK Query version).
 */
async function makeStoreWithSeededEntries(rows: unknown[] = [SEED_WIRE_ROW]) {
  server.use(
    http.get(`${TEST_BACKEND_URL}/flowsheet/`, () => HttpResponse.json(rows))
  );
  const store = makeStore();
  await store
    .dispatch(flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined))
    .unwrap();
  return store;
}

function insertFrame(payload: unknown): string {
  return JSON.stringify({
    type: "insert",
    payload,
    timestamp: "2026-08-10T20:00:00.000Z",
  });
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
      expect.objectContaining({ topic: "live-fs-topic", surface: "dashboard" })
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
    const store = await makeStoreWithSeededEntries([
      { ...SEED_WIRE_ROW, id: 9001 },
    ]);

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

  it("drops null-valued wire keys from an update merge so converted sentinels survive", async () => {
    // The raw wire row carries `null` for every unset column. Copying those
    // over the CONVERTED cache row would flip the folded record_label ""
    // back to null (rendered downstream as the literal string "null") and
    // clobber the -1 orphan show_id sentinel, collapsing the live-show
    // partition. Non-null fills must still ride the same merge.
    const store = await makeStoreWithSeededEntries([
      { ...SEED_WIRE_ROW, id: 9001 },
    ]);

    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({
        type: "update",
        payload: createTestInsertWirePayload({
          id: 9001,
          record_label: null,
          show_id: null,
          rotation_bin: "H",
          artwork_url: "https://cdn.example/artwork.jpg",
        }),
        timestamp: 1,
      })
    );

    const after = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
      store.getState()
    ).data;
    expect(after?.pages?.[0]?.[0]).toMatchObject({
      id: 9001,
      record_label: "Sonamos",
      show_id: 7000,
      artwork_url: "https://cdn.example/artwork.jpg",
    });
    // Wire-only keys must not graft onto the converted cache row —
    // rotation_bin in particular maps to the converted `rotation` key, so a
    // raw merge would write a field the badge never reads.
    const patched = after?.pages?.[0]?.[0] as Record<string, unknown>;
    expect("entry_type" in patched).toBe(false);
    expect("metadata_status" in patched).toBe(false);
    expect("add_time" in patched).toBe(false);
    expect("rotation_bin" in patched).toBe(false);

    store.dispatch(liveUpdatesConnectionReleased());
  });

  it("an update for a row cached only in NowPlaying schedules the entries repair", async () => {
    // A row reaches getNowPlaying without entering the entries cache via a
    // skip-lane nudge or the /latest poll; its terminal-enrichment update is
    // the only guaranteed follow-up event, so it must carry the Flowsheet
    // refetch or the row stays invisible in the list until the slow poll.
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/latest`, () =>
        HttpResponse.json({
          ...SEED_WIRE_ROW,
          id: 9002,
          play_order: 2,
        })
      )
    );
    const store = await makeStoreWithSeededEntries();
    await store
      .dispatch(flowsheetApi.endpoints.getNowPlaying.initiate(undefined))
      .unwrap();

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(
        frame({
          type: "update",
          payload: makeSongEntry({ id: 9002 }),
          timestamp: 1,
        })
      );

      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet"]);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("rejects an insert event whose payload is null", () => {
    const store = makeStore();
    const updateSpy = vi.spyOn(flowsheetApi.util, "updateQueryData");
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "insert", payload: null, timestamp: 1 })
    );
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it("rejects an insert event whose payload has no numeric id", () => {
    const store = makeStore();
    const updateSpy = vi.spyOn(flowsheetApi.util, "updateQueryData");
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(
      frame({ type: "insert", payload: {}, timestamp: 1 })
    );
    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
  });

  it("converts the raw wire row before inserting it (nulls fold, sentinel maps, no internal keys graft)", async () => {
    const store = await makeStoreWithSeededEntries();

    store.dispatch(liveUpdatesConnectionRequested());
    // record_label null (the tubafrenzy-webhook shape) and show_id null (a
    // stub-showless webhook row) — the two raw values that corrupted the
    // cache when the wire row was installed unconverted: a "null" string
    // label rendered (and could be PATCHed back), and the unmapped null
    // show_id bypassed the -1 orphan sentinel and collapsed the partition.
    getLastMock()._fireMessage(
      insertFrame(createTestInsertWirePayload({ record_label: null, show_id: null }))
    );

    expect(captureSpy).not.toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );

    const after = flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
      store.getState()
    ).data;
    // Newest-first: the freshly inserted higher id sorts ahead of the
    // pre-existing lower id on page 0.
    expect(after?.pages?.[0]?.map((e) => e.id)).toEqual([9002, 5000]);
    const inserted = after?.pages?.[0]?.[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({
      id: 9002,
      track_title: "Back, Baby",
      artist_name: "Jessica Pratt",
      record_label: "", // converted, never the literal null / "null"
      show_id: -1, // convertV2Entry's orphan sentinel, not raw null
    });
    // Internal wire keys must not graft onto the typed cache row.
    expect("entry_type" in inserted).toBe(false);
    expect("metadata_status" in inserted).toBe(false);
    expect("add_time" in inserted).toBe(false);

    store.dispatch(liveUpdatesConnectionReleased());
  });

  it("skips the merge for a cached-id insert and nudges NowPlaying only, never Flowsheet", async () => {
    // A cached id is either the sender's own echo (their addToFlowsheet
    // pipeline owns the row; the echoed broadcast carries the PRE-enrichment
    // row — artwork null, metadata pending — so merging it would revert
    // enriched fields, and a Flowsheet refetch per self-echo collapses the
    // sender's loaded pages to the first fetch during rapid adds; the
    // entry-caching E2E pins this) or a receiver whose refetch raced the
    // frame — whose NowPlaying cache never otherwise learns about the row,
    // hence the NowPlaying-only nudge.
    const store = await makeStoreWithSeededEntries([
      {
        ...SEED_WIRE_ROW,
        id: 9001,
        artwork_url: "https://cdn.example/artwork.jpg",
      },
    ]);

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(
        insertFrame(createTestInsertWirePayload({ id: 9001, artwork_url: null }))
      );

      const after = flowsheetApi.endpoints.getInfiniteEntries.select(
        undefined
      )(store.getState()).data;
      const matches = (after?.pages ?? [])
        .flat()
        .filter((e) => e.id === 9001);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({
        id: 9001,
        // Preserved — the raw pre-enrichment echo did not null it back out.
        artwork_url: "https://cdn.example/artwork.jpg",
      });

      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(["NowPlaying"]);
      expect(
        invalidateSpy.mock.calls.some((c) =>
          (c[0] as string[]).includes("Flowsheet")
        )
      ).toBe(false);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("treats a new id as the sender's early echo while an optimistic temp row is pending: no splice, no refetch", async () => {
    // BS broadcasts at commit, BEFORE the sender's POST response resolves the
    // optimistic temp id — so with a temp song row pending, an unknown real
    // id is almost certainly this client's own row. Splicing it would render
    // a duplicate beside the optimistic row, the full backstop would replay
    // pageParams per self-add, and even a NowPlaying nudge is redundant —
    // the sender's own mutation invalidates NowPlaying on fulfillment.
    const store = await makeStoreWithSeededEntries();

    // Simulate addToFlowsheet's optimistic insert (negative temp id).
    store.dispatch(
      flowsheetApi.util.updateQueryData(
        "getInfiniteEntries",
        undefined,
        (draft) => {
          draft.pages[0].unshift({
            id: -777,
            play_order: 2,
            show_id: 7000,
            track_title: "Back, Baby",
            artist_name: "Jessica Pratt",
            album_title: "On Your Own Love Again",
            record_label: "Drag City",
            request_flag: false,
          });
        }
      )
    );

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(
        insertFrame(createTestInsertWirePayload({ id: 9002 }))
      );

      const after = flowsheetApi.endpoints.getInfiniteEntries.select(
        undefined
      )(store.getState()).data;
      expect((after?.pages ?? []).flat().some((e) => e.id === 9002)).toBe(
        false
      );

      vi.advanceTimersByTime(600);
      expect(invalidateSpy).not.toHaveBeenCalled();
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("rejects an insert whose entry_type is not 'track' as contract drift, without splicing", async () => {
    // The insert contract is a track row; a marker (or unknown) entry_type
    // would convert to a corrupt row — the marker arms derive display dates
    // from fields a track row carries differently — so the guard rejects the
    // frame and drift surfaces as sse_unknown_event_type, never as a silent
    // bad splice or an exception escaping es.onmessage.
    const store = await makeStoreWithSeededEntries();

    const updateSpy = vi.spyOn(flowsheetApi.util, "updateQueryData");
    store.dispatch(liveUpdatesConnectionRequested());
    expect(() =>
      getLastMock()._fireMessage(
        insertFrame({
          ...createTestInsertWirePayload({ id: 9400 }),
          entry_type: "hologram",
        })
      )
    ).not.toThrow();

    expect(captureSpy).toHaveBeenCalledWith(
      "sse_unknown_event_type",
      expect.anything()
    );
    expect(updateSpy).not.toHaveBeenCalled();
    updateSpy.mockRestore();
    store.dispatch(liveUpdatesConnectionReleased());
  });

  it("caps debounce deferral so a sustained insert stream cannot starve the backstop refetch", async () => {
    const store = await makeStoreWithSeededEntries();

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      // Eight inserts 400ms apart: each gap is inside the 500ms debounce, so
      // a trailing-only debounce would keep resetting the timer and never
      // fire for the whole stream. The max-wait ceiling forces a flush.
      for (let i = 0; i < 8; i++) {
        getLastMock()._fireMessage(
          insertFrame(
            createTestInsertWirePayload({ id: 9300 + i, play_order: 2 + i })
          )
        );
        vi.advanceTimersByTime(400);
      }
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet", "NowPlaying"]);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("drops the pending invalidate on connection release — no dispatch into a dismounting tree", async () => {
    // Flushing here would be worse than dropping: with the surfaces
    // unmounting, invalidateTags reaches zero-subscriber queries, and RTK
    // hard-DELETES those (removeQueryResult) instead of marking them stale —
    // destroying the warm cache keepUnusedDataFor exists to preserve.
    const store = await makeStoreWithSeededEntries();

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(insertFrame(createTestInsertWirePayload()));
      expect(invalidateSpy).not.toHaveBeenCalled();

      store.dispatch(liveUpdatesConnectionReleased());
      expect(invalidateSpy).not.toHaveBeenCalled();

      // The armed timer was cleared with the pending tags — nothing fires
      // later either.
      vi.advanceTimersByTime(600);
      expect(invalidateSpy).not.toHaveBeenCalled();
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("schedules a debounced Flowsheet+NowPlaying invalidate for a genuinely new insert", async () => {
    // The invalidate is the consistency backstop the patch alone can't
    // provide: NowPlaying can't know about a brand-new row (its id is never
    // the cached one), non-broadcast marker rows only arrive via refetch, and
    // the refetch re-syncs offset-based pageParams after pages[0] grew.
    const store = await makeStoreWithSeededEntries();

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(insertFrame(createTestInsertWirePayload()));

      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet", "NowPlaying"]);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("captures uninitialized-cache telemetry once per connection and schedules the repair invalidate per insert", () => {
    // RTK's updateQueryData silently no-ops on an uninitialized cache (the
    // public /live page, the auth-gated dashboard skip): without this lane an
    // insert would vanish with no telemetry and no refetch — worse parity
    // than routeUpdateEvent's unknown-id branch. The capture is deduped per
    // connection: /live never mounts the entries query, so every
    // station-wide add lands here and a per-insert capture would be a
    // permanent telemetry flood.
    vi.useFakeTimers();
    const store = makeStore();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      getLastMock()._fireMessage(insertFrame(createTestInsertWirePayload()));
      getLastMock()._fireMessage(
        insertFrame(createTestInsertWirePayload({ id: 9003, play_order: 3 }))
      );

      expect(captureSpy).toHaveBeenCalledWith(
        "sse_cache_uninitialized",
        expect.objectContaining({
          surface: "dashboard",
          event_type: "insert",
          payload_id: 9002,
        })
      );
      expect(
        captureSpy.mock.calls.filter(
          (c) => c[0] === "sse_cache_uninitialized"
        )
      ).toHaveLength(1);
      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet", "NowPlaying"]);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
  });

  it("does not spend the uninitialized-cache capture on a pending first GET", async () => {
    // SSE can connect in the same commit the entries query starts; an insert
    // in that sub-second gap is a benign mount race, not the cache-init
    // defect the capture signals — and it must not consume the connection's
    // single capture either.
    let releaseGet!: () => void;
    const getGate = new Promise<void>((resolve) => {
      releaseGet = resolve;
    });
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, async () => {
        await getGate;
        return HttpResponse.json([SEED_WIRE_ROW]);
      })
    );

    const store = makeStore();
    const pendingFetch = store.dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined)
    );
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(insertFrame(createTestInsertWirePayload()));

    expect(captureSpy).not.toHaveBeenCalledWith(
      "sse_cache_uninitialized",
      expect.anything()
    );

    releaseGet();
    await pendingFetch.unwrap();
    store.dispatch(liveUpdatesConnectionReleased());
  });

  it("stamps surface 'live' on captures from the public store", () => {
    // The surface split is what makes sse_cache_uninitialized diagnostic:
    // "live" occurrences are expected (the public page never mounts the
    // entries query); "dashboard" occurrences signal a real cache-init
    // defect.
    const store = makePublicStore();
    store.dispatch(liveUpdatesConnectionRequested());
    getLastMock()._fireMessage(insertFrame(createTestInsertWirePayload()));

    expect(captureSpy).toHaveBeenCalledWith(
      "sse_cache_uninitialized",
      expect.objectContaining({ surface: "live", payload_id: 9002 })
    );
    store.dispatch(liveUpdatesConnectionReleased());
  });

  it("stops per-row patching past the burst limit and leans on the scheduled refetch", async () => {
    const store = await makeStoreWithSeededEntries();

    vi.useFakeTimers();
    try {
      const invalidateSpy = vi.spyOn(flowsheetApi.util, "invalidateTags");
      store.dispatch(liveUpdatesConnectionRequested());
      // Fake timers freeze Date.now(), so all eight land in one burst window.
      for (let i = 0; i < 8; i++) {
        getLastMock()._fireMessage(
          insertFrame(createTestInsertWirePayload({ id: 9101 + i, play_order: 2 + i }))
        );
      }

      const after = flowsheetApi.endpoints.getInfiniteEntries.select(
        undefined
      )(store.getState()).data;
      // 1 seeded row + at most INSERT_PATCH_BURST_LIMIT (5) patched inserts;
      // the remaining three rows arrive via the debounced refetch instead of
      // three more full-cache produces.
      expect(after?.pages?.[0]).toHaveLength(6);

      vi.advanceTimersByTime(600);
      expect(invalidateSpy).toHaveBeenCalledWith(["Flowsheet", "NowPlaying"]);
      invalidateSpy.mockRestore();
    } finally {
      vi.useRealTimers();
      store.dispatch(liveUpdatesConnectionReleased());
    }
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
