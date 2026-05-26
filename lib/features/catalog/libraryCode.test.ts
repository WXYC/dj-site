import { describe, expect, it } from "vitest";
import { createTestAlbum, createTestArtist } from "@/lib/test-utils";
import {
  albumInfoRequestFromRouteId,
  albumPermalinkSegment,
  catalogAlbumEditPath,
  CATALOG_ADD_PATH,
  encodeLibraryCode,
  formatLibraryCode,
  isCatalogAddPath,
  isCatalogAlbumEditPath,
  isCatalogAlbumViewPath,
  isNumericAlbumId,
  parseLibraryCodeParam,
} from "./libraryCode";

describe("libraryCode", () => {
  it("detects numeric album ids", () => {
    expect(isNumericAlbumId("42")).toBe(true);
    expect(isNumericAlbumId("rock-CA-2-1")).toBe(false);
  });

  it("encodes album entry to library code", () => {
    const album = createTestAlbum({
      artist: createTestArtist({
        genre: "Rock",
        lettercode: "CA",
        numbercode: 2,
      }),
      entry: 1,
    });
    expect(encodeLibraryCode(album)).toBe("rock-CA-2-1");
  });

  it("round-trips format and parse", () => {
    const code = formatLibraryCode({
      genreName: "Rock",
      codeLetters: "ca",
      artistNumber: 2,
      albumEntry: 1,
    });
    expect(parseLibraryCodeParam(code)).toEqual({
      genreSlug: "rock",
      codeLetters: "CA",
      artistNumber: 2,
      albumEntry: 1,
    });
  });

  it("maps route id to album info request", () => {
    expect(albumInfoRequestFromRouteId("99")).toEqual({ album_id: 99 });
    expect(albumInfoRequestFromRouteId("rock-CA-2-1")).toEqual({
      library_code: "rock-CA-2-1",
    });
  });

  it("builds edit and add paths", () => {
    const album = createTestAlbum({
      artist: createTestArtist({ genre: "Rock", lettercode: "CA", numbercode: 2 }),
      entry: 1,
    });
    expect(catalogAlbumEditPath(album)).toBe("/dashboard/catalog/album/rock-CA-2-1/edit");
    expect(CATALOG_ADD_PATH).toBe("/dashboard/catalog/new");
    expect(isCatalogAlbumViewPath("/dashboard/catalog/album/rock-CA-2-1")).toBe(true);
    expect(isCatalogAlbumEditPath("/dashboard/catalog/album/rock-CA-2-1/edit")).toBe(
      true,
    );
    expect(isCatalogAddPath("/dashboard/catalog/new")).toBe(true);
  });

  it("falls back to numeric id when library code cannot be encoded", () => {
    const album = createTestAlbum({
      id: 5150,
      artist: createTestArtist({ lettercode: "", genre: "Unknown" }),
    });
    expect(albumPermalinkSegment(album)).toBe("5150");
  });
});
