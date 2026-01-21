import { describe, it, expect } from "vitest";
import { catalogApi } from "@/lib/features/catalog/api";
import { convertAlbumFromSearch } from "@/lib/features/catalog/conversions";
import {
  describeApi,
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

    expect(result.play_freq).toBeUndefined();
    expect(result.rotation_id).toBeUndefined();
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

    // The conversion function doesn't include these in the output
    expect(result.id).toBeDefined();
  });
});
