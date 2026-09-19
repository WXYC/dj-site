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
});
