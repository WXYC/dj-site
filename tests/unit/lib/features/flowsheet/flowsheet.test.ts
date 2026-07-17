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
} from "@/tests/helpers";
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

    it("resetSearch clears every optional FlowsheetQuery field (#645)", () => {
      // Seed a query where every optional field is populated (rotation
      // metadata, segue, track_position) — the fields the default literal
      // previously omitted — then reset and assert they all read undefined.
      const stateWithAllFields: FlowsheetFrontendState = {
        ...harness().initialState,
        search: {
          ...harness().initialState.search,
          query: {
            song: "la paradoja",
            artist: "Juana Molina",
            album: "DOGA",
            label: "Sonamos",
            request: true,
            segue: true,
            album_id: 42,
            rotation_bin: "H",
            rotation_id: 7,
            track_position: "A1",
          },
        },
      };

      const result = harness().reduce(
        actions.resetSearch(),
        stateWithAllFields
      );

      expect(result.search.query.song).toBe("");
      expect(result.search.query.artist).toBe("");
      expect(result.search.query.album).toBe("");
      expect(result.search.query.label).toBe("");
      expect(result.search.query.request).toBe(false);
      expect(result.search.query.segue).toBeUndefined();
      expect(result.search.query.album_id).toBeUndefined();
      expect(result.search.query.rotation_bin).toBeUndefined();
      expect(result.search.query.rotation_id).toBeUndefined();
      expect(result.search.query.track_position).toBeUndefined();
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

    describe("freezeSelectionToQuery", () => {
      it("should copy the selected entry's fields into the query and deselect", () => {
        const result = harness().chain(
          actions.setSearchProperty({ name: "song", value: "la paradoja" }),
          actions.setSelectedResult(2),
          actions.freezeSelectionToQuery({
            artist: "Juana Molina",
            album: "DOGA",
            label: "Sonamos",
            album_id: 42,
          })
        );

        expect(result.search.query.artist).toBe("Juana Molina");
        expect(result.search.query.album).toBe("DOGA");
        expect(result.search.query.label).toBe("Sonamos");
        expect(result.search.query.album_id).toBe(42);
        expect(result.search.selectedResult).toBe(0);
        // Unrelated fields are not touched
        expect(result.search.query.song).toBe("la paradoja");
      });

      it("should clear album_id when not provided", () => {
        const seeded = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Stereolab",
            album: "Aluminum Tunes",
            label: "Duophonic",
            album_id: 7,
          })
        );
        const result = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Cat Power",
            album: "Moon Pix",
            label: "Matador Records",
          }),
          seeded
        );
        expect(result.search.query.album_id).toBeUndefined();
      });

      // #937 made freeze the click-to-autofill path, so this reducer is now
      // the direct guard for #704: a click onto a different release must drop
      // any track_position picked against the previous one.
      it("clears a previously picked track_position (#704)", () => {
        const seeded = harness().reduce(actions.setTrackPosition("A1"));
        expect(seeded.search.query.track_position).toBe("A1");

        const result = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Jessica Pratt",
            album: "On Your Own Love Again",
            label: "Drag City",
            album_id: 11,
          }),
          seeded
        );
        expect(result.search.query.track_position).toBeUndefined();
      });

      it("should round-trip rotation_id and rotation_bin", () => {
        const result = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Juana Molina",
            album: "DOGA",
            label: "Sonamos",
            album_id: 42,
            rotation_id: 99,
            rotation_bin: "H",
          })
        );
        expect(result.search.query.rotation_id).toBe(99);
        expect(result.search.query.rotation_bin).toBe("H");
      });

      it("should clear rotation_id and rotation_bin when not provided", () => {
        const seeded = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Stereolab",
            album: "Aluminum Tunes",
            label: "Duophonic",
            rotation_id: 5,
            rotation_bin: "M",
          })
        );
        const result = harness().reduce(
          actions.freezeSelectionToQuery({
            artist: "Cat Power",
            album: "Moon Pix",
            label: "Matador Records",
          }),
          seeded
        );
        expect(result.search.query.rotation_id).toBeUndefined();
        expect(result.search.query.rotation_bin).toBeUndefined();
      });
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

    it("lifts queueIdCounter above any reordered id ≥ the current counter (#646)", () => {
      const stateWithQueue: FlowsheetFrontendState = {
        ...harness().initialState,
        queue: [createTestFlowsheetEntry({ id: 0, play_order: 0 })],
        queueIdCounter: 1,
      };

      // A future caller reorders in an entry whose id (9) exceeds the counter;
      // without the recompute a later addToQueue would reuse id 1..9 and
      // collide.
      const reordered = [
        createTestFlowsheetEntry({ id: 9, play_order: 0, track_title: "New" }),
        createTestFlowsheetEntry({ id: 0, play_order: 1, track_title: "Old" }),
      ];
      const result = harness().reduce(
        actions.reorderQueue(reordered),
        stateWithQueue
      );

      expect(result.queueIdCounter).toBe(10);
      // Invariant: counter is strictly greater than every id in the queue.
      for (const entry of result.queue) {
        expect(result.queueIdCounter).toBeGreaterThan(entry.id);
      }
    });

    it("never lowers queueIdCounter on a same-id reorder (#646)", () => {
      const entries = [
        createTestFlowsheetEntry({ id: 0, play_order: 0 }),
        createTestFlowsheetEntry({ id: 1, play_order: 1 }),
      ];
      const stateWithQueue: FlowsheetFrontendState = {
        ...harness().initialState,
        queue: entries,
        queueIdCounter: 5,
      };

      const result = harness().reduce(
        actions.reorderQueue([entries[1], entries[0]]),
        stateWithQueue
      );

      expect(result.queueIdCounter).toBe(5);
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

  describe("rotation mode actions", () => {
    it("should toggle rotation mode on", () => {
      const result = harness().reduce(actions.setRotationMode(true));
      expect(result.rotationMode).toBe(true);
    });

    it("should toggle rotation mode off", () => {
      const withRotation: FlowsheetFrontendState = {
        ...harness().initialState,
        rotationMode: true,
      };
      const result = harness().reduce(actions.setRotationMode(false), withRotation);
      expect(result.rotationMode).toBe(false);
    });

    it("should clear rotation metadata when toggling off", () => {
      const withMetadata: FlowsheetFrontendState = {
        ...harness().initialState,
        rotationMode: true,
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
      const result = harness().reduce(actions.setRotationMode(false), withMetadata);
      expect(result.search.query.album_id).toBeUndefined();
      expect(result.search.query.rotation_id).toBeUndefined();
      expect(result.search.query.rotation_bin).toBeUndefined();
    });

    it("should not clear rotation metadata when toggling on", () => {
      const result = harness().reduce(actions.setRotationMode(true));
      expect(result.search.query).toEqual(harness().initialState.search.query);
    });

    it("should set rotation metadata on query", () => {
      const result = harness().reduce(
        actions.setRotationMetadata({
          album_id: TEST_ENTITY_IDS.ALBUM.ROTATION_ALBUM,
          rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
          rotation_bin: "H" as const,
        })
      );
      expect(result.search.query.album_id).toBe(TEST_ENTITY_IDS.ALBUM.ROTATION_ALBUM);
      expect(result.search.query.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
      expect(result.search.query.rotation_bin).toBe("H");
    });

    // track_position is anchored to a specific album_id (it's a Discogs
    // release_track.position reference). Any reducer that overwrites album_id
    // must clear track_position or it orphans onto the wrong release.
    // (dj-site#704)
    it("setRotationMetadata clears track_position when album_id changes", () => {
      const result = harness().chain(
        actions.setTrackPosition("A1"),
        actions.setRotationMetadata({
          album_id: TEST_ENTITY_IDS.ALBUM.ROTATION_ALBUM,
          rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
          rotation_bin: "H" as const,
        })
      );
      expect(result.search.query.track_position).toBeUndefined();
    });

    it("should preserve rotation mode across resetSearch", () => {
      const result = harness().chain(
        actions.setRotationMode(true),
        actions.setSearchOpen(true),
        actions.setSearchProperty({ name: "artist", value: "Test Artist" }),
        actions.setRotationMetadata({
          album_id: 123,
          rotation_id: 456,
          rotation_bin: "H" as const,
        }),
        actions.resetSearch()
      );
      expect(result.rotationMode).toBe(true);
      expect(result.search.open).toBe(false);
      expect(result.search.query).toEqual(defaultFlowsheetFrontendState.search.query);
      expect(result.search.selectedResult).toBe(0);
    });
  });

  describe("selectors", () => {
    it("should select rotation mode", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(flowsheetSlice.selectors.getRotationMode)).toBe(false);
      dispatch(actions.setRotationMode(true));
      expect(select(flowsheetSlice.selectors.getRotationMode)).toBe(true);
    });

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
