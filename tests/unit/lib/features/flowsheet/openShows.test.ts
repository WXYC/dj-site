import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import type { OpenShowsResult } from "@/lib/features/flowsheet/types";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";

// Mock the auth client so the base query's prepareHeaders doesn't try to fetch
// a JWT (no auth server running). Mirrors addToFlowsheet.wiring.test.ts.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const EMPTY_RESULT: OpenShowsResult = {
  shows: [],
  total_in_window: 0,
  older_open_show_count: 0,
};

const openShow = (overrides: Partial<OpenShowsResult["shows"][number]> = {}) => ({
  id: 1951317,
  primary_dj_id: "qtWadNiQ30Gemtx1EQAGSs402Eo0BTWq",
  dj_name: "DJ Biscuit",
  show_name: null,
  start_time: "2026-09-07T23:07:14.009Z",
  legacy_show_id: null,
  entry_count: 206,
  is_current: true,
  likely_abandoned: false,
  ...overrides,
});

describe("getOpenShows", () => {
  it("sends no window params by default, deferring to the backend's window", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(EMPTY_RESULT);
      })
    );
    const store = createTestStore();

    const result = await store.dispatch(
      flowsheetApi.endpoints.getOpenShows.initiate({})
    );

    expect(result.data).toEqual(EMPTY_RESULT);
    expect(requestedUrl?.searchParams.has("window_hours")).toBe(false);
    expect(requestedUrl?.searchParams.has("limit")).toBe(false);
  });

  it("carries the widened window through as query params", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json(EMPTY_RESULT);
      })
    );
    const store = createTestStore();

    await store.dispatch(
      flowsheetApi.endpoints.getOpenShows.initiate({
        windowHours: 262800,
        limit: 500,
      })
    );

    expect(requestedUrl?.searchParams.get("window_hours")).toBe("262800");
    expect(requestedUrl?.searchParams.get("limit")).toBe("500");
  });

  // The soft-fail contract turns a non-JSON body into a successful
  // `{ data: null }`; this endpoint opts out, because "no open shows" while
  // the backend is down would tell an operator the cleanup is done.
  it("surfaces a non-JSON body as an error, never as an empty success", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () =>
        HttpResponse.html("<!DOCTYPE html><html><body>404</body></html>", {
          status: 404,
        })
      )
    );
    const store = createTestStore();

    const result = await store.dispatch(
      flowsheetApi.endpoints.getOpenShows.initiate({})
    );

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });
});

describe("forceEndShow", () => {
  it("posts to the show's force-end route without ?force by default", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.post(
        `${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`,
        ({ request }) => {
          requestedUrl = new URL(request.url);
          return HttpResponse.json({ id: 1951200, end_time: "2026-09-01T00:00:00Z" });
        }
      )
    );
    const store = createTestStore();

    const result = await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({ showId: 1951200 })
    );

    expect("data" in result).toBe(true);
    expect(requestedUrl?.pathname.endsWith("/flowsheet/shows/1951200/force-end")).toBe(true);
    expect(requestedUrl?.searchParams.has("force")).toBe(false);
  });

  it("sends ?force=true only when asked to", async () => {
    let requestedUrl: URL | undefined;
    server.use(
      http.post(
        `${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`,
        ({ request }) => {
          requestedUrl = new URL(request.url);
          return HttpResponse.json({ id: 1951317, end_time: "2026-09-08T19:15:20Z" });
        }
      )
    );
    const store = createTestStore();

    await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({
        showId: 1951317,
        force: true,
      })
    );

    expect(requestedUrl?.searchParams.get("force")).toBe("true");
  });

  it("wraps its rejection so the shared error middleware has no message to toast", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`, () =>
        HttpResponse.json(
          { message: "Bad Request: show is already ended" },
          { status: 400 }
        )
      )
    );
    const store = createTestStore();

    const result = await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({ showId: 1951200 })
    );

    expect("error" in result && result.error).toMatchObject({
      forceEndShowError: {
        status: 400,
        data: { message: "Bad Request: show is already ended" },
      },
    });
  });

  it("refetches an active open-shows subscription on success", async () => {
    let listFetches = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () => {
        listFetches += 1;
        return HttpResponse.json({
          shows: [openShow()],
          total_in_window: 1,
          older_open_show_count: 0,
        });
      }),
      http.post(`${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`, () =>
        HttpResponse.json({ id: 1951317, end_time: "2026-09-08T19:15:20Z" })
      )
    );
    const store = createTestStore();

    const subscription = store.dispatch(
      flowsheetApi.endpoints.getOpenShows.initiate({})
    );
    await subscription;
    expect(listFetches).toBe(1);

    await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({
        showId: 1951317,
        force: true,
      })
    );
    await vi.waitFor(() => expect(listFetches).toBe(2));

    subscription.unsubscribe();
  });

  // The status lives one level down after transformErrorResponse, so a tag
  // mapping that reads it off the raw error argument finds undefined and
  // falls into the invalidate-everything branch — refetching the live entries
  // feed on a refusal that changed nothing. This is the regression test for
  // that unwrap.
  it("does not refetch the live flowsheet on a 409 refusal", async () => {
    let entriesFetches = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () => {
        entriesFetches += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () =>
        HttpResponse.json(EMPTY_RESULT)
      ),
      http.post(`${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`, () =>
        HttpResponse.json(
          {
            message:
              "Conflict: this is the current on-air show. Re-send with ?force=true to end it anyway.",
          },
          { status: 409 }
        )
      )
    );
    const store = createTestStore();

    const entriesSub = store.dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined)
    );
    await entriesSub;
    expect(entriesFetches).toBe(1);

    await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({ showId: 1951317 })
    );
    // Deliberate settle window: an invalidation-triggered refetch would have
    // been dispatched synchronously with the rejection landing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(entriesFetches).toBe(1);

    entriesSub.unsubscribe();
  });

  it("refetches only the open-shows list on the benign already-ended 400", async () => {
    let listFetches = 0;
    let entriesFetches = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () => {
        entriesFetches += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${TEST_BACKEND_URL}/flowsheet/open-shows`, () => {
        listFetches += 1;
        return HttpResponse.json(EMPTY_RESULT);
      }),
      http.post(`${TEST_BACKEND_URL}/flowsheet/shows/:id/force-end`, () =>
        HttpResponse.json(
          { message: "Bad Request: show is already ended" },
          { status: 400 }
        )
      )
    );
    const store = createTestStore();

    const listSub = store.dispatch(
      flowsheetApi.endpoints.getOpenShows.initiate({})
    );
    const entriesSub = store.dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined)
    );
    await Promise.all([listSub, entriesSub]);

    await store.dispatch(
      flowsheetApi.endpoints.forceEndShow.initiate({ showId: 1951200 })
    );
    await vi.waitFor(() => expect(listFetches).toBe(2));
    expect(entriesFetches).toBe(1);

    listSub.unsubscribe();
    entriesSub.unsubscribe();
  });
});
