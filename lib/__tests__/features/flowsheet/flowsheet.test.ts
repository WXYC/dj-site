import { describe, it, expect } from "vitest";
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
import type { FlowsheetFrontendState } from "@/lib/features/flowsheet/types";

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

    it("should set search property", () => {
      const result = harness().reduce(
        actions.setSearchProperty({ name: "artist", value: TEST_SEARCH_STRINGS.ARTIST_NAME })
      );
      expect(result.search.query.artist).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
    });

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
  });

  describe("queue actions", () => {
    it("should add item to queue", () => {
      const query = createTestFlowsheetQuery();
      const result = harness().reduce(actions.addToQueue(query));
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].track_title).toBe(query.song);
      expect(result.queue[0].artist_name).toBe(query.artist);
      expect(result.queue[0].album_title).toBe(query.album);
      expect(result.queueIdCounter).toBe(1);
    });

    it("should remove item from queue", () => {
      const query = createTestFlowsheetQuery();
      const withItem = harness().reduce(actions.addToQueue(query));
      const entryId = withItem.queue[0].id;
      const result = harness().reduce(actions.removeFromQueue(entryId), withItem);
      expect(result.queue).toHaveLength(0);
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

    it("should update queue entry field", () => {
      const withItem = harness().reduce(actions.addToQueue(createTestFlowsheetQuery()));
      const entryId = withItem.queue[0].id;
      const result = harness().reduce(
        actions.updateQueueEntry({ entry_id: entryId, field: "track_title", value: "Updated Track Title" }),
        withItem
      );
      expect(result.queue[0].track_title).toBe("Updated Track Title");
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
  });

  describe("selectors", () => {
    it("should select autoplay state", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setAutoplay(true));
      expect(select(flowsheetSlice.selectors.getAutoplay)).toBe(true);
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
