import { describe, it, expect, vi } from "vitest";
import {
  flowsheetSlice,
  defaultFlowsheetFrontendState,
} from "@/lib/features/flowsheet/frontend";
import {
  describeSlice,
  createTestFlowsheetQuery,
  createTestFlowsheetEntry,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { FlowsheetFrontendState, FlowsheetEntry } from "@/lib/features/flowsheet/types";

vi.mock("@/lib/features/flowsheet/queue-storage", () => ({
  saveQueueToStorage: vi.fn(),
  loadQueueFromStorage: vi.fn(() => []),
  clearQueueFromStorage: vi.fn(),
}));

import {
  saveQueueToStorage,
  loadQueueFromStorage,
  clearQueueFromStorage,
} from "@/lib/features/flowsheet/queue-storage";

const mockedSaveQueue = vi.mocked(saveQueueToStorage);
const mockedLoadQueue = vi.mocked(loadQueueFromStorage);
const mockedClearQueue = vi.mocked(clearQueueFromStorage);

describeSlice(flowsheetSlice, defaultFlowsheetFrontendState, ({ harness, actions }) => {
  describe("setAutoplay", () => {
    it.each([true, false])("should set autoplay to %s", (value) => {
      const result = harness().reduce(actions.setAutoplay(value));
      expect(result.autoplay).toBe(value);
    });
  });

  describe("search actions", () => {
    it("should open search panel", () => {
      const result = harness().reduce(actions.setSearchOpen(true));
      expect(result.search.open).toBe(true);
    });

    it("should close search panel", () => {
      const opened = harness().reduce(actions.setSearchOpen(true));
      const result = harness().reduce(actions.setSearchOpen(false), opened);
      expect(result.search.open).toBe(false);
    });

    it.each(["song", "artist", "album", "label"] as const)(
      "should set search property %s",
      (property) => {
        const result = harness().reduce(
          actions.setSearchProperty({ name: property, value: "test value" })
        );
        expect(result.search.query[property]).toBe("test value");
      }
    );

    it("should toggle request flag", () => {
      expect(harness().initialState.search.query.request).toBe(false);
      const toggled = harness().reduce(actions.toggleRequest());
      expect(toggled.search.query.request).toBe(true);
      const toggledBack = harness().reduce(actions.toggleRequest(), toggled);
      expect(toggledBack.search.query.request).toBe(false);
    });

    it("should reset search to defaults", () => {
      const result = harness().chain(
        actions.setSearchOpen(true),
        actions.setSearchProperty({ name: "artist", value: "Test Artist" }),
        actions.setSelectedResult(5),
        actions.resetSearch()
      );
      expect(result.search.open).toBe(false);
      expect(result.search.query).toEqual(defaultFlowsheetFrontendState.search.query);
      expect(result.search.selectedResult).toBe(0);
    });

    it("should set selected result", () => {
      const result = harness().reduce(actions.setSelectedResult(3));
      expect(result.search.selectedResult).toBe(3);
    });
  });

  describe("queue actions", () => {
    it("should add item to queue", () => {
      const query = createTestFlowsheetQuery();
      const result = harness().reduce(actions.addToQueue(query));
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].track_title).toBe(query.song);
      expect(result.queue[0].artist_name).toBe(query.artist);
      expect(result.queue[0].album_title).toBe(query.album);
      expect(result.queue[0].record_label).toBe(query.label);
      expect(result.queue[0].request_flag).toBe(query.request);
      expect(result.queue[0].show_id).toBe(-1);
      expect(result.queueIdCounter).toBe(1);
    });

    it("should assign incrementing IDs to queue items", () => {
      const result = harness().chain(
        actions.addToQueue(createTestFlowsheetQuery({ song: "Track 1" })),
        actions.addToQueue(createTestFlowsheetQuery({ song: "Track 2" }))
      );
      expect(result.queue[0].id).toBe(0);
      expect(result.queue[1].id).toBe(1);
      expect(result.queueIdCounter).toBe(2);
    });

    it("should call saveQueueToStorage when adding to queue", () => {
      mockedSaveQueue.mockClear();
      harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      expect(mockedSaveQueue).toHaveBeenCalled();
    });

    it("should remove item from queue", () => {
      const query = createTestFlowsheetQuery();
      const withItem = harness().reduce(actions.addToQueue(query));
      const entryId = withItem.queue[0].id;
      const result = harness().reduce(actions.removeFromQueue(entryId), withItem);
      expect(result.queue).toHaveLength(0);
    });

    it("should not remove items with non-matching ID", () => {
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      const result = harness().reduce(actions.removeFromQueue(999), withItem);
      expect(result.queue).toHaveLength(1);
    });

    it("should call saveQueueToStorage when removing from queue", () => {
      mockedSaveQueue.mockClear();
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      mockedSaveQueue.mockClear();
      harness().reduce(actions.removeFromQueue(withItem.queue[0].id), withItem);
      expect(mockedSaveQueue).toHaveBeenCalled();
    });

    it("should clear the queue", () => {
      const result = harness().chain(
        actions.addToQueue(createTestFlowsheetQuery({ song: "Track 1" })),
        actions.addToQueue(createTestFlowsheetQuery({ song: "Track 2" })),
        actions.clearQueue()
      );
      expect(result.queue).toHaveLength(0);
      expect(result.queueIdCounter).toBe(0);
    });

    it("should call clearQueueFromStorage when clearing queue", () => {
      mockedClearQueue.mockClear();
      harness().reduce(actions.clearQueue());
      expect(mockedClearQueue).toHaveBeenCalled();
    });

    it("should load queue from storage", () => {
      const storedEntries = [
        createTestFlowsheetEntry({ id: 5, track_title: "Stored Track 1" }),
        createTestFlowsheetEntry({ id: 10, track_title: "Stored Track 2" }),
      ];
      mockedLoadQueue.mockReturnValueOnce(storedEntries);

      const result = harness().reduce(actions.loadQueue());
      expect(result.queue).toEqual(storedEntries);
      expect(result.queueIdCounter).toBe(11);
    });

    it("should set queueIdCounter to 0 when loading empty queue", () => {
      mockedLoadQueue.mockReturnValueOnce([]);
      const result = harness().reduce(actions.loadQueue());
      expect(result.queue).toEqual([]);
      expect(result.queueIdCounter).toBe(0);
    });

    it("should update queue entry field", () => {
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      const entryId = withItem.queue[0].id;
      const result = harness().reduce(
        actions.updateQueueEntry({ entry_id: entryId, field: "track_title", value: "Updated Track Title" }),
        withItem
      );
      expect(result.queue[0].track_title).toBe("Updated Track Title");
    });

    it("should not modify state when updating non-existent queue entry", () => {
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      const result = harness().reduce(
        actions.updateQueueEntry({ entry_id: 999, field: "track_title", value: "Should Not Appear" }),
        withItem
      );
      expect(result.queue[0].track_title).toBe(withItem.queue[0].track_title);
    });

    it("should call saveQueueToStorage when updating queue entry", () => {
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      mockedSaveQueue.mockClear();
      harness().reduce(
        actions.updateQueueEntry({ entry_id: withItem.queue[0].id, field: "track_title", value: "New" }),
        withItem
      );
      expect(mockedSaveQueue).toHaveBeenCalled();
    });

    it("should reorder queue", () => {
      const entries = [
        createTestFlowsheetEntry({ id: 0, play_order: 0, track_title: "Track 1" }),
        createTestFlowsheetEntry({ id: 1, play_order: 1, track_title: "Track 2" }),
        createTestFlowsheetEntry({ id: 2, play_order: 2, track_title: "Track 3" }),
      ];

      const stateWithQueue: FlowsheetFrontendState = {
        ...harness().initialState,
        queue: entries,
        queueIdCounter: 3,
      };

      const reorderedEntries = [entries[2], entries[0], entries[1]];
      const result = harness().reduce(actions.reorderQueue(reorderedEntries), stateWithQueue);

      expect(result.queue[0].track_title).toBe("Track 3");
      expect(result.queue[1].track_title).toBe("Track 1");
      expect(result.queue[2].track_title).toBe("Track 2");
    });

    it("should call saveQueueToStorage when reordering queue", () => {
      mockedSaveQueue.mockClear();
      harness().reduce(actions.reorderQueue([]));
      expect(mockedSaveQueue).toHaveBeenCalled();
    });
  });

  describe("setCurrentShowEntries", () => {
    it("should set current show entries", () => {
      const entries: FlowsheetEntry[] = [
        createTestFlowsheetEntry({ id: 1 }),
        createTestFlowsheetEntry({ id: 2 }),
      ];
      const result = harness().reduce(actions.setCurrentShowEntries(entries));
      expect(result.currentShowEntries).toEqual(entries);
    });

    it("should replace existing show entries", () => {
      const first = [createTestFlowsheetEntry({ id: 1 })];
      const second = [createTestFlowsheetEntry({ id: 2 }), createTestFlowsheetEntry({ id: 3 })];
      const result = harness().chain(
        actions.setCurrentShowEntries(first),
        actions.setCurrentShowEntries(second)
      );
      expect(result.currentShowEntries).toEqual(second);
    });
  });

  describe("selectors", () => {
    it("should select autoplay state", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setAutoplay(true));
      expect(select(flowsheetSlice.selectors.getAutoplay)).toBe(true);
    });

    it("should select search open state", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getSearchOpen)).toBe(false);
      dispatch(actions.setSearchOpen(true));
      expect(select(flowsheetSlice.selectors.getSearchOpen)).toBe(true);
    });

    it("should select search query", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSearchProperty({ name: "song", value: "Test Song" }));
      dispatch(actions.setSearchProperty({ name: "artist", value: "Test Artist" }));
      const query = select(flowsheetSlice.selectors.getSearchQuery);
      expect(query.song).toBe("Test Song");
      expect(query.artist).toBe("Test Artist");
    });

    it("should calculate search query length", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getSearchQueryLength)).toBe(0);
      dispatch(actions.setSearchProperty({ name: "song", value: "Test" }));
      dispatch(actions.setSearchProperty({ name: "artist", value: "Artist" }));
      dispatch(actions.toggleRequest());
      expect(select(flowsheetSlice.selectors.getSearchQueryLength)).toBe(3);
    });

    it("should select queue", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.addToQueue(createTestFlowsheetQuery({ song: "Track 1" })));
      dispatch(actions.addToQueue(createTestFlowsheetQuery({ song: "Track 2" })));
      const queue = select(flowsheetSlice.selectors.getQueue);
      expect(queue).toHaveLength(2);
      expect(queue[0].track_title).toBe("Track 1");
      expect(queue[1].track_title).toBe("Track 2");
    });

    it("should select selected result", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getSelectedResult)).toBe(0);
      dispatch(actions.setSelectedResult(5));
      expect(select(flowsheetSlice.selectors.getSelectedResult)).toBe(5);
    });

    it("should select current show entries", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getCurrentShowEntries)).toEqual([]);
      const entries: FlowsheetEntry[] = [createTestFlowsheetEntry({ id: 1 })];
      dispatch(actions.setCurrentShowEntries(entries));
      expect(select(flowsheetSlice.selectors.getCurrentShowEntries)).toEqual(entries);
    });
  });

  describe("reset action", () => {
    it("should reset entire state to defaults", () => {
      const result = harness().chain(
        actions.setAutoplay(true),
        actions.setSearchOpen(true),
        actions.addToQueue(createTestFlowsheetQuery()),
        actions.reset()
      );
      expect(result).toEqual(defaultFlowsheetFrontendState);
    });
  });
});
