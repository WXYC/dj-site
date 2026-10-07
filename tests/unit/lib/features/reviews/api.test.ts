import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { describeApi } from "@/tests/helpers/api-harness";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/lib/error-reporting", () => ({ safeCaptureException: vi.fn() }));

const makeReviewsStore = () =>
  configureStore({
    reducer: { [reviewsApi.reducerPath]: reviewsApi.reducer },
    middleware: (gdm) => gdm().concat(reviewsApi.middleware),
  });

describe("reviewsApi", () => {
  describeApi(reviewsApi, {
    queries: ["getIntakeItems"],
    mutations: [
      "checkoutIntakeItem",
      "releaseIntakeItem",
      "acceptIntakeItem",
      "passIntakeItem",
    ],
    reducerPath: "reviewsApi",
  });

  // The base is the Backend-Service root, so each url carries its domain: a
  // base still ending in `/intake` would send `/intake/intake/...`.
  it.each([
    ["checkoutIntakeItem", "checkout"],
    ["releaseIntakeItem", "release"],
    ["acceptIntakeItem", "accept"],
    ["passIntakeItem", "pass"],
  ] as const)("%s POSTs exactly /intake/7/%s", async (endpoint, action) => {
    let seen: { method: string; path: string } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname };
        return HttpResponse.json({ id: 7 });
      })
    );

    await makeReviewsStore().dispatch(reviewsApi.endpoints[endpoint].initiate(7));

    expect(seen).toEqual({ method: "POST", path: `/intake/7/${action}` });
  });

  it("getIntakeItems GETs exactly /intake with the state filter", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(
      reviewsApi.endpoints.getIntakeItems.initiate({ state: "reviewed" })
    );

    expect(seen?.pathname).toBe("/intake");
    expect(seen?.searchParams.get("state")).toBe("reviewed");
  });

  it("resolves a query answered with an HTML body as an error, not data: null", async () => {
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/intake`,
        () =>
          new HttpResponse("<!DOCTYPE html><html>Bad Gateway</html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          })
      )
    );

    const result = await makeReviewsStore().dispatch(
      reviewsApi.endpoints.getIntakeItems.initiate()
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });
});
