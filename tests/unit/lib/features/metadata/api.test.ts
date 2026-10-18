import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { metadataApi } from "@/lib/features/metadata/api";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { describeApi } from "@/tests/helpers/api-harness";

describe("metadataApi", () => {
  describeApi(metadataApi, {
    queries: ["getAlbumMetadata", "getArtistMetadata", "getLibraryTracks"],
    mutations: [],
    reducerPath: "metadataApi",
  });

  describe("getAlbumMetadata", () => {
    const album = { artistName: "Juana Molina", releaseTitle: "DOGA" };

    it.each<[string, Parameters<typeof metadataApi.endpoints.getAlbumMetadata.initiate>[0], boolean]>([
      ["a decorative read marks its failure expected", { ...album, decorative: true }, true],
      ["any other read leaves its failure to the shared toast and report", album, false],
    ])("%s", async (_case, arg, expected) => {
      server.use(
        http.get(`${TEST_BACKEND_URL}/proxy/metadata/album`, () =>
          HttpResponse.json({ message: "Metadata service unavailable" }, { status: 500 }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(metadataApi.endpoints.getAlbumMetadata.initiate(arg));

      expect(result.error).toMatchObject({ status: 500, data: { message: "Metadata service unavailable" } });
      expect((result.error as { expected?: boolean }).expected === true).toBe(expected);
    });

    it("sends only the artist and title, never the decorative flag", async () => {
      let search = "";
      server.use(
        http.get(`${TEST_BACKEND_URL}/proxy/metadata/album`, ({ request }) => {
          search = new URL(request.url).search;
          return HttpResponse.json({ artworkUrl: null });
        }),
      );

      const store = createTestStore();
      await store.dispatch(metadataApi.endpoints.getAlbumMetadata.initiate({ ...album, decorative: true }));

      expect(Object.fromEntries(new URLSearchParams(search))).toEqual({ artistName: "Juana Molina", releaseTitle: "DOGA" });
    });
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
