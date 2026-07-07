import { describe, it, expect } from "vitest";
import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice, defaultCatalogFrontendState } from "@/lib/features/catalog/frontend";
import { convertToAlbumEntry } from "@/lib/features/catalog/conversions";
import {
  describeApi,
  describeSlice,
  describeConversionWithAssertions,
  createTestAlbumSearchResult,
  createTestBinResponse,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import { Rotation } from "@/lib/features/rotation/types";

describe("catalogApi", () => {
  describeApi(catalogApi, {
    queries: [
      "searchCatalog",
      "searchLibraryQuery",
      "getInformation",
      "getFormats",
      "getGenres",
      "peekArtistCode",
      "searchArtistsInGenre",
    ],
    mutations: [
      "addAlbum",
      "addArtist",
      "addFormat",
      "addGenre",
      "updateAlbum",
      "markMissing",
      "markFound",
    ],
    reducerPath: "catalogApi",
  });
});


describe("convertToAlbumEntry", () => {
  describeConversionWithAssertions(
    "from search result (AlbumSearchResultJSON)",
    convertToAlbumEntry,
    [
      {
        name: "should convert basic fields",
        input: createTestAlbumSearchResult({
          id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
          album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
          artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
          code_letters: "TA",
          code_artist_number: 1,
          code_number: 42,
          format_name: "CD",
          genre_name: "Rock",
          label: TEST_SEARCH_STRINGS.LABEL,
        }),
        assertions: (result) => {
          expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
          expect(result.title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
          expect(result.artist.name).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
          expect(result.artist.lettercode).toBe("TA");
          expect(result.artist.numbercode).toBe(1);
          expect(result.artist.genre).toBe("Rock");
          expect(result.entry).toBe(42);
          expect(result.format).toBe("CD");
          expect(result.label).toBe(TEST_SEARCH_STRINGS.LABEL);
        },
      },
      {
        name: "should pass through rotation data when present",
        input: createTestAlbumSearchResult({
          rotation_bin: "H" as any,
          rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
        }),
        assertions: (result) => {
          expect(result.rotation_bin).toBe(Rotation.H);
          expect(result.rotation_id).toBe(TEST_ENTITY_IDS.ROTATION.HEAVY);
        },
      },
      {
        name: "should keep plays undefined when not provided",
        input: createTestAlbumSearchResult({ plays: undefined }),
        assertions: (result) => {
          expect(result.plays).toBeUndefined();
        },
      },
      {
        name: "should preserve add_date",
        input: createTestAlbumSearchResult({ add_date: "2024-06-08" }),
        assertions: (result) => {
          expect(result.add_date).toBe("2024-06-08");
        },
      },
      {
        name: "should pass through date_lost and date_found",
        input: createTestAlbumSearchResult({
          date_lost: "2025-01-15T00:00:00.000Z",
          date_found: "2025-02-20T00:00:00.000Z",
        } as any),
        assertions: (result) => {
          expect(result.date_lost).toBe("2025-01-15T00:00:00.000Z");
          expect(result.date_found).toBe("2025-02-20T00:00:00.000Z");
        },
      },
      {
        name: "should default date_lost and date_found to undefined",
        input: createTestAlbumSearchResult(),
        assertions: (result) => {
          expect(result.date_lost).toBeUndefined();
          expect(result.date_found).toBeUndefined();
        },
      },
      {
        name: "should pass through artwork_url when present",
        input: createTestAlbumSearchResult({
          artwork_url: "https://i.discogs.com/confield.jpg",
        } as any),
        assertions: (result) => {
          expect(result.artwork_url).toBe("https://i.discogs.com/confield.jpg");
        },
      },
      {
        name: "should default artwork_url to undefined",
        input: createTestAlbumSearchResult(),
        assertions: (result) => {
          expect(result.artwork_url).toBeUndefined();
        },
      },
      {
        name: "should pass through matched_via hints when present",
        input: createTestAlbumSearchResult({
          matched_via: [
            { source: "cta", title: "In a Sentimental Mood", confidence: 1.0 },
            {
              source: "discogs_master",
              title: "In a Sentimental Mood",
              position: "A1",
              confidence: 0.92,
            },
          ],
        }),
        assertions: (result) => {
          expect(result.matched_via).toEqual([
            { source: "cta", title: "In a Sentimental Mood", confidence: 1.0 },
            {
              source: "discogs_master",
              title: "In a Sentimental Mood",
              position: "A1",
              confidence: 0.92,
            },
          ]);
        },
      },
      {
        name: "should default matched_via to undefined when absent",
        input: createTestAlbumSearchResult(),
        assertions: (result) => {
          expect(result.matched_via).toBeUndefined();
        },
      },
    ]
  );

  describeConversionWithAssertions(
    "from bin response (BinLibraryDetails)",
    convertToAlbumEntry,
    [
      {
        name: "should use album_id as id",
        input: createTestBinResponse({
          album_id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
        }),
        assertions: (result) => {
          expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
        },
      },
      {
        name: "should convert basic fields from bin response",
        input: createTestBinResponse({
          album_title: "Great Album",
          artist_name: "Cool Artist",
          code_letters: "CA",
          code_artist_number: 42,
          code_number: 99,
          format_name: "Vinyl",
          genre_name: "Jazz",
          label: "Indie Records",
        }),
        assertions: (result) => {
          expect(result.title).toBe("Great Album");
          expect(result.artist.name).toBe("Cool Artist");
          expect(result.artist.lettercode).toBe("CA");
          expect(result.artist.numbercode).toBe(42);
          expect(result.artist.genre).toBe("Jazz");
          expect(result.entry).toBe(99);
          expect(result.format).toBe("Vinyl");
          expect(result.label).toBe("Indie Records");
        },
      },
      {
        name: "should default optional bin fields",
        input: {} as any,
        assertions: (result) => {
          // id is derived from content when album_id is missing; an empty input
          // still gets a stable non-positive synthesized id (see dj-site#564).
          expect(typeof result.id).toBe("number");
          expect(result.id).toBeLessThanOrEqual(0);
          expect(result.title).toBe("");
          expect(result.artist.name).toBe("");
          expect(result.artist.lettercode).toBe("");
          expect(result.artist.numbercode).toBe(0);
          expect(result.entry).toBe(0);
          expect(result.label).toBe("");
        },
      },
      {
        name: "should have no rotation data from bin response",
        input: createTestBinResponse(),
        assertions: (result) => {
          expect(result.rotation_bin).toBeUndefined();
          expect(result.rotation_id).toBeUndefined();
          expect(result.add_date).toBeUndefined();
          expect(result.plays).toBeUndefined();
        },
      },
    ]
  );

  describeConversionWithAssertions(
    "album_artist (compilation handling)",
    convertToAlbumEntry,
    [
      {
        name: "should pass through album_artist when present",
        input: createTestAlbumSearchResult({
          artist_name: "Autechre",
          album_artist: "Autechre",
        }),
        assertions: (result) => {
          expect(result.album_artist).toBe("Autechre");
        },
      },
      {
        name: "should default album_artist to undefined when absent",
        input: createTestAlbumSearchResult(),
        assertions: (result) => {
          expect(result.album_artist).toBeUndefined();
        },
      },
    ]
  );

  describe("bug fixes", () => {
    it("should not set artist.id to the album id", () => {
      const searchResult = createTestAlbumSearchResult({
        id: 999,
      });
      const result = convertToAlbumEntry(searchResult);
      expect(result.artist.id).toBeUndefined();
    });

    // dj-site#564 — BS proxy returns id: null for unlinked rotation/LML rows.
    // Two such rows used to map to AlbumEntry.id = null and collide on React keys
    // (RotationReleaseDropdown.tsx:166 etc.). Conversion must produce distinct,
    // stable, non-null ids so consumers can keep using `key={entry.id}`.
    describe("null id fallback (dj-site#564)", () => {
      it("substitutes a non-null id when search result id is null", () => {
        const result = convertToAlbumEntry(
          createTestAlbumSearchResult({ id: null as unknown as number })
        );
        expect(result.id).not.toBeNull();
        expect(typeof result.id).toBe("number");
      });

      it("substitutes a non-null id when bin response album_id is null", () => {
        const result = convertToAlbumEntry(
          createTestBinResponse({ album_id: null as unknown as number })
        );
        expect(result.id).not.toBeNull();
        expect(typeof result.id).toBe("number");
      });

      it("produces distinct ids for two null-id rows with different content", () => {
        const a = convertToAlbumEntry(
          createTestAlbumSearchResult({
            id: null as unknown as number,
            artist_name: "Juana Molina",
            album_title: "DOGA",
            label: "Sonamos",
          })
        );
        const b = convertToAlbumEntry(
          createTestAlbumSearchResult({
            id: null as unknown as number,
            artist_name: "Cat Power",
            album_title: "Moon Pix",
            label: "Matador Records",
          })
        );
        expect(a.id).not.toBe(b.id);
      });

      it("produces a stable id across re-conversions of the same input", () => {
        const input = createTestAlbumSearchResult({
          id: null as unknown as number,
          artist_name: "Jessica Pratt",
          album_title: "On Your Own Love Again",
          label: "Drag City",
        });
        const a = convertToAlbumEntry(input);
        const b = convertToAlbumEntry(input);
        expect(a.id).toBe(b.id);
      });

      it("preserves real positive ids untouched", () => {
        const result = convertToAlbumEntry(
          createTestAlbumSearchResult({ id: 12345 })
        );
        expect(result.id).toBe(12345);
      });

      it("does not let the fallback collide with real positive album ids", () => {
        const fallback = convertToAlbumEntry(
          createTestAlbumSearchResult({
            id: null as unknown as number,
            artist_name: "Stereolab",
            album_title: "Aluminum Tunes",
          })
        );
        expect(fallback.id).toBeLessThanOrEqual(0);
      });
    });
  });

  it.each([
    ["Vinyl", "Vinyl"],
    ["CD", "CD"],
    ["Unknown format", "Unknown format"],
  ])("should convert format %s correctly", (input, expected) => {
    const response = createTestAlbumSearchResult({ format_name: input });
    expect(convertToAlbumEntry(response).format).toBe(expected);
  });
});

describeSlice(catalogSlice, defaultCatalogFrontendState, ({ harness, actions }) => {
  describe("default state", () => {
    it("starts with a single blank all-field row", () => {
      const state = harness().initialState;
      expect(state.rows).toHaveLength(1);
      expect(state.rows[0]).toMatchObject({
        operator: "AND",
        field: "all",
        value: "",
        exact: false,
      });
    });

    it("defaults sort to album asc", () => {
      const state = harness().initialState;
      expect(state.sortBy).toBe("album");
      expect(state.sortOrder).toBe("asc");
    });

    it("defaults filters to empty arrays", () => {
      expect(harness().initialState.filters).toEqual({
        genres: [],
        formats: [],
        tags: [],
      });
    });

    it("defaults browseEngaged to false", () => {
      expect(harness().initialState.browseEngaged).toBe(false);
    });
  });

  describe("engageBrowse", () => {
    it("sets browseEngaged", () => {
      const result = harness().reduce(actions.engageBrowse());
      expect(result.browseEngaged).toBe(true);
    });
  });

  describe("row CRUD", () => {
    it("addRow appends an artist-field row", () => {
      const result = harness().reduce(actions.addRow());
      expect(result.rows).toHaveLength(2);
      expect(result.rows[1].field).toBe("artist");
    });

    it("removeRow drops a row by id", () => {
      const initial = harness().initialState;
      const firstId = initial.rows[0].id;
      const result = harness().chain(
        actions.addRow(),
        actions.removeRow(firstId)
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows.some((r) => r.id === firstId)).toBe(false);
    });

    it("removeRow refuses to delete the last remaining row", () => {
      const initial = harness().initialState;
      const result = harness().reduce(actions.removeRow(initial.rows[0].id));
      expect(result.rows).toHaveLength(1);
    });

    it("updateRow applies partial updates", () => {
      const initial = harness().initialState;
      const id = initial.rows[0].id;
      const result = harness().reduce(
        actions.updateRow({ id, updates: { field: "artist", value: "Stereolab" } })
      );
      expect(result.rows[0].field).toBe("artist");
      expect(result.rows[0].value).toBe("Stereolab");
    });

  });

  describe("sort", () => {
    it("setSort updates sortBy and sortOrder together", () => {
      const result = harness().reduce(
        actions.setSort({ sortBy: "plays", sortOrder: "desc" })
      );
      expect(result.sortBy).toBe("plays");
      expect(result.sortOrder).toBe("desc");
    });

  });

  describe("filters", () => {
    it.each([
      [{ tags: ["exclusives"] }, "tags", ["exclusives"]],
      [{ genres: ["Rock"] }, "genres", ["Rock"]],
      [{ formats: ["cd"] }, "formats", ["cd"]],
    ] as const satisfies ReadonlyArray<
      [Partial<import("@/lib/features/catalog/types").CatalogFilters>, string, string[]]
    >)("setFilter updates %s", (patch, key, expected) => {
      const result = harness().reduce(actions.setFilter(patch));
      expect((result.filters as Record<string, unknown>)[key as string]).toEqual(expected);
    });

    it("setFilter merges with existing filters", () => {
      const result = harness().chain(
        actions.setFilter({ genres: ["Rock"] }),
        actions.setFilter({ formats: ["Vinyl"] })
      );
      expect(result.filters.genres).toEqual(["Rock"]);
      expect(result.filters.formats).toEqual(["Vinyl"]);
    });

  });

  describe("selection", () => {
    it("setSelection replaces selection", () => {
      const result = harness().reduce(actions.setSelection([1, 2, 3]));
      expect(result.selected).toEqual([1, 2, 3]);
    });

    it("addSelection pushes onto selection", () => {
      const result = harness().chain(
        actions.setSelection([1, 2]),
        actions.addSelection(3)
      );
      expect(result.selected).toEqual([1, 2, 3]);
    });

    it("removeSelection filters by id", () => {
      const result = harness().chain(
        actions.setSelection([1, 2, 3]),
        actions.removeSelection(2)
      );
      expect(result.selected).toEqual([1, 3]);
    });

    it("clearSelection empties the array", () => {
      const result = harness().chain(
        actions.setSelection([1, 2, 3]),
        actions.clearSelection()
      );
      expect(result.selected).toEqual([]);
    });
  });

  describe("mobile search", () => {
    it("openMobileSearch flips the flag", () => {
      const result = harness().reduce(actions.openMobileSearch());
      expect(result.mobileOpen).toBe(true);
    });

    it("closeMobileSearch flips it back", () => {
      const result = harness().chain(
        actions.openMobileSearch(),
        actions.closeMobileSearch()
      );
      expect(result.mobileOpen).toBe(false);
    });
  });

  describe("reset", () => {
    it("returns to default state", () => {
      const initial = harness().initialState;
      const id = initial.rows[0].id;
      const result = harness().chain(
        actions.updateRow({ id, updates: { value: "Cat Power" } }),
        actions.setSort({ sortBy: "plays", sortOrder: "desc" }),
        actions.setFilter({ genres: ["Rock"] }),
        actions.setSelection([1, 2, 3]),
        actions.openMobileSearch(),
        actions.reset()
      );
      expect(result).toEqual(defaultCatalogFrontendState);
    });
  });

});
