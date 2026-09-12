import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { createTestArtistCrossReference, createTestReleaseCrossReference } from "@/tests/fixtures/fixtures";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { createTestStore, server } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";
import { CROSSREFERENCE_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const ARTIST_XREF_URL = `${TEST_BACKEND_URL}/library/crossreferences/artists`;
const RELEASE_XREF_URL = `${TEST_BACKEND_URL}/library/crossreferences/releases`;

describe("listArtistCrossReferences", () => {
  it("returns the page envelope the collection endpoints share", async () => {
    const row = createTestArtistCrossReference();
    server.use(
      http.get(ARTIST_XREF_URL, () =>
        HttpResponse.json({ results: [row], total: 1, page: 0, totalPages: 1 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listArtistCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(false);
    expect(result.data).toEqual({
      results: [row],
      total: 1,
      page: 0,
      totalPages: 1,
    });
  });

  it("asks for the whole frozen collection in one request", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(ARTIST_XREF_URL, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 0 });
      }),
    );

    const store = createTestStore();
    await store.dispatch(
      catalogApi.endpoints.listArtistCrossReferences.initiate({
        limit: CROSSREFERENCE_QUERY_MAX_LIMIT,
      }),
    );

    expect(requested?.searchParams.get("limit")).toBe(
      String(CROSSREFERENCE_QUERY_MAX_LIMIT),
    );
  });

  // The JSP's "There are no Library Code Cross-References" state. The endpoint
  // answers it 200 with `total: 0`, so it must resolve as data, not an error.
  it("resolves an empty collection as a successful, empty page", async () => {
    server.use(
      http.get(ARTIST_XREF_URL, () =>
        HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 0 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listArtistCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.results).toEqual([]);
    expect(result.data?.total).toBe(0);
  });

  // The shared base query soft-fails an unparseable body — Express's HTML 404
  // for a route the deployed backend does not serve yet — into a successful
  // `null`. Here that would render as "there are no cross-references": a
  // positive claim about a frozen collection, made by a screen that is the
  // only thing in the system able to show it.
  it("surfaces a non-JSON body as an error rather than an empty collection", async () => {
    server.use(
      http.get(ARTIST_XREF_URL, () =>
        HttpResponse.text("<!DOCTYPE html><html>Cannot GET</html>", {
          status: 404,
        }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listArtistCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe("listReleaseCrossReferences", () => {
  it("returns the page envelope the collection endpoints share", async () => {
    const row = createTestReleaseCrossReference();
    server.use(
      http.get(RELEASE_XREF_URL, () =>
        HttpResponse.json({ results: [row], total: 1, page: 0, totalPages: 1 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listReleaseCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.results).toEqual([row]);
  });

  it("resolves an empty collection as a successful, empty page", async () => {
    server.use(
      http.get(RELEASE_XREF_URL, () =>
        HttpResponse.json({ results: [], total: 0, page: 0, totalPages: 0 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listReleaseCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.results).toEqual([]);
  });

  it("surfaces a non-JSON body as an error rather than an empty collection", async () => {
    server.use(
      http.get(RELEASE_XREF_URL, () =>
        HttpResponse.text("<!DOCTYPE html><html>Cannot GET</html>", {
          status: 404,
        }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.listReleaseCrossReferences.initiate({}),
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });
});
