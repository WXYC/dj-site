import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const ROCK_GENRE_ID = 7;
const ARTIST_SEARCH_URL = `${TEST_BACKEND_URL}/library/artists/search`;

describe("searchArtistsInGenre", () => {
  it("returns matching artists for the genre and query", async () => {
    server.use(
      http.get(ARTIST_SEARCH_URL, () =>
        HttpResponse.json({
          artists: [
            {
              id: 12,
              artist_name: "Juana Molina",
              code_letters: "MO",
              code_number: 3,
            },
          ],
        }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: ROCK_GENRE_ID,
        q: "Juana",
        limit: 10,
      }),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.artists).toEqual([
      {
        id: 12,
        artist_name: "Juana Molina",
        code_letters: "MO",
        code_number: 3,
      },
    ]);
  });

  it("resolves a genuinely empty result set as a successful, empty list", async () => {
    server.use(
      http.get(ARTIST_SEARCH_URL, () => HttpResponse.json({ artists: [] })),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: ROCK_GENRE_ID,
        q: "Nonexistent Band",
        limit: 10,
      }),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.artists).toEqual([]);
  });

  // A JSON `null` body still parses, so it reaches transformResponse rather
  // than the non-JSON opt-out below. The typeahead indexes and maps the
  // result, so the declared response shape only holds if a list is
  // substituted.
  it("substitutes an empty list for a JSON null body", async () => {
    server.use(http.get(ARTIST_SEARCH_URL, () => HttpResponse.json(null)));

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: ROCK_GENRE_ID,
        q: "Nonexistent Band",
        limit: 10,
      }),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.artists).toEqual([]);
  });

  // The shared base query soft-fails an unparseable body into a *successful*
  // `null` payload, which this endpoint's transformResponse turns into
  // `{ artists: [] }` — indistinguishable from "no such artist is
  // catalogued". That is the one answer this search must never give: it
  // backs the duplicate-artist guard on the artist typeahead, and a false
  // "no match" during an outage licenses the very duplicate the guard exists
  // to prevent. The endpoint opts out, so an unreadable backend has to
  // arrive as an error instead of an empty result.
  it.each([
    ["a gateway HTML error page", 502],
    ["the framework's HTML 404", 404],
  ])("surfaces %s as an error rather than an empty artist list", async (_name, status) => {
    server.use(
      http.get(
        ARTIST_SEARCH_URL,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: ROCK_GENRE_ID,
        q: "Juana",
        limit: 10,
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it("provides the artist-search list tag so an artist write can invalidate it", async () => {
    server.use(
      http.get(ARTIST_SEARCH_URL, () =>
        HttpResponse.json({
          artists: [
            {
              id: 12,
              artist_name: "Juana Molina",
              code_letters: "MO",
              code_number: 3,
            },
          ],
        }),
      ),
    );

    const store = createTestStore();
    await store.dispatch(
      catalogApi.endpoints.searchArtistsInGenre.initiate({
        genre_id: ROCK_GENRE_ID,
        q: "Juana",
        limit: 10,
      }),
    );

    expect(
      catalogApi.util.selectInvalidatedBy(store.getState(), [
        { type: "ArtistSearch", id: "LIST" },
      ]),
    ).toEqual([expect.objectContaining({ endpointName: "searchArtistsInGenre" })]);
  });
});
