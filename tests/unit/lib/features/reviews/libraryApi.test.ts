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
    let reads = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/reviews`, () => {
        reads += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/:id/print`, () => HttpResponse.json({ artist_name: "Juana Molina" }))
    );
    const store = makeReviewsStore();
    store.dispatch(reviewApi.endpoints.getReviewsForRelease.initiate(7));
    await vi.waitFor(() => expect(reads).toBe(1));

    await store.dispatch(libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 }));

    await vi.waitFor(() => expect(reads).toBe(2));
  });

  it("printReleaseReview refetches a mounted intake record and list read after a success, and nothing after a refusal", async () => {
    let itemReads = 0;
    let listReads = 0;
    let refuse = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/intake/:id`, () => {
        itemReads += 1;
        return HttpResponse.json({ id: 5 });
      }),
      http.get(`${TEST_BACKEND_URL}/intake`, () => {
        listReads += 1;
        return HttpResponse.json([]);
      }),
      http.post(`${TEST_BACKEND_URL}/library/:id/print`, () =>
        refuse ? HttpResponse.json({ message: "m" }, { status: 400 }) : HttpResponse.json({ artist_name: "Juana Molina" })
      )
    );
    const store = makeReviewsStore();
    store.dispatch(intakeApi.endpoints.getIntakeItem.initiate(5));
    store.dispatch(intakeApi.endpoints.getIntakeItems.initiate());
    await vi.waitFor(() => expect([itemReads, listReads]).toEqual([1, 1]));

    refuse = true;
    await store.dispatch(libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 }));
    await new Promise((r) => setTimeout(r, 50));
    expect([itemReads, listReads]).toEqual([1, 1]);

    refuse = false;
    await store.dispatch(libraryApi.endpoints.printReleaseReview.initiate({ albumId: 7, reviewId: 40 }));
    await vi.waitFor(() => expect([itemReads, listReads]).toEqual([2, 2]));
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
