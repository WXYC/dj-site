import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";

// Mock the authentication client so the base query's token fetch resolves.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// dj-site#624: addAlbum / addArtist had no invalidatesTags nor cache patching,
// so a newly created row didn't appear in cached search results until a manual
// refresh. These tests pin that the add mutations now invalidate the list tags
// and force the subscribed list queries to refetch.

describe("catalog add-mutation cache invalidation (#624)", () => {
  it("addAlbum invalidates CatalogList so the catalog search refetches", async () => {
    let searchCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/`, () =>
        HttpResponse.json({ id: 4242 }),
      ),
    );

    const store = createTestStore();
    // Keep the subscription alive so invalidation triggers a refetch.
    const sub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Juana Molina",
        album_title: undefined,
        n: undefined,
      }),
    );
    await sub;
    expect(searchCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.addAlbum.initiate({
        album_title: "DOGA",
        label: "Sonamos",
        genre_id: 1,
        format_id: 1,
        artist_name: "Juana Molina",
      }),
    );

    await vi.waitFor(() => expect(searchCalls).toBe(2));
    sub.unsubscribe();
  });

  it("addArtist invalidates both ArtistSearch and CatalogList", async () => {
    let artistSearchCalls = 0;
    let catalogCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        artistSearchCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        catalogCalls += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/artists`, () =>
        HttpResponse.json({ id: 7001 }),
      ),
    );

    const store = createTestStore();
    const artistSub = store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: 1,
        q: "Stereolab",
      }),
    );
    const catalogSub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Stereolab",
        album_title: undefined,
        n: undefined,
      }),
    );
    await Promise.all([artistSub, catalogSub]);
    expect(artistSearchCalls).toBe(1);
    expect(catalogCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.addArtist.initiate({
        artist_name: "Stereolab",
        code_letters: "ST",
        genre_id: 1,
        code_number: 1,
      }),
    );

    await vi.waitFor(() => {
      expect(artistSearchCalls).toBe(2);
      expect(catalogCalls).toBe(2);
    });
    artistSub.unsubscribe();
    catalogSub.unsubscribe();
  });

  it("addArtist invalidates the peek-code preview for the same code_letters/genre_id pair", async () => {
    let peekCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => {
        peekCalls += 1;
        // A distinct number per call proves a real refetch happened rather
        // than a cache hit redisplaying the first response.
        return HttpResponse.json({ next_code_number: peekCalls === 1 ? 7 : 8 });
      }),
      http.post(`${TEST_BACKEND_URL}/library/artists`, () =>
        HttpResponse.json({ id: 7002 }),
      ),
    );

    const store = createTestStore();
    const peekArg = { code_letters: "MO", genre_id: 1 };

    const firstPeekSub = store.dispatch(
      catalogApi.endpoints.peekArtistCode.initiate(peekArg),
    );
    const firstPeek = await firstPeekSub;
    expect(peekCalls).toBe(1);
    expect(firstPeek.data?.next_code_number).toBe(7);
    // Leave the pair (e.g. the MD types a different letters/genre combo, or
    // navigates away) the way the real control's debounced trigger would.
    firstPeekSub.unsubscribe();

    await store.dispatch(
      catalogApi.endpoints.addArtist.initiate({
        artist_name: "Molina",
        code_letters: "MO",
        genre_id: 1,
        code_number: 7,
      }),
    );

    // Returning to the same pair must issue a fresh request rather than
    // redisplaying the now-stale cached code number.
    const secondPeekSub = store.dispatch(
      catalogApi.endpoints.peekArtistCode.initiate(peekArg),
    );
    const secondPeek = await secondPeekSub;
    expect(peekCalls).toBe(2);
    expect(secondPeek.data?.next_code_number).toBe(8);
    secondPeekSub.unsubscribe();
  });

  it("addAlbum refetches the artist's next release number, since a filed release makes it stale", async () => {
    let peekCalls = 0;
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/library/artists/501/next-release-number`,
        () => {
          peekCalls += 1;
          // A distinct number per call proves a real refetch rather than a
          // cache redisplay of the first response.
          return HttpResponse.json({ next_code_number: peekCalls === 1 ? 6 : 7 });
        },
      ),
      http.post(`${TEST_BACKEND_URL}/library/`, () =>
        HttpResponse.json({ id: 4242, code_number: 6 }),
      ),
    );

    const store = createTestStore();
    // Keep the subscription alive so the invalidation triggers a refetch.
    const sub = store.dispatch(
      catalogApi.endpoints.getNextReleaseNumber.initiate(501),
    );
    const first = await sub;
    expect(peekCalls).toBe(1);
    expect(first.data?.next_code_number).toBe(6);

    await store.dispatch(
      catalogApi.endpoints.addAlbum.initiate({
        album_title: "DOGA",
        label: "Sonamos",
        genre_id: 1,
        format_id: 1,
        artist_id: 501,
      }),
    );

    await vi.waitFor(() => expect(peekCalls).toBe(2));
    sub.unsubscribe();
  });
});

describe("updateAlbum cache invalidation on re-attribution", () => {
  const patched = {
    id: 53375,
    album_title: "Tri Repetae",
    artist_name: "Gescom",
    code_letters: "GE",
    code_artist_number: 7,
    code_number: 1,
    format_name: "CD",
    genre_name: "Electronic",
    label: "Warp",
  };

  it("refetches every artist release table when a release changes artist", async () => {
    let releaseCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/4211/releases`, () => {
        releaseCalls += 1;
        return HttpResponse.json({ releases: [], total: 0, page: 1, totalPages: 1 });
      }),
      http.patch(`${TEST_BACKEND_URL}/library/53375`, () => HttpResponse.json(patched)),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.getArtistReleases.initiate({ artistId: 4211 }),
    );
    await sub;
    expect(releaseCalls).toBe(1);

    // The artist the release LEFT is not in the mutation's args — only the
    // destination is — so its table has to be reached through the shared
    // LIST tag or it keeps listing a release that is no longer filed there.
    await store.dispatch(
      catalogApi.endpoints.updateAlbum.initiate({
        albumId: 53375,
        body: { artist_id: 8802, genre_id: 5 },
      }),
    );

    await vi.waitFor(() => expect(releaseCalls).toBe(2));
    sub.unsubscribe();
  });

  it("refetches the next release number on a LIST-scoped invalidation, not only an id-scoped one", async () => {
    let peekCalls = 0;
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/library/artists/501/next-release-number`,
        () => {
          peekCalls += 1;
          // A distinct number per call proves a real refetch rather than a
          // cache redisplay of the first response.
          return HttpResponse.json({ next_code_number: peekCalls === 1 ? 6 : 7 });
        },
      ),
      http.patch(`${TEST_BACKEND_URL}/library/53375`, () => HttpResponse.json(patched)),
    );

    const store = createTestStore();
    // Keep the subscription alive so the invalidation triggers a refetch.
    const sub = store.dispatch(
      catalogApi.endpoints.getNextReleaseNumber.initiate(501),
    );
    const first = await sub;
    expect(peekCalls).toBe(1);
    expect(first.data?.next_code_number).toBe(6);

    // A re-attributing updateAlbum — like the modern bench's fileRelease —
    // cannot name the shelf ahead of the write, so it invalidates the shared
    // LIST tag, never id-501's. The prepopulated next number reads that same
    // shelf, so it must refetch on LIST too, or the classic add card reoffers a
    // number the write just consumed.
    await store.dispatch(
      catalogApi.endpoints.updateAlbum.initiate({
        albumId: 53375,
        body: { artist_id: 8802, genre_id: 5 },
      }),
    );

    await vi.waitFor(() => expect(peekCalls).toBe(2));
    sub.unsubscribe();
  });

  it("leaves the release tables alone for an ordinary field edit", async () => {
    let releaseCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/4211/releases`, () => {
        releaseCalls += 1;
        return HttpResponse.json({ releases: [], total: 0, page: 1, totalPages: 1 });
      }),
      http.patch(`${TEST_BACKEND_URL}/library/53375`, () => HttpResponse.json(patched)),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.getArtistReleases.initiate({ artistId: 4211 }),
    );
    await sub;

    // A title fix does not move the release, and the cached row is patched in
    // place — refetching every artist table for it would be pure cost.
    await store.dispatch(
      catalogApi.endpoints.updateAlbum.initiate({
        albumId: 53375,
        body: { album_title: "Tri Repetae++" },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(releaseCalls).toBe(1);
    sub.unsubscribe();
  });
});

// A by-code answer held by a live subscription — the filing bench's, while its
// compilation checkbox is on — outlives every write that changes what is filed
// at that code. A held `code_not_assigned` is the load-bearing one: read again
// after the bucket exists, it routes the librarian into minting a second one.
describe("by-code cache invalidation for the code-triple readers", () => {
  const byCodeArg = { genre_id: 11, code_letters: "V/A", code_number: 0 };

  function bucketResponses() {
    let calls = 0;
    return {
      calls: () => calls,
      handler: http.get(`${TEST_BACKEND_URL}/library/artists/by-code`, () => {
        calls += 1;
        // Distinct answers per call, so a real refetch is distinguishable from
        // a cache redisplay: unassigned first, owned after the write.
        return calls === 1
          ? HttpResponse.json({ reason: "code_not_assigned" }, { status: 404 })
          : HttpResponse.json({
              artists: [
                {
                  id: 9100,
                  artist_name: "Various Artists",
                  code_letters: "V/A",
                  code_number: 0,
                  genre_id: 11,
                },
              ],
            });
      }),
    };
  }

  it("fileRelease invalidates the held by-code answer for the shelf it just filed into", async () => {
    const byCode = bucketResponses();
    server.use(
      byCode.handler,
      http.post(`${TEST_BACKEND_URL}/library/filings`, () =>
        HttpResponse.json({
          artist: { id: 9100 },
          release: { id: 4242 },
        }),
      ),
    );

    const store = createTestStore();
    // Held open the way the bench's checkbox holds it: the arg never changes
    // across a same-genre batch, so nothing else would re-resolve it.
    const sub = store.dispatch(
      catalogApi.endpoints.resolveArtistByCode.initiate(byCodeArg),
    );
    await sub;
    expect(byCode.calls()).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.fileRelease.initiate({
        artist: {
          kind: "create",
          artist_name: "Various Artists",
          code_letters: "V/A",
          code_number: 0,
          genre_id: 11,
        },
        release: { album_title: "Habibi Funk 007", genre_id: 11, format_id: 1 },
      }),
    );

    await vi.waitFor(() => expect(byCode.calls()).toBe(2));
    sub.unsubscribe();
  });

  it("addArtist invalidates the by-code answer for the same code_letters/genre_id pair", async () => {
    const byCode = bucketResponses();
    server.use(
      byCode.handler,
      http.post(`${TEST_BACKEND_URL}/library/artists`, () =>
        HttpResponse.json({ id: 9100 }),
      ),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.resolveArtistByCode.initiate(byCodeArg),
    );
    await sub;
    expect(byCode.calls()).toBe(1);

    // The classic artist-add path mints a bucket the bench's held answer
    // cannot see on its own.
    await store.dispatch(
      catalogApi.endpoints.addArtist.initiate({
        artist_name: "Various Artists",
        code_letters: "V/A",
        genre_id: 11,
        code_number: 0,
      }),
    );

    await vi.waitFor(() => expect(byCode.calls()).toBe(2));
    sub.unsubscribe();
  });
});

// Both compilation-credit editors refuse a further save while this read is
// back in flight, because the write is additive-only and the still-cached
// payload predates it. That refusal only protects anything if the write really
// does invalidate the read, so the chain is pinned here rather than left
// implied by the editors' gate.
describe("compilation-track write cache invalidation", () => {
  it("writeCompilationTracks invalidates the stored credits for that release", async () => {
    let readCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/53390/compilation-tracks`, () => {
        readCalls += 1;
        return HttpResponse.json({ library_id: 53390, inserted: 0, skipped: 0, tracks: [] });
      }),
      http.post(`${TEST_BACKEND_URL}/library/53390/compilation-tracks`, () =>
        HttpResponse.json({ library_id: 53390, inserted: 1, skipped: 0, tracks: [] }),
      ),
    );

    const store = createTestStore();
    // Keep the subscription alive so invalidation triggers a refetch.
    const sub = store.dispatch(
      catalogApi.endpoints.getCompilationTracks.initiate({ libraryId: 53390 }),
    );
    await sub;
    expect(readCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.writeCompilationTracks.initiate({
        libraryId: 53390,
        tracks: [{ artist_name: "Juana Molina", track_title: "la paradoja", track_position: "1" }],
      }),
    );

    await vi.waitFor(() => expect(readCalls).toBe(2));
    sub.unsubscribe();
  });
});
