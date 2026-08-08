import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import { labelsApi, useSearchLabelsQuery } from "@/lib/features/labels/api";
import { rtkQueryErrorLogger } from "@/lib/rtk-query-error-logger";
import { describeApi, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

/** Just this slice, so a failure names the labels endpoint rather than the whole store. */
function labelsStore() {
  return configureStore({
    reducer: { [labelsApi.reducerPath]: labelsApi.reducer },
    middleware: (gdm) => gdm().concat(labelsApi.middleware),
  });
}

/** Includes the shared middleware, for tests asserting what it does — or does not — do. */
function labelsStoreWithErrorLogger() {
  return configureStore({
    reducer: { [labelsApi.reducerPath]: labelsApi.reducer },
    middleware: (gdm) =>
      gdm().concat(rtkQueryErrorLogger).concat(labelsApi.middleware),
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

  // The shared backend base query soft-fails an unparseable body into a
  // successful `null` payload. That default is wrong for a duplicate check:
  // an empty list is indistinguishable from "no existing label matched", so a
  // gateway's HTML 502 or a missing route would license the create path and
  // produce the near-duplicate this endpoint exists to surface. The endpoint
  // opts out, so an unreachable backend has to arrive as an error.
  it.each([
    ["a gateway HTML error page", 502],
    ["the framework's HTML 404", 404],
  ])("surfaces %s as an error rather than an empty list", async (_name, status) => {
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/labels/search`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = labelsStore();
    const result = await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });

  // The picker renders its own inline "Label search is unavailable" panel for
  // every failure shape here — the opt-out above turns a non-JSON body into
  // this same isError state. The shared rtk-query-error-logger middleware
  // reporting it a second time as a global toast would double the same
  // outage for a screen-reader user without adding any information.
  it.each([
    ["a gateway HTML error page (PARSING_ERROR opt-out)", () =>
      new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    ],
    ["a structured JSON error body", () =>
      HttpResponse.json({ message: "boom" }, { status: 500 }),
    ],
  ])("keeps %s out of the global toast", async (_name, respond) => {
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    server.use(http.get(`${TEST_BACKEND_URL}/labels/search`, respond));

    const store = labelsStoreWithErrorLogger();
    const result = await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(result.isError).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  // A JSON `null` body still parses, so it reaches transformResponse rather
  // than the opt-out above. Consumers index and map the result, so the
  // declared `Label[]` return type only holds if a list is substituted.
  it("substitutes an empty list for a JSON null body", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json(null),
      ),
    );

    const store = labelsStore();
    const result = await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(result.isError).toBe(false);
    expect(result.data).toEqual([]);
  });

  // Creating a label is an upsert on the exact name. Without a tag on this
  // result, a search cached just before a label was created keeps serving its
  // pre-creation empty list for the whole unused-data window, and the next
  // release filed under that label goes through the create path a second time.
  it("provides the label-search list tag so a label write can invalidate it", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/labels/search`, () =>
        HttpResponse.json([{ id: 5, label_name: "Sonamos" }]),
      ),
    );

    const store = labelsStore();
    await store.dispatch(
      labelsApi.endpoints.searchLabels.initiate({ q: "Sona", limit: 10 }),
    );

    expect(
      labelsApi.util.selectInvalidatedBy(store.getState(), [
        { type: "LabelSearch", id: "LIST" },
      ]),
    ).toEqual([expect.objectContaining({ endpointName: "searchLabels" })]);
  });
});
