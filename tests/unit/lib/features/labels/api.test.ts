import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { labelsApi, useSearchLabelsQuery } from "@/lib/features/labels/api";
import { describeApi, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

/** Just this slice, so a failure names the labels endpoint rather than the whole store. */
function labelsStore() {
  return configureStore({
    reducer: { [labelsApi.reducerPath]: labelsApi.reducer },
    middleware: (gdm) => gdm().concat(labelsApi.middleware),
  });
}

describe("labelsApi", () => {
  describeApi(labelsApi, {
    queries: ["searchLabels"],
    reducerPath: "labelsApi",
  });

  it("exports the useSearchLabelsQuery hook", () => {
    expect(useSearchLabelsQuery).toBeDefined();
    expect(typeof useSearchLabelsQuery).toBe("function");
  });

  it("asks /labels/search for the query and the caller's result limit", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json([{ id: 5, label_name: "Sonamos" }]);
      }),
    );

    const store = labelsStore();
    const result = await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(requested?.pathname).toBe("/labels/search");
    expect(requested?.searchParams.get("q")).toBe("Sona");
    expect(requested?.searchParams.get("limit")).toBe("10");
    expect(result.data).toEqual([{ id: 5, label_name: "Sonamos" }]);
  });

  // The shared backend base query converts an unparseable body into a
  // successful `null` payload rather than a toast, so the declared
  // `LabelRow[]` return type only holds if this endpoint substitutes a list.
  // Consumers index and map the result; a `null` reaching them would throw.
  it("yields an empty list when the backend soft-fails on a non-JSON body", async () => {
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/labels/search`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
            status: 404,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = labelsStore();
    const result = await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(result.isError).toBe(false);
    expect(result.data).toEqual([]);
  });
});
