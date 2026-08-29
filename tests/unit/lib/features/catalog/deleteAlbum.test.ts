import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";
import { interpretReleaseDeleteError } from "@/lib/features/catalog/releaseDeleteOutcome";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

describe("deleteAlbum", () => {
  it("sends DELETE to the release's own path and fulfils on the endpoint's empty 204", async () => {
    let method: string | undefined;
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/53375`, ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }),
    );

    expect(method).toBe("DELETE");
    expect("error" in result && result.error).toBeFalsy();
  });

  it("rejects a refusal rather than resolving it as a delete that happened", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () =>
        HttpResponse.json(
          {
            message: "Cannot delete: release has 12 flowsheet plays on record",
            reason: "flowsheet_references",
            play_count: 12,
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }),
    );

    expect("error" in result && result.error).toBeTruthy();
  });

  it("hands the refusal to the interpreter in the shape it expects", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () =>
        HttpResponse.json(
          {
            message: "Cannot delete: release has 12 flowsheet plays on record",
            reason: "flowsheet_references",
            play_count: 12,
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }),
    );
    const error = "error" in result ? result.error : undefined;

    // The wrapper and the interpreter are one contract; asserting them
    // together is what stops a rename on either side from passing twice.
    expect(interpretReleaseDeleteError(error)).toEqual({
      reason: "flowsheet_references",
      message: "Cannot delete: release has 12 flowsheet plays on record",
      retryable: false,
    });
  });

  it("keeps the refusal out of the global error toast", async () => {
    server.use(
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () =>
        HttpResponse.json({ message: "nope", reason: "flowsheet_references" }, { status: 409 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }),
    );
    const error = "error" in result ? result.error : undefined;

    // Nesting under `deleteAlbumError` is what hides `data.message` from the
    // shared rtk-query-error-logger; the delete screen states the refusal
    // itself, with the context to say which release it was about.
    expect(error).toHaveProperty("deleteAlbumError");
    expect(error).not.toHaveProperty("data");
  });

  it("drops the deleted row from a subscribed catalog search", async () => {
    let searchCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () => new HttpResponse(null, { status: 204 })),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Autechre",
        album_title: undefined,
        n: undefined,
      }),
    );
    await sub;
    expect(searchCalls).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }));

    await vi.waitFor(() => expect(searchCalls).toBe(2));
    sub.unsubscribe();
  });

  it("drops the deleted row from the artist's own release table when the caller names the artist", async () => {
    let releaseCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/artists/4211/releases`, () => {
        releaseCalls += 1;
        return HttpResponse.json({ releases: [], total: 0, page: 1, totalPages: 1 });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () => new HttpResponse(null, { status: 204 })),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.getArtistReleases.initiate({ artistId: 4211 }),
    );
    await sub;
    expect(releaseCalls).toBe(1);

    await store.dispatch(
      catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375, artistId: 4211 }),
    );

    await vi.waitFor(() => expect(releaseCalls).toBe(2));
    sub.unsubscribe();
  });

  it("does not re-read the release it just deleted", async () => {
    let infoCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/info`, () => {
        infoCalls += 1;
        return HttpResponse.json({ id: 53375, album_title: "Tri Repetae" });
      }),
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () => new HttpResponse(null, { status: 204 })),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.getInformation.initiate({ album_id: 53375 }),
    );
    await sub;
    expect(infoCalls).toBe(1);

    await store.dispatch(catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }));
    // A real delay, not a microtask: an invalidation-driven refetch is
    // dispatched asynchronously, so asserting on the next tick would pass
    // whether or not one was queued.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Invalidating AlbumDetail here would refetch a row that no longer
    // exists. The 404 is certain, and the shared error middleware turns it
    // into a red toast over the confirmation screen and a Sentry event — on
    // every successful delete.
    expect(infoCalls).toBe(1);
    sub.unsubscribe();
  });

  it("leaves cached lists alone when the delete was refused", async () => {
    let searchCalls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => {
        searchCalls += 1;
        return HttpResponse.json([]);
      }),
      http.delete(`${TEST_BACKEND_URL}/library/53375`, () =>
        HttpResponse.json({ message: "nope", reason: "flowsheet_references" }, { status: 409 }),
      ),
    );

    const store = createTestStore();
    const sub = store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Autechre",
        album_title: undefined,
        n: undefined,
      }),
    );
    await sub;

    await store.dispatch(catalogApi.endpoints.deleteAlbum.initiate({ albumId: 53375 }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // A refused delete changed nothing on the server, so re-fetching every
    // catalog list on screen would be pure cost — and worse, would look like
    // the row disappearing and coming back.
    expect(searchCalls).toBe(1);
    sub.unsubscribe();
  });
});
