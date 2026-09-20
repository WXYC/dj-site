import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { createTestStore } from "@/tests/helpers/store";
import { catalogApi } from "@/lib/features/catalog/api";

const COUNTS_URL = `${TEST_BACKEND_URL}/library/53375/flowsheet-play-counts`;

describe("getFlowsheetPlayCounts", () => {
  it("reads the three arms off the release's own path", async () => {
    server.use(
      http.get(COUNTS_URL, () =>
        HttpResponse.json({ direct: 41, rotation_linked: 6, legacy_linked: 2 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getFlowsheetPlayCounts.initiate(53375),
    );

    expect(result.isError).toBe(false);
    expect(result.data).toEqual({ direct: 41, rotation_linked: 6, legacy_linked: 2 });
  });

  // This read informs an irreversible delete: an unreachable backend must
  // surface as an error, never as the default GET soft-fail (`data: null`),
  // which a caller could otherwise render as "no plays" -- the one claim
  // this screen cannot support without evidence.
  it.each([
    ["a gateway HTML error page", 502],
    ["the framework's HTML 404", 404],
  ])("surfaces %s as an error rather than a soft-failed null", async (_name, status) => {
    server.use(
      http.get(
        COUNTS_URL,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getFlowsheetPlayCounts.initiate(53375),
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it("surfaces a structured 404 for an album id that does not exist", async () => {
    server.use(
      http.get(COUNTS_URL, () =>
        HttpResponse.json({ message: "Album not found" }, { status: 404 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      catalogApi.endpoints.getFlowsheetPlayCounts.initiate(53375),
    );

    expect(result.isError).toBe(true);
  });
});
