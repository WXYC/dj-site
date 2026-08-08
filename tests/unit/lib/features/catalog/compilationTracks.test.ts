import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const LIBRARY_ID = 8801;

describe("compilation-track (CTA) endpoints", () => {
  describe("getCompilationTrackSuggestions", () => {
    it("returns the proposed tracklist and the resolved Discogs release", async () => {
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
          () =>
            HttpResponse.json({
              library_id: LIBRARY_ID,
              discogs_release_id: 55501,
              tracks: [
                {
                  artist_name: "Jessica Pratt",
                  track_title: "Back, Baby",
                  track_position: "A1",
                },
                {
                  artist_name: "Chuquimamani-Condori",
                  track_title: "Call Your Name",
                  track_position: "A2",
                },
              ],
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.getCompilationTrackSuggestions.initiate({
          libraryId: LIBRARY_ID,
        }),
      );

      expect(result.data?.discogs_release_id).toBe(55501);
      expect(result.data?.tracks).toHaveLength(2);
      expect(result.data?.tracks[0].artist_name).toBe("Jessica Pratt");
    });

    it("distinguishes a resolved-but-empty upstream from an unreadable one", async () => {
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
          () =>
            HttpResponse.json({
              library_id: LIBRARY_ID,
              discogs_release_id: null,
              tracks: [],
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.getCompilationTrackSuggestions.initiate({
          libraryId: LIBRARY_ID,
        }),
      );

      expect(result.isError).toBe(false);
      expect(result.data?.discogs_release_id).toBeNull();
      expect(result.data?.tracks).toEqual([]);
    });

    // The shared base query soft-fails an unparseable body into a *successful*
    // null payload. Left at that default, a gateway's HTML 502 would reach the
    // panel as "Discogs resolved nothing" and silently demand that the MD hand
    // -type a tracklist the backend could have supplied. This endpoint opts out
    // so the two stay distinguishable.
    it("surfaces an unparseable response as an error, not as an empty tracklist", async () => {
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks/discogs-suggestions`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.getCompilationTrackSuggestions.initiate({
          libraryId: LIBRARY_ID,
        }),
      );

      expect(result.isError).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe("getCompilationTracks", () => {
    it("returns the stored rows for a release", async () => {
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          () =>
            HttpResponse.json({
              library_id: LIBRARY_ID,
              tracks: [
                {
                  id: 91,
                  artist_name: "Nilüfer Yanya",
                  track_title: "Stabilise",
                  track_position: "B2",
                },
              ],
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.getCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
        }),
      );

      expect(result.data?.tracks[0].id).toBe(91);
      expect(result.data?.tracks[0].artist_name).toBe("Nilüfer Yanya");
    });

    // Same reasoning as the suggestions read: "this release has no per-track
    // data" is a claim the duplicate-avoidance and correction paths act on, and
    // an unreachable backend cannot honestly make it.
    it("surfaces an unparseable response as an error, not as zero stored rows", async () => {
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>404</body></html>", {
              status: 404,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.getCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
        }),
      );

      expect(result.isError).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe("writeCompilationTracks", () => {
    it("posts the confirmed tracklist and returns the write counts", async () => {
      let posted: unknown;
      server.use(
        http.post(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          async ({ request }) => {
            posted = await request.json();
            return HttpResponse.json({
              library_id: LIBRARY_ID,
              inserted: 1,
              skipped: 0,
              tracks: [
                {
                  id: 92,
                  artist_name: "Juana Molina",
                  track_title: "la paradoja",
                  track_position: "A1",
                },
              ],
            });
          },
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.writeCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
          tracks: [
            {
              artist_name: "Juana Molina",
              track_title: "la paradoja",
              track_position: "A1",
            },
          ],
        }),
      );

      expect(posted).toEqual({
        tracks: [
          {
            artist_name: "Juana Molina",
            track_title: "la paradoja",
            track_position: "A1",
          },
        ],
      });
      expect(result.data?.inserted).toBe(1);
    });

    it("invalidates the release's stored tracks so a subsequent read refetches", async () => {
      let readCalls = 0;
      server.use(
        http.get(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          () => {
            readCalls += 1;
            return HttpResponse.json({ library_id: LIBRARY_ID, tracks: [] });
          },
        ),
        http.post(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          () =>
            HttpResponse.json({
              library_id: LIBRARY_ID,
              inserted: 1,
              skipped: 0,
              tracks: [],
            }),
        ),
      );

      const store = createTestStore();
      const sub = store.dispatch(
        catalogApi.endpoints.getCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
        }),
      );
      await sub;
      expect(readCalls).toBe(1);

      await store.dispatch(
        catalogApi.endpoints.writeCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
          tracks: [{ artist_name: "Stereolab" }],
        }),
      );

      await vi.waitFor(() => expect(readCalls).toBe(2));
      sub.unsubscribe();
    });

    // A mutation is never soft-failed by the shared base query, so an
    // unparseable body must reject rather than resolve with a null payload the
    // panel would read as a successful write of zero rows.
    it("rejects on an unparseable response rather than reporting a silent success", async () => {
      server.use(
        http.post(
          `${TEST_BACKEND_URL}/library/${LIBRARY_ID}/compilation-tracks`,
          () =>
            new HttpResponse("<!DOCTYPE html><html><body>502</body></html>", {
              status: 502,
              headers: { "Content-Type": "text/html" },
            }),
        ),
      );

      const store = createTestStore();
      const result = await store.dispatch(
        catalogApi.endpoints.writeCompilationTracks.initiate({
          libraryId: LIBRARY_ID,
          tracks: [{ artist_name: "Cat Power" }],
        }),
      );

      expect("error" in result).toBe(true);
    });
  });
});
