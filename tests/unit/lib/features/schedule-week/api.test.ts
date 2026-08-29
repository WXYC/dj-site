import { describe, it, expect, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import {
  scheduleWeekApi,
  useGetFlowsheetRangeQuery,
} from "@/lib/features/schedule-week/api";
import { describeApi, server, TEST_BACKEND_URL } from "@/tests/helpers";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function scheduleWeekStore() {
  return configureStore({
    reducer: { [scheduleWeekApi.reducerPath]: scheduleWeekApi.reducer },
    middleware: (gdm) => gdm().concat(scheduleWeekApi.middleware),
  });
}

const WINDOW = { startMs: 1_755_921_600_000, endMs: 1_756_526_400_000 };

describe("scheduleWeekApi", () => {
  describeApi(scheduleWeekApi, {
    queries: ["getFlowsheetRange"],
    reducerPath: "scheduleWeekApi",
  });

  it("exports the useGetFlowsheetRangeQuery hook", () => {
    expect(typeof useGetFlowsheetRangeQuery).toBe("function");
  });

  it("asks /flowsheet/range for the window as integer epoch milliseconds", async () => {
    let requested: URL | undefined;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
        requested = new URL(request.url);
        return HttpResponse.json({ shows: [], entries: [] });
      }),
    );

    const store = scheduleWeekStore();
    await store.dispatch(
      scheduleWeekApi.endpoints.getFlowsheetRange.initiate(WINDOW),
    );

    expect(requested?.pathname).toBe("/flowsheet/range");
    // ISO strings are rejected by the endpoint; these must be bare integers.
    expect(requested?.searchParams.get("start")).toBe(String(WINDOW.startMs));
    expect(requested?.searchParams.get("end")).toBe(String(WINDOW.endMs));
    expect(requested?.searchParams.get("start")).toMatch(/^\d+$/);
    expect(requested?.searchParams.get("end")).toMatch(/^\d+$/);
  });

  it("returns an empty week rather than throwing when the body is unparseable", async () => {
    // The shared base query soft-fails a non-JSON body to a successful null
    // payload, so a transform that assumes an object throws on exactly the
    // responses the soft-fail exists to absorb.
    server.use(
      http.get(
        `${TEST_BACKEND_URL}/flowsheet/range`,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = scheduleWeekStore();
    const result = await store.dispatch(
      scheduleWeekApi.endpoints.getFlowsheetRange.initiate(WINDOW),
    );

    expect(result.isError).toBeFalsy();
    expect(result.data).toEqual({ shows: [], entries: [] });
  });

  it("passes a populated week through untouched", async () => {
    const week = {
      shows: [
        {
          id: 1951179,
          show_name: null,
          dj_name: "DJ Chowder",
          specialty_id: null,
          start_time: "2026-08-23T00:36:05.339Z",
          end_time: "2026-08-23T04:01:55.370Z",
        },
      ],
      entries: [],
    };
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, () =>
        HttpResponse.json(week),
      ),
    );

    const store = scheduleWeekStore();
    const result = await store.dispatch(
      scheduleWeekApi.endpoints.getFlowsheetRange.initiate(WINDOW),
    );

    expect(result.data).toEqual(week);
  });
});
