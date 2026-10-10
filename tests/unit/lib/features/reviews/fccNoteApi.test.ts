import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { configureStore } from "@reduxjs/toolkit";
import { reviewsApi } from "@/lib/features/reviews/api";
import {
  fccNoteApi,
  isFccNoteAccountRemoved,
  isFccNoteGone,
  isFccNoteInvalid,
  isFccNoteTakeBackRefused,
} from "@/lib/features/reviews/fccNoteApi";
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
    queries: ["getFccNotes", "getFccNotesToConfirm"],
    mutations: ["reportFccNote", "confirmFccNote", "deleteFccNote"],
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

  it("getFccNotesToConfirm sends status=reported and no subject", async () => {
    let seen: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/fcc-notes`, ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await makeReviewsStore().dispatch(fccNoteApi.endpoints.getFccNotesToConfirm.initiate());

    expect([...seen!.searchParams.entries()]).toEqual([["status", "reported"]]);
  });

  it.each([
    ["confirmFccNote", "POST", "/fcc-notes/4/confirm"],
    ["deleteFccNote", "DELETE", "/fcc-notes/4"],
  ] as const)("%s sends %s %s, nested under fccNoteWriteError when refused", async (name, method, path) => {
    let seen: { method: string; pathname: string } | undefined;
    server.use(
      http.all(`${TEST_BACKEND_URL}${path}`, ({ request }) => {
        seen = { method: request.method, pathname: new URL(request.url).pathname };
        return HttpResponse.json({ message: "no" }, { status: 404 });
      })
    );

    const result = await makeReviewsStore().dispatch(fccNoteApi.endpoints[name].initiate(4));

    expect(seen).toEqual({ method, pathname: path });
    expect("error" in result && result.error).toEqual({ fccNoteWriteError: { status: 404, data: { message: "no" } } });
  });

  it.each(["confirmFccNote", "deleteFccNote"] as const)(
    "%s refreshes the waiting list and both subjects' panels, even when refused",
    async (name) => {
      const reads: string[] = [];
      server.use(
        http.get(`${TEST_BACKEND_URL}/fcc-notes`, ({ request }) => {
          reads.push(new URL(request.url).searchParams.toString());
          return HttpResponse.json([]);
        }),
        http.all(`${TEST_BACKEND_URL}/fcc-notes/4*`, () => HttpResponse.json({}, { status: 403 }))
      );
      const store = makeReviewsStore();
      await Promise.all([
        store.dispatch(fccNoteApi.endpoints.getFccNotes.initiate({ album_id: 5 })),
        store.dispatch(fccNoteApi.endpoints.getFccNotes.initiate({ intake_item_id: 7 })),
        store.dispatch(fccNoteApi.endpoints.getFccNotesToConfirm.initiate()),
      ]);
      reads.length = 0;

      await store.dispatch(fccNoteApi.endpoints[name].initiate(4));

      await vi.waitFor(() => expect([...reads].sort()).toEqual(["album_id=5", "intake_item_id=7", "status=reported"]));
    }
  );

  // Every predicate is status-only: none of these bodies carries a `reason`.
  it.each([
    [isFccNoteInvalid, 400],
    [isFccNoteAccountRemoved, 403],
    [isFccNoteTakeBackRefused, 403],
    [isFccNoteGone, 404],
  ] as const)("%o is true for status %i alone", (predicate, status) => {
    for (const other of [400, 403, 404, 409, 500]) {
      expect(predicate({ fccNoteWriteError: { status: other, data: {} } })).toBe(other === status);
    }
  });
});
