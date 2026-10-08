import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { isIntakeStateChanged, reviewsApi } from "@/lib/features/reviews/api";
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

  // Nested whole under one key, so the shared error toast stays quiet (the
  // screen words its own refusal) while status, reason and message survive
  // for whichever caller needs them.
  it.each([
    ["checkoutIntakeItem"],
    ["releaseIntakeItem"],
    ["acceptIntakeItem"],
    ["passIntakeItem"],
  ] as const)("%s rejects with the whole error nested under intakeWriteError", async (endpoint) => {
    const body = { message: "server words", reason: "state_changed" };
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, () =>
        HttpResponse.json(body, { status: 409 })
      )
    );

    const result = await makeReviewsStore().dispatch(reviewsApi.endpoints[endpoint].initiate(7));

    expect("error" in result && result.error).toEqual({
      intakeWriteError: { status: 409, data: body },
    });
  });

  it.each([
    ["a 409 state_changed", 409, { message: "m", reason: "state_changed" }, true],
    ["a 409 with another reason", 409, { message: "m", reason: "not_holder" }, false],
    ["a 403 state_changed", 403, { message: "m", reason: "state_changed" }, false],
    ["a 500", 500, { message: "m" }, false],
  ] as const)("isIntakeStateChanged reads %s as %s", async (_label, status, body, expected) => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/checkout`, () =>
        HttpResponse.json(body, { status })
      )
    );

    const result = await makeReviewsStore().dispatch(
      reviewsApi.endpoints.checkoutIntakeItem.initiate(7)
    );

    expect(isIntakeStateChanged("error" in result ? result.error : undefined)).toBe(expected);
  });

  it.each([
    ["an unwrapped 409 state_changed", { status: 409, data: { reason: "state_changed" } }],
    ["undefined", undefined],
    ["a bare string", "Not signed in"],
  ])("isIntakeStateChanged reads %s as false", (_label, err) => {
    expect(isIntakeStateChanged(err)).toBe(false);
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

  // The other half: a read the client itself tore down mid-body (superseded
  // args, an unmount) says nothing about the backend, so it must not show the
  // load-failure alert. The body stream errors with the DOMException a browser
  // raises when the request's signal aborts during the read.
  it("does not resolve a query aborted mid-body-read as an error", async () => {
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/intake`,
        () =>
          new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("[{"));
                controller.error(new DOMException("This operation was aborted", "AbortError"));
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
      )
    );

    const result = await makeReviewsStore().dispatch(
      reviewsApi.endpoints.getIntakeItems.initiate()
    );

    expect(result.isError).toBe(false);
    expect(result.error).toBeUndefined();
  });
});
