import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { interpretArtistDeleteError } from "@/lib/features/catalog/artistDeleteOutcome";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const ARTIST_ID = 19516;

describe("deleteArtist", () => {
  it("sends DELETE to the artist's own path and fulfils on the endpoint's empty 204", async () => {
    let method: string | undefined;
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }),
    );

    expect(method).toBe("DELETE");
    expect("error" in result && result.error).toBeFalsy();
  });

  it("rejects a refusal rather than resolving it as a delete that happened", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json(
          {
            message: "Cannot delete: artist has 2 releases on file. Delete or move those releases first.",
            reason: "artist_has_releases",
            count: 2,
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }),
    );

    expect("error" in result && result.error).toBeTruthy();
  });

  it("hands the refusal to the interpreter in the shape it expects, rewriting rather than passing through the server's sentence", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json(
          {
            message: "Cannot delete: artist has 2 releases on file. Delete or move those releases first.",
            reason: "artist_has_releases",
            count: 2,
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }),
    );
    const error = "error" in result ? result.error : undefined;

    // The wrapper and the interpreter are one contract; asserting them
    // together is what stops a rename on either side from passing twice.
    // Interpreting it off a live dispatch is the part a unit test of the
    // interpreter alone cannot do: `transformErrorResponse` sits between the
    // body and the reason, and a rename on either side of it would leave both
    // halves individually green.
    const outcome = interpretArtistDeleteError(error);
    expect(outcome.reason).toBe("artist_has_releases");
    expect(outcome.retryable).toBe(false);
    expect(outcome.message).toContain("2 releases");
    // The server's fixture message above already contains "2 releases" and
    // starts "Cannot delete:" -- so those two facts alone don't prove the
    // client built its own sentence rather than forwarding the server's.
    // These do: "Nothing was changed" is not in any body this endpoint sends,
    // and "Cannot delete:" (the server's own opener) must not survive into a
    // sentence this module owns.
    expect(outcome.message).toContain("Nothing was changed");
    expect(outcome.message).not.toContain("Cannot delete:");
  });

  it("keeps the refusal out of the global error toast", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json({ message: "nope", reason: "artist_has_releases", count: 1 }, { status: 409 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }),
    );
    const error = "error" in result ? result.error : undefined;

    // Nesting under `deleteArtistError` is what hides `data.message` from the
    // shared rtk-query-error-logger; whatever screen calls this states the
    // refusal itself, in wording chosen for that one place.
    expect(error).toHaveProperty("deleteArtistError");
    expect(error).not.toHaveProperty("data");
  });

  /**
   * Counts every read a delete can make stale (or, for `getArtistCard` /
   * `getArtistReleases`, make WRONGLY stale — see below). Named per read so
   * the assertions can say which lists the write does and does not
   * invalidate, not just that it invalidates something.
   */
  function countingReads() {
    const calls = { card: 0, search: 0, artistReleases: 0, archive: 0 };
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => {
        calls.card += 1;
        return HttpResponse.json({
          artist_id: ARTIST_ID,
          artist_name: "Autechre",
          alphabetical_name: "Autechre",
          genre_id: 15,
          code_letters: "AU",
          code_artist_number: 3,
          release_count: 0,
          cross_reference_source_count: 0,
          cross_reference_target_count: 0,
          library_cross_reference_count: 0,
          compilation_credit_count: 0,
        });
      }),
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        calls.search += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}/releases`, () => {
        calls.artistReleases += 1;
        return HttpResponse.json({ artist_id: ARTIST_ID, releases: [], total: 0, page: 1, totalPages: 1 });
      }),
      http.get(`${TEST_BACKEND_URL}/library/deleted`, () => {
        calls.archive += 1;
        return HttpResponse.json({ results: [], total: 0, page: 1, totalPages: 1 });
      }),
    );
    return calls;
  }

  async function subscribeAll(store: ReturnType<typeof createTestStore>) {
    const subs = [
      store.dispatch(catalogApi.endpoints.getArtistCard.initiate({ artistId: ARTIST_ID })),
      store.dispatch(
        catalogApi.endpoints.searchCatalog.initiate({
          artist_name: "Autechre",
          album_title: undefined,
          n: undefined,
        }),
      ),
      store.dispatch(catalogApi.endpoints.getArtistReleases.initiate({ artistId: ARTIST_ID })),
      store.dispatch(catalogApi.endpoints.listDeletedArchive.initiate({})),
    ];
    await Promise.all(subs);
    return () => subs.forEach((sub) => sub.unsubscribe());
  }

  it("does not refetch the artist's own card or release table on a successful delete — both would 404", async () => {
    const calls = countingReads();
    server.use(http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => new HttpResponse(null, { status: 204 })));

    const store = createTestStore();
    const unsubscribe = await subscribeAll(store);
    expect(calls).toEqual({ card: 1, search: 1, artistReleases: 1, archive: 1 });

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));
    // The archive listing is the one read this write is supposed to make
    // stale, so wait on it rather than a fixed delay -- it doubling is proof
    // the invalidation round-trip already ran, at which point the other
    // three counts are settled too.
    await vi.waitFor(() => expect(calls.archive).toBe(2));

    // `getArtistCard` and `getArtistReleases` (which shares its tag with
    // `getNextReleaseNumber`) both resolve existence through the row this
    // delete just removed. Invalidating them would refetch a request whose
    // 404 is guaranteed, which the shared error middleware turns into a red
    // toast over the confirmation screen and a Sentry event on every
    // successful delete -- see `deleteAlbum`'s identical reasoning for
    // `AlbumDetail`.
    expect(calls.card).toBe(1);
    expect(calls.artistReleases).toBe(1);
    unsubscribe();
  });

  it("does not refetch catalog search on a successful delete — the delete's own precondition guarantees no row names this artist", async () => {
    const calls = countingReads();
    server.use(http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => new HttpResponse(null, { status: 204 })));

    const store = createTestStore();
    const unsubscribe = await subscribeAll(store);
    expect(calls.search).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));
    await vi.waitFor(() => expect(calls.archive).toBe(2));

    // Not a conservative omission: `release_count` and
    // `library_cross_reference_count` are both zero by the time this 204
    // arrives (the delete refuses otherwise), so no `CatalogList` row could
    // ever have named this artist to begin with.
    expect(calls.search).toBe(1);
    unsubscribe();
  });

  it("refreshes the artist typeahead after a successful delete", async () => {
    let typeaheadCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        typeaheadCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => new HttpResponse(null, { status: 204 })),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.searchLibraryArtists.initiate({ q: "Autechre" }),
    );
    await sub;
    expect(typeaheadCalls).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));

    // `/library/artists/search` carries no release requirement, so a
    // zero-release artist -- the only kind this delete can remove -- was
    // still answering into the typeahead a moment ago. A stale entry hands a
    // filing or move write an `artist_id` that no longer exists.
    await vi.waitFor(() => expect(typeaheadCalls).toBe(2));
    sub.unsubscribe();
  });

  it("frees the artist's shelf code for reuse by invalidating both code-scoped caches", async () => {
    let peekCalls = 0;
    let byCodeCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/peek-code`, () => {
        peekCalls += 1;
        return HttpResponse.json({ next_code_number: peekCalls === 1 ? 4 : 3 });
      }),
      http.get(`${TEST_BACKEND_URL}/library/artists/by-code`, () => {
        byCodeCalls += 1;
        return HttpResponse.json({ artists: [{ id: ARTIST_ID, artist_name: "Autechre", code_letters: "AU", code_number: 3, genre_id: 15 }] });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => new HttpResponse(null, { status: 204 })),
    );

    const store = createTestStore();
    const peekSub = store.dispatch(
      catalogApi.endpoints.peekArtistCode.initiate({ code_letters: "AU", genre_id: 15 }),
    );
    const byCodeSub = store.dispatch(
      catalogApi.endpoints.resolveArtistByCode.initiate({ code_letters: "AU", genre_id: 15, code_number: 3 }),
    );
    await Promise.all([peekSub, byCodeSub]);
    expect(peekCalls).toBe(1);
    expect(byCodeCalls).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));

    // Both are bare tags (no `(genre_id, code_letters)` in this mutation's
    // args to scope a narrower one to), the same shape `fileRelease`
    // establishes for the identical pair.
    await vi.waitFor(() => expect(peekCalls).toBe(2));
    await vi.waitFor(() => expect(byCodeCalls).toBe(2));
    peekSub.unsubscribe();
    byCodeSub.unsubscribe();
  });

  it("still refreshes the typeahead when no answer came back", async () => {
    let typeaheadCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        typeaheadCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () => HttpResponse.error()),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.searchLibraryArtists.initiate({ q: "Autechre" }),
    );
    await sub;
    expect(typeaheadCalls).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));

    // The delete may well have committed on a response that never arrived.
    // Treating a lost answer like a refusal leaves the typeahead still
    // offering an artist_id that is actually gone.
    await vi.waitFor(() => expect(typeaheadCalls).toBe(2));
    sub.unsubscribe();
  });

  it("leaves the typeahead alone when the delete was refused", async () => {
    let typeaheadCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/search`, () => {
        typeaheadCalls += 1;
        return HttpResponse.json({ artists: [] });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/artists/${ARTIST_ID}`, () =>
        HttpResponse.json({ message: "nope", reason: "artist_has_releases", count: 1 }, { status: 409 }),
      ),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.searchLibraryArtists.initiate({ q: "Autechre" }),
    );
    await sub;

    await store.dispatch(catalogApi.endpoints.deleteArtist.initiate({ artistId: ARTIST_ID }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // A refused delete changed nothing on the server, so re-fetching would be
    // pure cost -- and worse, would look like the artist disappearing from
    // the typeahead and coming back.
    expect(typeaheadCalls).toBe(1);
    sub.unsubscribe();
  });
});
