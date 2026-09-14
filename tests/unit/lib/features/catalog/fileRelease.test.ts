import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";
import { rotationApi } from "@/lib/features/rotation/api";
import { isLibraryFilingConflict } from "@/lib/features/catalog/fileReleaseConflict";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

const FILING_REQUEST = {
  artist: { kind: "create" as const, artist_name: "Chuquimamani-Condori", code_letters: "CH", genre_id: 5 },
  release: { album_title: "Edits", genre_id: 5, format_id: 1, label: "self-released" },
  rotation: { rotation_bin: "H" as const },
};

const FILING_RESPONSE = {
  artist: { id: 900, artist_name: "Chuquimamani-Condori", code_letters: "CH", code_artist_number: 1, genre_id: 5 },
  release: { id: 4242, artist_id: 900, album_title: "Edits", code_number: 1, genre_id: 5, format_id: 1 },
  rotation: { id: 9001, album_id: 4242, rotation_bin: "H" as const, add_date: "2026-09-13" },
};

describe("catalogApi.fileRelease (POST /library/filings)", () => {
  it("POSTs the composed request to /library/filings", async () => {
    let requestBody: unknown;
    let requested: URL | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/filings`, async ({ request }) => {
        requested = new URL(request.url);
        requestBody = await request.json();
        return HttpResponse.json(FILING_RESPONSE, { status: 201 });
      }),
    );

    const store = createTestStore();
    const result = await store.dispatch(catalogApi.endpoints.fileRelease.initiate(FILING_REQUEST));

    expect(requested?.pathname).toBe("/library/filings");
    expect(requestBody).toEqual(FILING_REQUEST);
    expect(result.data).toEqual(FILING_RESPONSE);
  });

  it("invalidates catalogApi's CatalogList tag and cross-dispatches rotationApi's Rotation tag", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/library/`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/library/rotation`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/library/filings`, () => HttpResponse.json(FILING_RESPONSE, { status: 201 })),
    );

    const store = createTestStore();
    await store.dispatch(
      catalogApi.endpoints.searchCatalog.initiate({
        artist_name: "Chuquimamani-Condori",
        album_title: undefined,
        n: undefined,
      }),
    );
    await store.dispatch(rotationApi.endpoints.getRotationList.initiate("active"));

    await store.dispatch(catalogApi.endpoints.fileRelease.initiate(FILING_REQUEST));
    // The cross-slice invalidation dispatches its own action; give the
    // rotationApi middleware a tick to process it before asserting.
    await vi.waitFor(() =>
      expect(
        rotationApi.util.selectInvalidatedBy(store.getState(), [{ type: "Rotation" }]),
      ).toEqual([expect.objectContaining({ endpointName: "getRotationList" })]),
    );

    expect(
      catalogApi.util.selectInvalidatedBy(store.getState(), [{ type: "CatalogList" }]),
    ).toEqual([expect.objectContaining({ endpointName: "searchCatalog" })]);
  });

  it("wraps a 409 conflict out of the shared toast lookup, readable via isLibraryFilingConflict", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/filings`, () =>
        HttpResponse.json(
          {
            message: "Artist code already taken",
            reason: "artist_code_conflict",
            artist: { id: 5, artist_name: "Chuquimamani-Condori", code_letters: "CH" },
          },
          { status: 409 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(catalogApi.endpoints.fileRelease.initiate(FILING_REQUEST));

    expect("error" in result).toBe(true);
    const error = "error" in result ? result.error : undefined;
    expect(error).toHaveProperty("fileReleaseError");
    const wrapped = (error as { fileReleaseError?: unknown }).fileReleaseError;
    expect(isLibraryFilingConflict(wrapped)).toBe(true);
    if (isLibraryFilingConflict(wrapped)) {
      expect(wrapped.data.reason).toBe("artist_code_conflict");
    }
  });
});
