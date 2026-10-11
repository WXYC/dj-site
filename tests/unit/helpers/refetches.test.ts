import { afterEach, describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { reviewsApi } from "@/lib/features/reviews/api";
import { fccNoteApi } from "@/lib/features/reviews/fccNoteApi";
import { intakeApi } from "@/lib/features/reviews/intakeApi";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { refetchesAfter } from "@/tests/helpers/refetches";
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

const answerReads = () =>
  server.use(
    http.get(`${TEST_BACKEND_URL}/intake`, () => HttpResponse.json([])),
    http.get(`${TEST_BACKEND_URL}/reviews`, () => HttpResponse.json([])),
  );

describe("refetchesAfter", () => {
  it("reports only the read a write invalidates, of two mounted reads", async () => {
    answerReads();
    // updateReview invalidates Review only, so the intake list stays.
    server.use(http.patch(`${TEST_BACKEND_URL}/reviews/:id`, () => HttpResponse.json({ id: 7 })));

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      {
        intakeList: intakeApi.endpoints.getIntakeItems.initiate(),
        myReviews: reviewApi.endpoints.getMyReviews.initiate(),
      },
      reviewApi.endpoints.updateReview.initiate({ id: 7, patch: {} }),
    );

    expect(refetched).toEqual(new Set(["myReviews"]));
  });

  it("reports the refetch of a refused write that still invalidates", async () => {
    answerReads();
    server.use(http.delete(`${TEST_BACKEND_URL}/reviews/:id`, () => HttpResponse.json({ message: "m" }, { status: 409 })));

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      { intakeList: intakeApi.endpoints.getIntakeItems.initiate() },
      reviewApi.endpoints.deleteReview.initiate(7),
    );

    expect(refetched).toEqual(new Set(["intakeList"]));
  });

  it("reports an empty set for a write that invalidates nothing", async () => {
    answerReads();
    // confirmFccNote invalidates FccNotes only, which neither mounted read provides.
    server.use(http.post(`${TEST_BACKEND_URL}/fcc-notes/:id/confirm`, () => HttpResponse.json({ id: 4 })));

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      {
        intakeList: intakeApi.endpoints.getIntakeItems.initiate(),
        myReviews: reviewApi.endpoints.getMyReviews.initiate(),
      },
      fccNoteApi.endpoints.confirmFccNote.initiate(4),
    );

    expect(refetched).toEqual(new Set());
  });
});

describe("refetchesAfter waits and request identity", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for a reviewsApi invalidation that lands after the write's own promise resolves", async () => {
    answerReads();
    const store = makeReviewsStore();
    // The write resolves at once and invalidates a turn later, as a deferred invalidation would.
    const lateWrite = (dispatch: (action: unknown) => unknown) => {
      setImmediate(() => dispatch(reviewsApi.util.invalidateTags(["Review"])));
    };

    const refetched = await refetchesAfter(
      store,
      { myReviews: reviewApi.endpoints.getMyReviews.initiate() },
      lateWrite,
    );

    expect(refetched).toEqual(new Set(["myReviews"]));
  });

  it("sees a refetch that shares the first request's startedTimeStamp", async () => {
    answerReads();
    // Frozen clock: both requests carry the same millisecond stamp, so only the request id tells them apart.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    server.use(http.patch(`${TEST_BACKEND_URL}/reviews/:id`, () => HttpResponse.json({ id: 7 })));

    const refetched = await refetchesAfter(
      makeReviewsStore(),
      { myReviews: reviewApi.endpoints.getMyReviews.initiate() },
      reviewApi.endpoints.updateReview.initiate({ id: 7, patch: {} }),
    );

    expect(refetched).toEqual(new Set(["myReviews"]));
  });

  it("throws, naming the read, for a read that belongs to another createApi instead of reporting it as not refetched", async () => {
    const otherApi = createApi({
      reducerPath: "otherApi",
      baseQuery: fetchBaseQuery({ baseUrl: TEST_BACKEND_URL }),
      tagTypes: ["Other"],
      endpoints: (build) => ({
        getOther: build.query<unknown, void>({ query: () => "/other", providesTags: ["Other"] }),
      }),
    });
    const store = configureStore({
      reducer: { [reviewsApi.reducerPath]: reviewsApi.reducer, [otherApi.reducerPath]: otherApi.reducer },
      middleware: (gdm) => gdm().concat(reviewsApi.middleware, otherApi.middleware),
    });
    server.use(http.get(`${TEST_BACKEND_URL}/other`, () => HttpResponse.json([])));

    await expect(
      refetchesAfter(
        store,
        { otherRead: otherApi.endpoints.getOther.initiate() },
        otherApi.util.invalidateTags(["Other"]) as never,
      ),
    ).rejects.toThrow(/"otherRead"/);
  });
});
