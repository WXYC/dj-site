import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/tests/helpers";
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
