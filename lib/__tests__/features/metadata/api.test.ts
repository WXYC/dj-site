import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { metadataApi } from "@/lib/features/metadata/api";
import {
  createTestStore,
  describeApi,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

describe("metadataApi", () => {
  describeApi(metadataApi, {
    queries: ["getAlbumMetadata", "getArtistMetadata", "getLibraryTracks"],
    mutations: [],
    reducerPath: "metadataApi",
  });

  describe("getLibraryTracks", () => {
    it("hits /proxy/library/:libraryId/tracks and returns the wrapper", async () => {
      const libraryId = 4242;
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/proxy/library/${libraryId}/tracks`,
          () =>
            HttpResponse.json({
              library_id: libraryId,
              discogs_release_id: 901234,
              source: "discogs",
              tracks: [
                {
                  position: "A1",
                  title: "la paradoja",
                  artist_credit: "Juana Molina",
                  duration_ms: 218000,
                },
                {
                  position: "A2",
                  title: "otro track",
                  artist_credit: "Juana Molina",
                  duration_ms: null,
                },
              ],
            })
        )
      );

      const store = createTestStore();
      const result = await store
        .dispatch(metadataApi.endpoints.getLibraryTracks.initiate(libraryId))
        .unwrap();

      expect(result).toEqual({
        library_id: libraryId,
        discogs_release_id: 901234,
        source: "discogs",
        tracks: [
          {
            position: "A1",
            title: "la paradoja",
            artist_credit: "Juana Molina",
            duration_ms: 218000,
          },
          {
            position: "A2",
            title: "otro track",
            artist_credit: "Juana Molina",
            duration_ms: null,
          },
        ],
      });
    });

    it("returns the empty-tracklist wrapper when the release is not Discogs-resolvable", async () => {
      const libraryId = 99;
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/proxy/library/${libraryId}/tracks`,
          () =>
            HttpResponse.json({
              library_id: libraryId,
              discogs_release_id: null,
              source: null,
              tracks: [],
            })
        )
      );

      const store = createTestStore();
      const result = await store
        .dispatch(metadataApi.endpoints.getLibraryTracks.initiate(libraryId))
        .unwrap();

      expect(result.source).toBeNull();
      expect(result.tracks).toEqual([]);
    });
  });
});
