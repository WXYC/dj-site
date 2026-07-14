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
  TEST_ENTITY_IDS,
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

    // Arrow-key navigation between search results moves to a different
    // album_id (each result is a distinct release). track_position picked on
    // the previous result would orphan onto the new release if not cleared.
    // Re-selecting the SAME index (e.g. on mouseover) must preserve a freshly
    // picked position. (dj-site#704)
    describe("setSelectedResult track_position hygiene", () => {
      it("clears track_position when the selected result index changes", () => {
        const result = harness().chain(
          actions.setSelectedResult(2),
          actions.setTrackPosition("A1"),
          actions.setSelectedResult(3)
        );
        expect(result.search.query.track_position).toBeUndefined();
      });

      it("preserves track_position when the selected result index is unchanged", () => {
        const result = harness().chain(
          actions.setSelectedResult(2),
          actions.setTrackPosition("A1"),
          actions.setSelectedResult(2)
        );
        expect(result.search.query.track_position).toBe("A1");
      });
    });

  });

  describe("smart-entry search actions", () => {
    describe("setParsedFields", () => {
      it("replaces all four text fields in one dispatch", () => {
        const result = harness().reduce(
          actions.setParsedFields({
            song: "Percolator",
            artist: "Stereolab",
            album: "Dots and Loops",
            label: "Duophonic",
          })
        );
        expect(result.search.query.song).toBe("Percolator");
        expect(result.search.query.artist).toBe("Stereolab");
        expect(result.search.query.album).toBe("Dots and Loops");
        expect(result.search.query.label).toBe("Duophonic");
      });

      it("leaves rotation/album linkage untouched", () => {
        const seeded: FlowsheetFrontendState = {
          ...harness().initialState,
          search: {
            ...harness().initialState.search,
            query: {
              ...harness().initialState.search.query,
              album_id: 123,
              rotation_id: 456,
              rotation_bin: "H" as const,
            },
          },
        };
        const result = harness().reduce(
          actions.setParsedFields({
            song: "x",
            artist: "y",
            album: "z",
            label: "w",
          }),
          seeded
        );
        expect(result.search.query.album_id).toBe(123);
        expect(result.search.query.rotation_id).toBe(456);
        expect(result.search.query.rotation_bin).toBe("H");
      });
    });

    describe("setSelectedMatch / clearSelectedMatch", () => {
      const match = {
        id: 4201,
        album_id: 4201,
        rotation_id: 12,
        rotation_bin: "H" as const,
        artist: "Stereolab",
        album: "Dots and Loops",
        label: "Duophonic",
      };

      it("records the selected match without overwriting typed query text", () => {
        const result = harness().chain(
          actions.setParsedFields({
            song: "Percolator",
            artist: "Stereo",
            album: "",
            label: "",
          }),
          actions.setSelectedMatch(match)
        );
        expect(result.search.selectedMatch).toEqual(match);
        // The typed artist/album/label are NOT clobbered (anti-clobber rule).
        expect(result.search.query.artist).toBe("Stereo");
        expect(result.search.query.album).toBe("");
      });

      // Selecting a different match moves the album anchor; a previously picked
      // track_position would orphan onto the new release. (dj-site#704)
      it("clears track_position on selection", () => {
        const result = harness().chain(
          actions.setTrackPosition("A1"),
          actions.setSelectedMatch(match)
        );
        expect(result.search.query.track_position).toBeUndefined();
      });

      it("clearSelectedMatch nulls the match and clears track_position", () => {
        const result = harness().chain(
          actions.setSelectedMatch(match),
          actions.setTrackPosition("A1"),
          actions.clearSelectedMatch()
        );
        expect(result.search.selectedMatch).toBeNull();
        expect(result.search.query.track_position).toBeUndefined();
      });
    });

    describe("filters", () => {
      it("sets filters wholesale", () => {
        const result = harness().reduce(
          actions.setSearchFilters({
            genres: ["Rock"],
            formats: ["Vinyl"],
            rotationTags: ["H"],
          })
        );
        expect(result.search.filters).toEqual({
          genres: ["Rock"],
          formats: ["Vinyl"],
          rotationTags: ["H"],
        });
      });

      it("toggles a filter value on and off", () => {
        const on = harness().reduce(
          actions.toggleSearchFilter({ dimension: "genres", value: "Jazz" })
        );
        expect(on.search.filters.genres).toEqual(["Jazz"]);
        const off = harness().reduce(
          actions.toggleSearchFilter({ dimension: "genres", value: "Jazz" }),
          on
        );
        expect(off.search.filters.genres).toEqual([]);
      });
    });

    it("resetSearch clears selectedMatch and filters", () => {
      const result = harness().chain(
        actions.setSelectedMatch({
          id: 1,
          artist: "a",
          album: "b",
          label: "c",
        }),
        actions.setSearchFilters({
          genres: ["Rock"],
          formats: [],
          rotationTags: [],
        }),
        actions.resetSearch()
      );
      expect(result.search.selectedMatch).toBeNull();
      expect(result.search.filters).toEqual(
        defaultFlowsheetFrontendState.search.filters
      );
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

    it.each([
      { input: true, expected: true },
      { input: false, expected: false },
      { input: undefined, expected: undefined },
    ])(
      "should carry segue=$input from the query onto the queue entry",
      ({ input, expected }) => {
        const query = createTestFlowsheetQuery({ segue: input });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].segue).toBe(expected);
      }
    );

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

    describe("addToQueue album-linkage sanitization (dj-site#703)", () => {
      // The Modern rotation picker + bin/catalog deposit paths can feed
      // addToQueue with a synthesized negative album_id (from
      // synthesizeAlbumId, for library-unlinked rows). SongEntry's "Play Now"
      // bypasses convertQueryToSubmission and would forward the negative id to
      // BS — same 500 PR #702 fixed for the form-submit path. Sanitize at the
      // reducer so the queue never holds a synthesized id, mirroring the
      // chokepoint logic in convertQueryToSubmission.
      it("strips album_id, rotation_id, and rotation when album_id is a synthesized negative hash", () => {
        const query = createTestFlowsheetQuery({
          album_id: -123456,
          rotation_id: 7,
          rotation_bin: "H",
        });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].album_id).toBeUndefined();
        expect(result.queue[0].rotation_id).toBeUndefined();
        expect(result.queue[0].rotation).toBeUndefined();
      });

      it("strips the catalog-anchored trio when album_id is zero", () => {
        const query = createTestFlowsheetQuery({
          album_id: 0,
          rotation_id: 7,
          rotation_bin: "H",
        });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].album_id).toBeUndefined();
        expect(result.queue[0].rotation_id).toBeUndefined();
        expect(result.queue[0].rotation).toBeUndefined();
      });

      it("strips orphaned rotation linkage when album_id is undefined", () => {
        const query = createTestFlowsheetQuery({
          album_id: undefined,
          rotation_id: 7,
          rotation_bin: "H",
        });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].album_id).toBeUndefined();
        expect(result.queue[0].rotation_id).toBeUndefined();
        expect(result.queue[0].rotation).toBeUndefined();
      });

      it("preserves the catalog-anchored trio when album_id is a positive library.id", () => {
        const query = createTestFlowsheetQuery({
          album_id: 1001,
          rotation_id: 7,
          rotation_bin: "H",
        });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].album_id).toBe(1001);
        expect(result.queue[0].rotation_id).toBe(7);
        expect(result.queue[0].rotation).toBe("H");
      });

      it("preserves freeform fields (song/artist/album/label/segue/request) regardless of album_id", () => {
        const query = createTestFlowsheetQuery({
          song: "Track Title",
          artist: "Artist Name",
          album: "Album Title",
          label: "Record Label",
          segue: true,
          request: true,
          album_id: -1,
          rotation_id: 7,
          rotation_bin: "H",
        });
        const result = harness().reduce(actions.addToQueue(query));
        expect(result.queue[0].track_title).toBe("Track Title");
        expect(result.queue[0].artist_name).toBe("Artist Name");
        expect(result.queue[0].album_title).toBe("Album Title");
        expect(result.queue[0].record_label).toBe("Record Label");
        expect(result.queue[0].segue).toBe(true);
        expect(result.queue[0].request_flag).toBe(true);
      });
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

    describe("loadQueue album-linkage sanitization (dj-site#703)", () => {
      // Queues persisted to localStorage before #703 shipped may contain rows
      // with synthesized negative album_id. Sanitize on load so a stale
      // poisoned queue can't leak a negative album_id via SongEntry "Play Now"
      // after the user reloads the page.
      it("sanitizes poisoned localStorage entries with negative album_id", () => {
        const poisoned = createTestFlowsheetEntry({
          id: 1,
          album_id: -42,
          rotation_id: 7,
          rotation: "H",
        });
        mockedLoadQueue.mockReturnValueOnce([poisoned]);

        const result = harness().reduce(actions.loadQueue());
        expect(result.queue[0].album_id).toBeUndefined();
        expect(result.queue[0].rotation_id).toBeUndefined();
        expect(result.queue[0].rotation).toBeUndefined();
      });

      it("preserves linkage for library-linked entries on load", () => {
        const linked = createTestFlowsheetEntry({
          id: 1,
          album_id: 1001,
          rotation_id: 7,
          rotation: "H",
        });
        mockedLoadQueue.mockReturnValueOnce([linked]);

        const result = harness().reduce(actions.loadQueue());
        expect(result.queue[0].album_id).toBe(1001);
        expect(result.queue[0].rotation_id).toBe(7);
        expect(result.queue[0].rotation).toBe("H");
      });
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

  describe("setIsDragging", () => {
    it("should default to not dragging", () => {
      expect(harness().initialState.isDragging).toBe(false);
    });

    it("should set dragging state", () => {
      const result = harness().reduce(actions.setIsDragging(true));
      expect(result.isDragging).toBe(true);
    });

    it("should clear dragging state", () => {
      const result = harness().chain(
        actions.setIsDragging(true),
        actions.setIsDragging(false)
      );
      expect(result.isDragging).toBe(false);
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

    it("should select dragging state", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getIsDragging)).toBe(false);
      dispatch(actions.setIsDragging(true));
      expect(select(flowsheetSlice.selectors.getIsDragging)).toBe(true);
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
