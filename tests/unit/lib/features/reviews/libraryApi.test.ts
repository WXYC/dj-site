import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { intakeApi } from "@/lib/features/reviews/intakeApi";
import { libraryApi, isLibraryPrintRefused } from "@/lib/features/reviews/libraryApi";
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

describe("libraryApi", () => {
  describeApi(libraryApi, {
    mutations: ["printReleaseReview"],
    reducerPath: "reviewsApi",
  });

  it("printReleaseReview POSTs { review_id } to exactly /library/7/print", async () => {
    let seen: { method: string; path: string; body: unknown } | undefined;
    server.use(
      http.post(`${TEST_BACKEND_URL}/library/:id/print`, async ({ request }) => {
        seen = { method: request.method, path: new URL(request.url).pathname, body: await request.json() };
        return HttpResponse.json({ artist_name: "Juana Molina" });
      })
    );

    await makeReviewsStore().dispatch(libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 }));

    expect(seen).toEqual({ method: "POST", path: "/library/7/print", body: { review_id: 40 } });
  });

  it("printReleaseReview invalidates the release's review list, so the album panel reloads it", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/library/:id/print`, () => HttpResponse.json({ artist_name: "Juana Molina" }))
    );

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      { releaseReviews: reviewApi.endpoints.getReviewsForRelease.initiate(7) },
      libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 }),
    );

    expect(refetched).toEqual(new Set(["releaseReviews"]));
  });

  it("printReleaseReview refetches a mounted intake record and list read after a success, and only the release's review list after a refusal", async () => {
    let refuse = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json([])),
      http.get(`${TEST_BACKEND_URL}/intake/:id`, () => HttpResponse.json({ id: 5 })),
      http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([])),
      http.post(`${TEST_BACKEND_URL}/library/:id/print`, () =>
        refuse ? HttpResponse.json({ message: "m" }, { status: 400 }) : HttpResponse.json({ artist_name: "Juana Molina" })
      )
    );
    const reads = {
      item: intakeApi.endpoints.getIntakeItem.initiate(5),
      list: intakeApi.endpoints.getIntakeItems.initiate(),
      releaseReviews: reviewApi.endpoints.getReviewsForRelease.initiate(7),
    };
    const write = libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 });

    refuse = true;
    expect(await refetchesAfter(makeReviewsStore(), reads, write)).toEqual(new Set(["releaseReviews"]));

    refuse = false;
    expect(await refetchesAfter(makeReviewsStore(), reads, write)).toEqual(new Set(["item", "list", "releaseReviews"]));
  });

  it("printReleaseReview rejects with the whole error nested under libraryPrintError", async () => {
    const body = { message: "review_id must name a typed, submitted review of this release" };
    server.use(http.post(`${TEST_BACKEND_URL}/library/:id/print`, () => HttpResponse.json(body, { status: 400 })));

    const result = (await makeReviewsStore().dispatch(
      libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 })
    )) as { error?: unknown };

    expect(result.error).toEqual({ libraryPrintError: { status: 400, data: body } });
  });

  it.each([
    ["libraryPrintError", true],
    ["intakeWriteError", false],
  ])("isLibraryPrintRefused reads a 400 under %s -> %s", (key, expected) => {
    expect(isLibraryPrintRefused({ [key]: { status: 400, data: { message: "m" } } })).toBe(expected);
  });
});
