import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import type { IntakeItemState } from "@wxyc/shared";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { fccNoteApi } from "@/lib/features/reviews/fccNoteApi";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { intakeApi, isIntakeAcceptReviewRefused, isIntakeInRotation, isIntakeInvalidCitation, isIntakeReleaseRefused, isIntakeNotReviewed, isIntakeRequestRefused, isIntakeStateChanged } from "@/lib/features/reviews/intakeApi";
import { describeApi } from "@/tests/helpers/api-harness";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";
import { refetchesAfter } from "@/tests/helpers/refetches";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/lib/error-reporting", () => ({ safeCaptureException: vi.fn() }));

const makeReviewsStore = () =>
  configureStore({
    reducer: { [reviewsApi.reducerPath]: reviewsApi.reducer },
    middleware: (gdm) => gdm().concat(reviewsApi.middleware),
  });

describe("intakeApi", () => {
  describeApi(intakeApi, {
    queries: ["getIntakeItems", "getIntakeItem"],
    mutations: [
      "checkoutIntakeItem",
      "releaseIntakeItem",
      "requestIntakeItem",
      "acceptIntakeItem",
      "acceptReview",
      "passIntakeItem",
      "logIntakeItem",
      "fileIntakeItem",
      "printIntakeItem",
      "deleteIntakeItem",
      "updateIntakeItem",
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

    await makeReviewsStore().dispatch(intakeApi.endpoints[endpoint].initiate(7));

    expect(seen).toEqual({ method: "POST", path: `/intake/7/${action}` });
  });

  it("requestIntakeItem POSTs the chosen dj_id, and a bare 400 reads as a refused request", async () => {
    let body: unknown;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/request`, async ({ request }) => {
        body = await request.clone().json();
        return HttpResponse.json({ message: "server words" }, { status: 400 });
      })
    );

    const result = await makeReviewsStore().dispatch(intakeApi.endpoints.requestIntakeItem.initiate({ id: 7, djId: "dj-pat" }));

    expect(body).toEqual({ dj_id: "dj-pat" });
    expect(isIntakeRequestRefused("error" in result ? result.error : undefined)).toBe(true);
  });

  it.each([
    ["isIntakeReleaseRefused", isIntakeReleaseRefused, "intakeWriteError", true],
    ["isIntakeRequestRefused", isIntakeRequestRefused, "intakeWriteError", true],
    ["isIntakeAcceptReviewRefused", isIntakeAcceptReviewRefused, "intakeWriteError", true],
    ["isIntakeReleaseRefused", isIntakeReleaseRefused, "libraryPrintError", false],
    ["isIntakeRequestRefused", isIntakeRequestRefused, "libraryPrintError", false],
    ["isIntakeAcceptReviewRefused", isIntakeAcceptReviewRefused, "libraryPrintError", false],
  ])("$0 reads a 400 under $2 -> $3", (_name, predicate, key, expected) => {
    expect(predicate({ [key]: { status: 400, data: { message: "m" } } })).toBe(expected);
  });

  it("acceptReview POSTs { review_id } to exactly /intake/7/accept-review and refreshes the intake and review reads", async () => {
    let seen: { path: string; body: unknown } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/accept-review`, async ({ request }) => {
        seen = { path: new URL(request.url).pathname, body: await request.clone().json() };
        return HttpResponse.json({ id: 7 });
      })
    );

    await makeReviewsStore().dispatch(intakeApi.endpoints.acceptReview.initiate({ id: 7, reviewId: 40 }));

    expect(seen).toEqual({ path: "/intake/7/accept-review", body: { review_id: 40 } });
  });

  it("updateIntakeItem PATCHes the body to exactly /intake/7, writes the answered item into the cache, and refreshes the intake and review reads", async () => {
    let seen: { method: string; path: string; body: unknown } | undefined;
    server.use(
      http.patch(`${TEST_BACKEND_URL}/intake/7`, async ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname, body: await request.clone().json() };
        return HttpResponse.json({ id: 7, cited_album_id: null });
      }),
      http.get(`${TEST_BACKEND_URL}/intake/7`, () => HttpResponse.json({ id: 7, cited_album_id: 3, accepted_review_id: 90 })),
    );
    const store = makeReviewsStore();
    await store.dispatch(intakeApi.endpoints.getIntakeItem.initiate(7));
    server.use(http.get(`${TEST_BACKEND_URL}/intake/7`, () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    await store.dispatch(intakeApi.endpoints.updateIntakeItem.initiate({ id: 7, body: { cited_album_id: null } }));

    expect(seen).toEqual({ method: "PATCH", path: "/intake/7", body: { cited_album_id: null } });
    expect(intakeApi.endpoints.getIntakeItem.select(7)(store.getState() as never).data).toMatchObject({ id: 7, cited_album_id: null, accepted_review_id: 90 });
  });

  it.each([
    ["a 409 invalid_citation", 409, { message: "m", reason: "invalid_citation" }, true],
    ["a 409 already_filed", 409, { message: "m", reason: "already_filed" }, false],
    ["a 400 invalid_citation", 400, { message: "m", reason: "invalid_citation" }, false],
  ] as const)("isIntakeInvalidCitation reads %s as %s", async (_label, status, body, expected) => {
    server.use(http.patch(`${TEST_BACKEND_URL}/intake/7`, () => HttpResponse.json(body, { status })));

    const result = await makeReviewsStore().dispatch(intakeApi.endpoints.updateIntakeItem.initiate({ id: 7, body: { cited_album_id: 3 } }));

    expect(isIntakeInvalidCitation("error" in result ? result.error : undefined)).toBe(expected);
  });

  it("acceptReview refetches the item and the lists of reviews, so the album's cover review and the item's cards follow the choice", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/intake/:id`, () => HttpResponse.json({ id: 7 })),
      http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/intake/:id/accept-review`, () => HttpResponse.json({ id: 7 })),
    );

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      {
        item7: intakeApi.endpoints.getIntakeItem.initiate(7),
        list: intakeApi.endpoints.getIntakeItems.initiate(),
        releaseReviews: reviewApi.endpoints.getReviewsForRelease.initiate(3),
        myReviews: reviewApi.endpoints.getMyReviews.initiate(),
      },
      intakeApi.endpoints.acceptReview.initiate({ id: 7, reviewId: 40 }),
    );

    expect(refetched).toEqual(new Set(["item7", "list", "releaseReviews", "myReviews"]));
  });

  it("deleteIntakeItem DELETEs exactly /intake/7 and answers the deleted authors", async () => {
    let seen: { method: string; path: string } | undefined;
    server.use(
      http.delete(`${TEST_BACKEND_URL}/intake/:id`, ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname };
        return HttpResponse.json({ deleted_review_authors: ["Cat Power"] });
      })
    );

    const result = await makeReviewsStore().dispatch(intakeApi.endpoints.deleteIntakeItem.initiate(7));

    expect(seen).toEqual({ method: "DELETE", path: "/intake/7" });
    expect(result).toMatchObject({ data: { deleted_review_authors: ["Cat Power"] } });
  });

  it("deleteIntakeItem refreshes the lists but not the deleted record's own reads", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/intake/:id`, ({ params }) => HttpResponse.json({ id: Number(params.id) })),
      http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/fcc-notes`, () => HttpResponse.json([])),
      http.delete(`${TEST_BACKEND_URL}/intake/:id`, () => HttpResponse.json({ deleted_review_authors: [] })),
    );

    // The two lists and the waiting list refetch; no read of the deleted record (item7, itemReviews7) follows, nor the other record's.
    const refetched = await refetchesAfter(
      makeReviewsStore(),
      {
        waiting: fccNoteApi.endpoints.getFccNotesToConfirm.initiate(),
        list: intakeApi.endpoints.getIntakeItems.initiate(),
        item7: intakeApi.endpoints.getIntakeItem.initiate(7),
        item8: intakeApi.endpoints.getIntakeItem.initiate(8),
        itemReviews7: reviewApi.endpoints.getItemReviews.initiate(7),
        myReviews: reviewApi.endpoints.getMyReviews.initiate(),
      },
      intakeApi.endpoints.deleteIntakeItem.initiate(7),
    );

    expect(refetched).toEqual(new Set(["waiting", "list", "myReviews"]));
  });

  it("deleteIntakeItem nests a rejection under intakeWriteError", async () => {
    server.use(http.delete(`${TEST_BACKEND_URL}/intake/:id`, () => HttpResponse.json({ message: "gone" }, { status: 404 })));

    const result = await makeReviewsStore().dispatch(intakeApi.endpoints.deleteIntakeItem.initiate(7));

    expect(result).toMatchObject({ error: { intakeWriteError: { status: 404 } } });
  });

  it("printIntakeItem POSTs exactly /intake/7/print", async () => {
    let seen: { method: string; path: string } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/print`, ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname };
        return HttpResponse.json({ artist_name: "Stereolab" });
      })
    );

    await makeReviewsStore().dispatch(intakeApi.endpoints.printIntakeItem.initiate(7));

    expect(seen).toEqual({ method: "POST", path: "/intake/7/print" });
  });

  it("fileIntakeItem POSTs the body to exactly /intake/7/file", async () => {
    let seen: { method: string; path: string; body: unknown } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/file`, async ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname, body: await request.json() };
        return HttpResponse.json({ id: 7 });
      })
    );
    const body = { kind: "existing_release", album_id: 3 } as const;

    await makeReviewsStore().dispatch(intakeApi.endpoints.fileIntakeItem.initiate({ id: 7, body }));

    expect(seen).toEqual({ method: "POST", path: "/intake/7/file", body });
  });

  it("getIntakeItem GETs exactly /intake/7", async () => {
    let seen: { method: string; path: string } | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/:id`, ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname };
        return HttpResponse.json({ id: 7 });
      })
    );

    await makeReviewsStore().dispatch(intakeApi.endpoints.getIntakeItem.initiate(7));

    expect(seen).toEqual({ method: "GET", path: "/intake/7" });
  });

  // Nested whole under one key, so the shared error toast stays quiet (the
  // screen words its own refusal) while status, reason and message survive
  // for whichever caller needs them.
  it.each([
    ["checkoutIntakeItem", 7],
    ["releaseIntakeItem", 7],
    ["acceptIntakeItem", 7],
    ["acceptReview", { id: 7, reviewId: 40 }],
    ["passIntakeItem", 7],
    ["printIntakeItem", 7],
    ["fileIntakeItem", { id: 7, body: { kind: "existing_release", album_id: 3 } }],
  ] as const)("%s rejects with the whole error nested under intakeWriteError", async (endpoint, arg) => {
    const body = { message: "server words", reason: "state_changed" };
    server.use(
      http.post(`${TEST_BACKEND_URL}/intake/:id/:action`, () =>
        HttpResponse.json(body, { status: 409 })
      )
    );

    const result = await makeReviewsStore().dispatch(intakeApi.endpoints[endpoint].initiate(arg as never) as never) as { error?: unknown };

    expect(result.error).toEqual({
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
      intakeApi.endpoints.checkoutIntakeItem.initiate(7)
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

  it.each([
    ["a wrapped 409 not_reviewed", { intakeWriteError: { status: 409, data: { reason: "not_reviewed" } } }, true],
    ["a raw 409 not_reviewed", { status: 409, data: { reason: "not_reviewed" } }, true],
    ["a wrapped 409 state_changed", { intakeWriteError: { status: 409, data: { reason: "state_changed" } } }, false],
    ["a wrapped 400 not_reviewed", { intakeWriteError: { status: 400, data: { reason: "not_reviewed" } } }, false],
    ["undefined", undefined, false],
  ])("isIntakeNotReviewed reads %s as %s", (_label, err, expected) => {
    expect(isIntakeNotReviewed(err)).toBe(expected);
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
      intakeApi.endpoints.getIntakeItems.initiate({ state: "reviewed" })
    );

    expect(seen?.pathname).toBe("/intake");
    expect(seen?.searchParams.get("state")).toBe("reviewed");
  });

  it.each<[string, { state?: IntakeItemState; active?: boolean; limit?: number } | undefined, string]>([
    ["an empty argument", {}, ""],
    ["undefined", undefined, ""],
    ["active", { active: true }, "?active=true"],
    ["state and limit", { state: "filed", limit: 100 }, "?state=filed&limit=100"],
  ])("getIntakeItems serializes %s with only the params that are set", async (_label, args, search) => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(intakeApi.endpoints.getIntakeItems.initiate(args));

    expect(seen?.search).toBe(search);
  });

  it("getIntakeItems with no argument GETs /intake with no query string at all", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(intakeApi.endpoints.getIntakeItems.initiate());

    expect(seen?.pathname).toBe("/intake");
    expect(seen?.search).toBe("");
    expect(seen?.href).not.toContain("?");
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
      intakeApi.endpoints.getIntakeItems.initiate()
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
      intakeApi.endpoints.getIntakeItems.initiate()
    );

    expect(result.isError).toBe(false);
    expect(result.error).toBeUndefined();
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

    await makeReviewsStore().dispatch(intakeApi.endpoints.logIntakeItem.initiate(body));

    expect(seen).toEqual({ method: "POST", path: "/intake", body });
  });
});
