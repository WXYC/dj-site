import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { isReviewInUse, isReviewNotDraft, isReviewSubjectNotHeld, reviewApi } from "@/lib/features/reviews/reviewApi";
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

describe("reviewApi", () => {
  describeApi(reviewApi, {
    queries: ["getMyReviews", "getReview"],
    mutations: ["createReview", "updateReview", "submitReview", "deleteReview"],
    reducerPath: "reviewsApi",
  });

  it("getMyReviews GETs /reviews?mine=true", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(reviewApi.endpoints.getMyReviews.initiate());

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

    await makeReviewsStore().dispatch(reviewApi.endpoints.getReview.initiate(7));

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

    await store.dispatch(reviewApi.endpoints.createReview.initiate({ intake_item_id: 3 }));
    await store.dispatch(reviewApi.endpoints.updateReview.initiate({ id: 7, patch: { buzzwords: "hushed" } }));

    expect(seen).toEqual([
      { method: "POST", path: "/reviews", body: { intake_item_id: 3 } },
      { method: "PATCH", path: "/reviews/7", body: { buzzwords: "hushed" } },
    ]);
  });

  it("submitReview POSTs to /reviews/7/submit and deleteReview DELETEs /reviews/7, answered with an empty 204", async () => {
    const seen: { method: string; path: string }[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews/:id/submit`, ({ request }) => {
        seen.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json({ id: 7 });
      }),
      http.delete(`${TEST_BACKEND_URL}/reviews/:id`, ({ request }) => {
        seen.push({ method: request.method, path: new URL(request.url).pathname });
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const store = makeReviewsStore();

    const submitted = await store.dispatch(reviewApi.endpoints.submitReview.initiate(7));
    const deleted = await store.dispatch(reviewApi.endpoints.deleteReview.initiate(7));

    expect(seen).toEqual([
      { method: "POST", path: "/reviews/7/submit" },
      { method: "DELETE", path: "/reviews/7" },
    ]);
    expect(submitted).toEqual(expect.objectContaining({ data: { id: 7 } }));
    expect("error" in deleted).toBe(false);
  });

  it.each(["submitReview", "deleteReview"] as const)("%s rejects with the whole error nested under reviewWriteError", async (endpoint) => {
    const body = { message: "server words", reason: "in_use" };
    const answered: string[] = [];
    server.use(
      http.post(`${TEST_BACKEND_URL}/reviews/:id/submit`, () => (answered.push("POST"), HttpResponse.json(body, { status: 409 }))),
      http.delete(`${TEST_BACKEND_URL}/reviews/:id`, () => (answered.push("DELETE"), HttpResponse.json(body, { status: 409 }))),
    );
    const store = makeReviewsStore();

    const result =
      endpoint === "submitReview"
        ? await store.dispatch(reviewApi.endpoints.submitReview.initiate(7))
        : await store.dispatch(reviewApi.endpoints.deleteReview.initiate(7));

    expect(answered).toEqual([endpoint === "submitReview" ? "POST" : "DELETE"]);
    expect("error" in result && result.error).toEqual({ reviewWriteError: { status: 409, data: body } });
  });

  it.each(["createReview", "updateReview"] as const)("%s rejects with the whole error nested under reviewWriteError", async (endpoint) => {
    const body = { message: "server words", reason: "subject_not_held" };
    server.use(
      http.all(`${TEST_BACKEND_URL}/reviews/:id?`, () => HttpResponse.json(body, { status: 409 }))
    );
    const store = makeReviewsStore();

    const result =
      endpoint === "createReview"
        ? await store.dispatch(reviewApi.endpoints.createReview.initiate({ intake_item_id: 3 }))
        : await store.dispatch(reviewApi.endpoints.updateReview.initiate({ id: 7, patch: {} }));

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
    ["isReviewNotDraft", isReviewNotDraft, "not_draft", "in_use"],
    ["isReviewInUse", isReviewInUse, "in_use", "not_draft"],
  ] as const)("%s reads wrapped and raw 409s of its reason only", (_name, predicate, reason, other) => {
    expect(predicate({ reviewWriteError: { status: 409, data: { reason } } })).toBe(true);
    expect(predicate({ status: 409, data: { reason } })).toBe(true);
    expect(predicate({ reviewWriteError: { status: 409, data: { reason: other } } })).toBe(false);
    expect(predicate({ reviewWriteError: { status: 400, data: { reason } } })).toBe(false);
    expect(predicate(undefined)).toBe(false);
  });
});
