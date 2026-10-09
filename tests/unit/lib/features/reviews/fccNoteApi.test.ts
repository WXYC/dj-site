import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import { fccNoteApi } from "@/lib/features/reviews/fccNoteApi";
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

describe("fccNoteApi", () => {
  describeApi(fccNoteApi, {
    queries: ["getFccNotes"],
    mutations: ["reportFccNote"],
    reducerPath: "reviewsApi",
  });

  it.each([
    ["album_id", { album_id: 5 }],
    ["intake_item_id", { intake_item_id: 7 }],
  ] as const)("getFccNotes GETs /fcc-notes with %s alone", async (key, arg) => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/fcc-notes`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(fccNoteApi.endpoints.getFccNotes.initiate(arg));

    expect(seen?.pathname).toBe("/fcc-notes");
    expect([...seen!.searchParams.keys()]).toEqual([key]);
  });

  it("reportFccNote POSTs the body and rejects with the whole error nested under fccNoteWriteError", async () => {
    const body = { message: "server words" };
    let sent: unknown;
    server.use(
      http.post(`${TEST_BACKEND_URL}/fcc-notes`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(body, { status: 403 });
      })
    );

    const result = await makeReviewsStore().dispatch(
      fccNoteApi.endpoints.reportFccNote.initiate({ album_id: 5, track: "A2", note: "A word." })
    );

    expect(sent).toEqual({ album_id: 5, track: "A2", note: "A word." });
    expect("error" in result && result.error).toEqual({ fccNoteWriteError: { status: 403, data: body } });
  });
});
