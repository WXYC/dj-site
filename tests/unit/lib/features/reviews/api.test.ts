import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { isIntakeInRotation, isIntakeStateChanged, isReviewSubjectNotHeld, reviewsApi } from "@/lib/features/reviews/api";
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
    queries: ["getIntakeItems", "getIntakeItem", "getMyReviews", "getReview"],
    mutations: [
      "checkoutIntakeItem",
      "releaseIntakeItem",
      "acceptIntakeItem",
      "passIntakeItem",
      "createReview",
      "updateReview",
      "logIntakeItem",
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

  it("getIntakeItem GETs exactly /intake/7", async () => {
    let seen: { method: string; path: string } | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/:id`, ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname };
        return HttpResponse.json({ id: 7 });
      })
    );

    await makeReviewsStore().dispatch(reviewsApi.endpoints.getIntakeItem.initiate(7));

    expect(seen).toEqual({ method: "GET", path: "/intake/7" });
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
    ["undefined", undefined],
    ["a bare string", "Not signed in"],
  ])("isIntakeStateChanged reads %s as false", (_label, err) => {
    expect(isIntakeStateChanged(err)).toBe(false);
  });

  it("isIntakeStateChanged reads a raw 409 state_changed through the shared reader", () => {
    expect(isIntakeStateChanged({ status: 409, data: { reason: "state_changed" } })).toBe(true);
  });

  it.each([
    ["a wrapped 409 in_rotation", { intakeWriteError: { status: 409, data: { reason: "in_rotation" } } }, true],
    ["a raw 409 in_rotation", { status: 409, data: { reason: "in_rotation" } }, true],
    ["a wrapped 409 state_changed", { intakeWriteError: { status: 409, data: { reason: "state_changed" } } }, false],
    ["a wrapped 400 in_rotation", { intakeWriteError: { status: 400, data: { reason: "in_rotation" } } }, false],
    ["a FETCH_ERROR", { intakeWriteError: { status: "FETCH_ERROR", error: "Failed to fetch" } }, false],
    ["undefined", undefined, false],
  ])("isIntakeInRotation reads %s as %s", (_label, err, expected) => {
    expect(isIntakeInRotation(err)).toBe(expected);
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
  it("getMyReviews GETs /reviews?mine=true", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(reviewsApi.endpoints.getMyReviews.initiate());

    expect(seen?.pathname).toBe("/reviews");
    expect(seen?.searchParams.get("mine")).toBe("true");
  });

  it("getReview GETs /reviews/7", async () => {
    let path: string | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews/:id`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ id: 7 });
      })
    );

    await makeReviewsStore().dispatch(reviewsApi.endpoints.getReview.initiate(7));

    expect(path).toBe("/reviews/7");
  });

  it("createReview POSTs the request to /reviews and updateReview PATCHes the patch to /reviews/7", async () => {
    const seen: { method: string; path: string; body: unknown }[] = [];
    server.use(
      http.all(`${TEST_BACKEND_URL}/reviews/:id?`, async ({ request }) => {
        seen.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json({ id: 7 });
      })
    );
    const store = makeReviewsStore();

    await store.dispatch(reviewsApi.endpoints.createReview.initiate({ intake_item_id: 3 }));
    await store.dispatch(reviewsApi.endpoints.updateReview.initiate({ id: 7, patch: { buzzwords: "hushed" } }));

    expect(seen).toEqual([
      { method: "POST", path: "/reviews", body: { intake_item_id: 3 } },
      { method: "PATCH", path: "/reviews/7", body: { buzzwords: "hushed" } },
    ]);
  });

  it.each(["createReview", "updateReview"] as const)("%s rejects with the whole error nested under reviewWriteError", async (endpoint) => {
    const body = { message: "server words", reason: "subject_not_held" };
    server.use(
      http.all(`${TEST_BACKEND_URL}/reviews/:id?`, () => HttpResponse.json(body, { status: 409 }))
    );
    const store = makeReviewsStore();

    const result =
      endpoint === "createReview"
        ? await store.dispatch(reviewsApi.endpoints.createReview.initiate({ intake_item_id: 3 }))
        : await store.dispatch(reviewsApi.endpoints.updateReview.initiate({ id: 7, patch: {} }));

    expect("error" in result && result.error).toEqual({
      reviewWriteError: { status: 409, data: body },
    });
  });

  it.each([
    ["a wrapped 409 subject_not_held", { reviewWriteError: { status: 409, data: { reason: "subject_not_held" } } }, true],
    ["a raw 409 subject_not_held", { status: 409, data: { reason: "subject_not_held" } }, true],
    ["a wrapped 409 not_draft", { reviewWriteError: { status: 409, data: { reason: "not_draft" } } }, false],
    ["a wrapped 403 subject_not_held", { reviewWriteError: { status: 403, data: { reason: "subject_not_held" } } }, false],
    ["undefined", undefined, false],
  ])("isReviewSubjectNotHeld reads %s as %s", (_label, err, expected) => {
    expect(isReviewSubjectNotHeld(err)).toBe(expected);
  });

  it.each([
    ["asked for", { awaiting_acceptance: true }, "true"],
    ["not asked for", { state: "reviewed" as const }, null],
    ["asked for with a state", { state: "filed" as const, awaiting_acceptance: true }, "true"],
  ])("getIntakeItems sends awaiting_acceptance when %s", async (_label, arg, expected) => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(reviewsApi.endpoints.getIntakeItems.initiate(arg));

    expect(seen?.searchParams.get("awaiting_acceptance")).toBe(expected);
  });

  it("logIntakeItem POSTs the logging fields to /intake", async () => {
    let seen: { method: string; path: string; body: unknown } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake`, async ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname, body: await request.json() };
        return HttpResponse.json({ id: 9 });
      })
    );
    const body = { artist_name: "Cat Power", album_title: "Moon Pix", format_id: 1 };

    await makeReviewsStore().dispatch(reviewsApi.endpoints.logIntakeItem.initiate(body));

    expect(seen).toEqual({ method: "POST", path: "/intake", body });
  });
});
