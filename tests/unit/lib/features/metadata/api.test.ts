import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import type { ArtistMetadata } from "@/lib/features/metadata/types";
import { metadataApi } from "@/lib/features/metadata/api";
import {
  createTestStore,
  describeApi,
  server,
  TEST_BACKEND_URL,
} from "@/tests/helpers";

const ARTIST_ENDPOINT = `${TEST_BACKEND_URL}/proxy/metadata/artist`;

const artistMetadata = (discogsArtistId: number): ArtistMetadata => ({
  discogsArtistId,
  bio: null,
  bioTokens: null,
  wikipediaUrl: null,
  imageUrl: null,
});

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

  // The validator store keyed by RTK Query cache key is a module singleton
  // shared across this file's runs, so every case uses a distinct artistId to
  // avoid cross-test bleed.
  describe("conditional GET revalidation", () => {
    const fetchArtist = (artistId: number, forceRefetch = false) =>
      createTestStore()
        .dispatch(
          metadataApi.endpoints.getArtistMetadata.initiate(
            { artistId },
            { forceRefetch }
          )
        )
        .unwrap();

    it("sends no conditional headers on the first fetch", async () => {
      const artistId = 5001;
      const seen: (string | null)[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          seen.push(request.headers.get("if-none-match"));
          seen.push(request.headers.get("if-modified-since"));
          return HttpResponse.json(artistMetadata(artistId), {
            headers: { ETag: '"rev-1"' },
          });
        })
      );

      await fetchArtist(artistId);

      expect(seen).toEqual([null, null]);
    });

    it("forwards the prior ETag as If-None-Match on a repeat fetch", async () => {
      const artistId = 5002;
      const conditional: (string | null)[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          conditional.push(request.headers.get("if-none-match"));
          return HttpResponse.json(artistMetadata(artistId), {
            headers: { ETag: '"rev-1"' },
          });
        })
      );

      await fetchArtist(artistId);
      await fetchArtist(artistId, true);

      expect(conditional).toEqual([null, '"rev-1"']);
    });

    it("forwards Last-Modified as If-Modified-Since when no ETag is present", async () => {
      const artistId = 5003;
      const lastModified = "Wed, 03 Jun 2026 10:00:00 GMT";
      const seen: { inm: string | null; ims: string | null }[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          seen.push({
            inm: request.headers.get("if-none-match"),
            ims: request.headers.get("if-modified-since"),
          });
          return HttpResponse.json(artistMetadata(artistId), {
            headers: { "Last-Modified": lastModified },
          });
        })
      );

      await fetchArtist(artistId);
      await fetchArtist(artistId, true);

      expect(seen[1]).toEqual({ inm: null, ims: lastModified });
    });

    it("prefers If-None-Match over If-Modified-Since when both are known", async () => {
      const artistId = 5004;
      const seen: { inm: string | null; ims: string | null }[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          seen.push({
            inm: request.headers.get("if-none-match"),
            ims: request.headers.get("if-modified-since"),
          });
          return HttpResponse.json(artistMetadata(artistId), {
            headers: {
              ETag: '"rev-1"',
              "Last-Modified": "Wed, 03 Jun 2026 10:00:00 GMT",
            },
          });
        })
      );

      await fetchArtist(artistId);
      await fetchArtist(artistId, true);

      expect(seen[1]).toEqual({ inm: '"rev-1"', ims: null });
    });

    it("preserves the cached body on a 304 without re-decoding", async () => {
      const artistId = 5005;
      let calls = 0;
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          calls += 1;
          if (request.headers.get("if-none-match") === '"rev-1"') {
            return new HttpResponse(null, {
              status: 304,
              headers: { ETag: '"rev-1"' },
            });
          }
          return HttpResponse.json(artistMetadata(artistId), {
            headers: { ETag: '"rev-1"' },
          });
        })
      );

      const first = await fetchArtist(artistId);
      const second = await fetchArtist(artistId, true);

      expect(calls).toBe(2);
      expect(second).toEqual(first);
      expect(second).toEqual(artistMetadata(artistId));
    });

    it("replaces the cache entry and adopts the new validator on a 200", async () => {
      const artistId = 5006;
      const conditional: (string | null)[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          const inm = request.headers.get("if-none-match");
          conditional.push(inm);
          const rev = inm ? "rev-2" : "rev-1";
          return HttpResponse.json(
            { ...artistMetadata(artistId), discogsArtistId: inm ? 99 : artistId },
            { headers: { ETag: `"${rev}"` } }
          );
        })
      );

      await fetchArtist(artistId);
      const replaced = await fetchArtist(artistId, true);
      await fetchArtist(artistId, true);

      expect(replaced.discogsArtistId).toBe(99);
      // Third fetch must carry the ETag from the 200 replacement, not the first.
      expect(conditional).toEqual([null, '"rev-1"', '"rev-2"']);
    });

    it("degrades to an unconditional fetch when the server emits no validators", async () => {
      const artistId = 5007;
      const conditional: (string | null)[] = [];
      server.use(
        http.get(ARTIST_ENDPOINT, ({ request }) => {
          conditional.push(request.headers.get("if-none-match"));
          return HttpResponse.json(artistMetadata(artistId));
        })
      );

      const first = await fetchArtist(artistId);
      const second = await fetchArtist(artistId, true);

      expect(conditional).toEqual([null, null]);
      expect(second).toEqual(first);
    });
  });
});
