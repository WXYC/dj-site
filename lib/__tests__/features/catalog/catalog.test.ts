import { describe, it, expect } from "vitest";
import { catalogApi } from "@/lib/features/catalog/api";
import { catalogSlice, defaultCatalogFrontendState } from "@/lib/features/catalog/frontend";
import { convertAlbumFromSearch } from "@/lib/features/catalog/conversions";
import {
  describeApi,
  describeSlice,
  createTestAlbumQueryResponse,
  TEST_ENTITY_IDS,
  TEST_SEARCH_STRINGS,
} from "@/lib/test-utils";
import type { AlbumQueryResponse } from "@/lib/features/catalog/types";

describe("catalogApi", () => {
  describeApi(catalogApi, {
    queries: ["searchCatalog", "getInformation", "getFormats", "getGenres"],
    mutations: ["addAlbum", "addArtist", "addFormat", "addGenre"],
    reducerPath: "catalogApi",
  });
});

describe("convertAlbumFromSearch", () => {
  it("should convert API response to AlbumEntry format", () => {
    const apiResponse: AlbumQueryResponse = createTestAlbumQueryResponse({
      id: TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM,
      album_title: TEST_SEARCH_STRINGS.ALBUM_NAME,
      artist_name: TEST_SEARCH_STRINGS.ARTIST_NAME,
      code_letters: "TA",
      code_artist_number: 1,
      code_number: 42,
      format_name: "CD",
      genre_name: "Rock",
      label: TEST_SEARCH_STRINGS.LABEL,
    });

    const result = convertAlbumFromSearch(apiResponse);

    expect(result.id).toBe(TEST_ENTITY_IDS.ALBUM.ROCK_ALBUM);
    expect(result.title).toBe(TEST_SEARCH_STRINGS.ALBUM_NAME);
    expect(result.artist.name).toBe(TEST_SEARCH_STRINGS.ARTIST_NAME);
    expect(result.artist.lettercode).toBe("TA");
    expect(result.artist.numbercode).toBe(1);
    expect(result.artist.genre).toBe("Rock");
    expect(result.entry).toBe(42);
    expect(result.format).toBe("CD");
    expect(result.label).toBe(TEST_SEARCH_STRINGS.LABEL);
  });

  it("should not include rotation data (convertAlbumFromSearch ignores rotation)", () => {
    const apiResponse: AlbumQueryResponse = createTestAlbumQueryResponse({
      play_freq: "H" as any,
      rotation_id: TEST_ENTITY_IDS.ROTATION.HEAVY,
      plays: 25,
    });

    const result = convertAlbumFromSearch(apiResponse);

    expect(result.play_freq).toBeUndefined();
    expect(result.rotation_id).toBeUndefined();
    expect(result.plays).toBe(25);
  });

  it("should default plays to 0 when undefined", () => {
    const apiResponse: AlbumQueryResponse = createTestAlbumQueryResponse({
      plays: undefined,
    });

    const result = convertAlbumFromSearch(apiResponse);
    expect(result.plays).toBe(0);
  });

  it.each([
    ["Vinyl", "Vinyl"],
    ["CD", "CD"],
  ])("should convert format %s correctly", (input, expected) => {
    const response = createTestAlbumQueryResponse({ format_name: input });
    expect(convertAlbumFromSearch(response).format).toBe(expected);
  });

  it("should preserve the add_date", () => {
    const apiResponse = createTestAlbumQueryResponse({
      add_date: "2024-06-08",
    });

    const result = convertAlbumFromSearch(apiResponse);
    expect(result.add_date).toBe("2024-06-08");
  });

  it("should handle distance values when present", () => {
    const apiResponse = createTestAlbumQueryResponse({
      album_dist: 0.5,
      artist_dist: 0.3,
    });

    const result = convertAlbumFromSearch(apiResponse);
    expect(result.id).toBeDefined();
  });
});

describeSlice(catalogSlice, defaultCatalogFrontendState, ({ harness, actions }) => {
  describe("mobile search actions", () => {
    it("should open mobile search", () => {
      const result = harness().reduce(actions.openMobileSearch());
      expect(result.search.mobileOpen).toBe(true);
    });

    it("should close mobile search", () => {
      const result = harness().chain(
        actions.openMobileSearch(),
        actions.closeMobileSearch()
      );
      expect(result.search.mobileOpen).toBe(false);
    });
  });

  describe("selection actions", () => {
    it("should set selection", () => {
      const result = harness().reduce(actions.setSelection([1, 2, 3]));
      expect(result.results.selected).toEqual([1, 2, 3]);
    });

    it("should add to selection", () => {
      const result = harness().chain(
        actions.setSelection([1, 2]),
        actions.addSelection(3)
      );
      expect(result.results.selected).toEqual([1, 2, 3]);
    });

    it("should remove from selection", () => {
      const result = harness().chain(
        actions.setSelection([1, 2, 3]),
        actions.removeSelection(2)
      );
      expect(result.results.selected).toEqual([1, 3]);
    });

    it("should clear selection", () => {
      const result = harness().chain(
        actions.setSelection([1, 2, 3]),
        actions.clearSelection()
      );
      expect(result.results.selected).toEqual([]);
    });

    it("should handle removing non-existent item", () => {
      const result = harness().chain(
        actions.setSelection([1, 2]),
        actions.removeSelection(99)
      );
      expect(result.results.selected).toEqual([1, 2]);
    });
  });

  describe("loadMore action", () => {
    it("should increment n by 10", () => {
      expect(harness().initialState.search.params.n).toBe(10);
      const result = harness().reduce(actions.loadMore());
      expect(result.search.params.n).toBe(20);
    });

    it("should increment n multiple times", () => {
      const result = harness().chain(
        actions.loadMore(),
        actions.loadMore(),
        actions.loadMore()
      );
      expect(result.search.params.n).toBe(40);
    });
  });

  describe("setSearchParams action", () => {
    it.each([
      ["orderBy", { orderBy: "artist" }, "artist"],
      ["orderDirection", { orderDirection: "desc" }, "desc"],
      ["n", { n: 50 }, 50],
    ] as const)("should update %s", (_, params, expected) => {
      const result = harness().reduce(actions.setSearchParams(params));
      const key = Object.keys(params)[0] as keyof typeof params;
      expect(result.search.params[key]).toBe(expected);
    });

    it("should merge with existing params", () => {
      const result = harness().chain(
        actions.setSearchParams({ orderBy: "artist" }),
        actions.setSearchParams({ orderDirection: "desc" })
      );
      expect(result.search.params.orderBy).toBe("artist");
      expect(result.search.params.orderDirection).toBe("desc");
    });
  });

  describe("setSearchQuery action", () => {
    it("should reset n to 10 when setting query", () => {
      const result = harness().chain(
        actions.loadMore(),
        actions.setSearchQuery("new search")
      );
      expect(result.search.params.n).toBe(10);
      expect(result.search.query).toBe("new search");
    });
  });

  describe("selectors", () => {
    it("should select search query", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSearchQuery("test query"));
      expect(select(catalogSlice.selectors.getSearchQuery)).toBe("test query");
    });

    it("should select search params", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSearchParams({ orderBy: "artist" }));
      const params = select(catalogSlice.selectors.getSearchParams);
      expect(params.orderBy).toBe("artist");
    });

    it("should select search in", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSearchIn("Artists"));
      expect(select(catalogSlice.selectors.getSearchIn)).toBe("Artists");
    });

    it("should select search genre", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSearchGenre("Rock"));
      expect(select(catalogSlice.selectors.getSearchGenre)).toBe("Rock");
    });

    it("should select mobile search open state", () => {
      const { dispatch, select } = harness().withStore();
      expect(select(catalogSlice.selectors.isMobileSearchOpen)).toBe(false);
      dispatch(actions.openMobileSearch());
      expect(select(catalogSlice.selectors.isMobileSearchOpen)).toBe(true);
    });

    it("should select selection", () => {
      const { dispatch, select } = harness().withStore();
      dispatch(actions.setSelection([1, 2, 3]));
      expect(select(catalogSlice.selectors.getSelected)).toEqual([1, 2, 3]);
    });
  });

  describe("reset action", () => {
    it("should reset to default state", () => {
      const result = harness().chain(
        actions.setSearchQuery("test"),
        actions.setSearchIn("Artists"),
        actions.openMobileSearch(),
        actions.setSelection([1, 2]),
        actions.loadMore(),
        actions.reset()
      );
      expect(result).toEqual(defaultCatalogFrontendState);
    });
  });
});
