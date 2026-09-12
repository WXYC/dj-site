import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { rotationApi } from "@/lib/features/rotation/api";
import { lmlApi } from "@/lib/features/lml/api";
import { binApi } from "@/lib/features/bin/api";

// Mock the authentication client so the base query's token fetch resolves.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

// A non-JSON 200 (e.g. an HTML gateway/interstitial page) served with a JSON
// content-type: fetchBaseQuery's json responseHandler throws, RTK surfaces
// PARSING_ERROR, and backendBaseQuery soft-fails GETs to `{ data: null }`
// (see WXYC/dj-site#519). The guarded transformResponse callbacks then receive
// `null` and must return an empty/undefined value instead of throwing
// `Cannot read properties of null (reading 'map')` (#606).
const nonJsonBody = () =>
  new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("transformResponse soft-fail guards (#606)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("searchCatalog returns [] on a soft-failed (null) response", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/library/`, () => nonJsonBody()));

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Juana Molina",
        album_title: undefined,
        n: undefined,
      }),
    );

    expect(result.status).toBe("fulfilled");
    expect(result.data).toEqual([]);
  });

  it("getInformation returns undefined on a soft-failed (null) response", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/library/info`, () => nonJsonBody()));

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getInformation.initiate({ album_id: 1001 }),
    );

    expect(result.status).toBe("fulfilled");
    expect(result.data).toBeUndefined();
  });

  // The deliberate exception to the guard above, and the reason it is an
  // exception: every consumer of this read treats the absence of a row as the
  // positive claim "this release is in no bin" — no badge on the album card, no
  // active entries in the catalog row's context menu — so a bin pick made
  // against an empty list adds without retiring and stacks a second active bin
  // on a release that already had one. An unparseable body resolving to [] would
  // therefore license a wrong write, not merely show a thin screen. Its two
  // sibling rotation reads opt out for the weaker version of this reason.
  it("getRotation surfaces an unparseable body as an error rather than an empty list", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () => nonJsonBody()),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      rotationApi.endpoints.getRotation.initiate(),
    );

    expect(result.status).toBe("rejected");
    expect(result.data).toBeUndefined();
  });

  // A JSON `null` body is a different thing from an unparseable one and still
  // means "no rows", so the transform's own guard still has to hold.
  it("getRotation still returns [] for a JSON null body", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () =>
        HttpResponse.json(null),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      rotationApi.endpoints.getRotation.initiate(),
    );

    expect(result.status).toBe("fulfilled");
    expect(result.data).toEqual([]);
  });

  it("lml searchLibrary returns [] on a soft-failed (null) response", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/proxy/library/search`, () => nonJsonBody()),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      lmlApi.endpoints.searchLibrary.initiate({
        artist: "Juana Molina",
        title: "DOGA",
      }),
    );

    expect(result.status).toBe("fulfilled");
    expect(result.data).toEqual([]);
  });

  it("getBin returns [] on a soft-failed (null) response", async () => {
    server.use(http.get(`${TEST_BACKEND_URL}/djs/bin/`, () => nonJsonBody()));

    const store = createTestStore();
    const result = await store.dispatch(
      binApi.endpoints.getBin.initiate({ dj_id: "dj-5" }),
    );

    expect(result.status).toBe("fulfilled");
    expect(result.data).toEqual([]);
  });
});
