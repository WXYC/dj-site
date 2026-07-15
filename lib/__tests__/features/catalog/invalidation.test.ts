import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/lib/test-utils";
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
});
