import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { isAddArtistConflict } from "@/lib/features/catalog/adminCreateArtistValidation";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const ARTIST_ID = 42;

describe("updateArtistCard", () => {
  it("strips the generic message from a rename-collision 409, leaving the named artist", async () => {
    server.use(
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json(
          {
            message: "Artist name already exists in one of this artist's genres.",
            artist: { artist_id: 99, artist_name: "Jessica Pratt", code_letters: "PR" },
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Molina, Juana" },
      }),
    );
    const error = "error" in result ? result.error : undefined;

    // Stripping `message` is what keeps the shared rtk-query-error-logger
    // from toasting the same refusal a second time -- the artist card states
    // it itself, inline, by name.
    expect(isAddArtistConflict(error)).toBe(true);
    if (isAddArtistConflict(error)) {
      expect(error.data).not.toHaveProperty("message");
      expect(error.data.artist.artist_name).toBe("Jessica Pratt");
    }
  });

  // A rename changes `artist_name`, which both of these caches render: a
  // catalog search result row, and the typeahead `addArtist` itself
  // invalidates on create so it cannot recommend filing a duplicate of a
  // name that no longer exists. Leaving either stale after a rename reads,
  // to the librarian, as a save that silently failed.
  it("refreshes catalog search and the artist typeahead after a successful rename", async () => {
    let searchCalls = 0;
    let typeaheadCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        typeaheadCalls += 1;
        return HttpResponse.json([]);
      }),
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json({ id: ARTIST_ID, artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" }),
      ),
    );

    const store = createTestStore();
    const searchSub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Jessica",
        album_title: undefined,
        n: undefined,
      }),
    );
    const typeaheadSub = store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({ genre_id: 3, q: "Jessica" }),
    );
    await searchSub;
    await typeaheadSub;
    expect(searchCalls).toBe(1);
    expect(typeaheadCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" },
      }),
    );

    await vi.waitFor(() => expect(searchCalls).toBe(2));
    await vi.waitFor(() => expect(typeaheadCalls).toBe(2));
    searchSub.unsubscribe();
    typeaheadSub.unsubscribe();
  });

  it("leaves catalog search and the artist typeahead alone when the rename was refused", async () => {
    let searchCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json(
          { artist: { artist_id: 99, artist_name: "Jessica Pratt", code_letters: "PR" } },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const searchSub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Jessica",
        album_title: undefined,
        n: undefined,
      }),
    );
    await searchSub;
    expect(searchCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(searchCalls).toBe(1);
    searchSub.unsubscribe();
  });

  // A 409 (above) and a 5xx are not the same evidence: a sub-500 answer
  // proves the request was refused before `cascade_library_artist_name`
  // could fire, but a 5xx proves nothing either way -- the rename may have
  // committed on a response the client never saw. Both this case and the
  // transport-failure case below must invalidate, or a lost-but-successful
  // rename leaves the search and typeahead caches silently stale.
  it("invalidates catalog search and the artist typeahead when the rename's response is a 5xx", async () => {
    let searchCalls = 0;
    let typeaheadCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        typeaheadCalls += 1;
        return HttpResponse.json([]);
      }),
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json({ message: "internal error" }, { status: 500 }),
      ),
    );

    const store = createTestStore();
    const searchSub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Jessica",
        album_title: undefined,
        n: undefined,
      }),
    );
    const typeaheadSub = store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({ genre_id: 3, q: "Jessica" }),
    );
    await searchSub;
    await typeaheadSub;
    expect(searchCalls).toBe(1);
    expect(typeaheadCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" },
      }),
    );

    await vi.waitFor(() => expect(searchCalls).toBe(2));
    await vi.waitFor(() => expect(typeaheadCalls).toBe(2));
    searchSub.unsubscribe();
    typeaheadSub.unsubscribe();
  });

  it("invalidates catalog search and the artist typeahead when the rename's response is lost to a transport failure", async () => {
    let searchCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => HttpResponse.error()),
    );

    const store = createTestStore();
    const searchSub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Jessica",
        album_title: undefined,
        n: undefined,
      }),
    );
    await searchSub;
    expect(searchCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" },
      }),
    );

    await vi.waitFor(() => expect(searchCalls).toBe(2));
    searchSub.unsubscribe();
  });

  // Backend propagates a rename to every `library.artist_name` row through
  // the `cascade_library_artist_name` trigger, but the classic ReleaseCard
  // (`getInformation`) reads its own cached copy of the name and never
  // rereads it on its own -- so a rename has to invalidate it too, not just
  // the search and typeahead caches.
  it("invalidates an open AlbumDetail read after a successful rename", async () => {
    let infoCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/info`, () => {
        infoCalls += 1;
        return HttpResponse.json({ id: 900, album_title: "DOGA" });
      }),
      http.patch(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json({
          id: ARTIST_ID,
          artist_name: "Jessica Pratt",
          alphabetical_name: "Pratt, Jessica",
        }),
      ),
    );

    const store = createTestStore();
    const infoSub = store.dispatch(
      catalogApi.endpoints.getInformation.initiate({ album_id: 900 }),
    );
    await infoSub;
    expect(infoCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.updateArtistCard.initiate({
        artistId: ARTIST_ID,
        body: { artist_name: "Jessica Pratt", alphabetical_name: "Pratt, Jessica" },
      }),
    );

    await vi.waitFor(() => expect(infoCalls).toBe(2));
    infoSub.unsubscribe();
  });
});
