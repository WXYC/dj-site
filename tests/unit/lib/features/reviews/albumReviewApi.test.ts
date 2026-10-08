import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { albumReviewApi } from "@/lib/features/reviews/albumReviewApi";
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

describe("albumReviewApi", () => {
  describeApi(albumReviewApi, {
    queries: ["getAlbumReviewsForRelease"],
    reducerPath: "reviewsApi",
  });

  it("getAlbumReviewsForRelease GETs /album-reviews?album_id=5 and unwraps the archive page", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/album-reviews`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ album_reviews: [{ id: 1 }], pagination: {} });
      })
    );

    const result = await makeReviewsStore().dispatch(albumReviewApi.endpoints.getAlbumReviewsForRelease.initiate(5));

    expect(seen?.pathname).toBe("/album-reviews");
    expect(seen?.searchParams.get("album_id")).toBe("5");
    expect(result.data).toEqual([{ id: 1 }]);
  });
});
