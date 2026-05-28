import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import {
  createTestStore,
  createTestV2TrackEntry,
  server,
  TEST_BACKEND_URL,
} from "@/lib/test-utils";

// Mock the auth client so the RTK Query base query's `prepareHeaders` doesn't
// try to fetch a JWT during the test (no auth server running).
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

// Mock the deferred-refetch helper so the test asserts the mutation calls
// it on success. The implementation of the helper is unit-tested in
// `deferred-refetch.test.ts`.
vi.mock("@/lib/features/flowsheet/deferred-refetch", () => ({
  scheduleDeferredFlowsheetRefetch: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { scheduleDeferredFlowsheetRefetch } from "@/lib/features/flowsheet/deferred-refetch";

const mockedScheduleDeferred = vi.mocked(scheduleDeferredFlowsheetRefetch);

describe("addToFlowsheet — wiring of deferred metadata refetch (#476)", () => {
  beforeEach(() => {
    mockedScheduleDeferred.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls scheduleDeferredFlowsheetRefetch with the new entry's id after a successful add", async () => {
    const serverEntry = createTestV2TrackEntry({
      id: 12345,
      artist_name: "Juana Molina",
      album_title: "DOGA",
      track_title: "la paradoja",
    });
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json(serverEntry)
      )
    );

    const store = createTestStore();
    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "Juana Molina",
          album_title: "DOGA",
          track_title: "la paradoja",
          record_label: "Sonamos",
          request_flag: false,
        })
      )
      .unwrap();

    expect(mockedScheduleDeferred).toHaveBeenCalledTimes(1);
    const [, entryId] = mockedScheduleDeferred.mock.calls[0];
    expect(entryId).toBe(12345);
  });

  it("does NOT call scheduleDeferredFlowsheetRefetch when the mutation fails", async () => {
    server.use(
      http.post(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.json({ error: "active show required" }, { status: 400 })
      )
    );

    const store = createTestStore();
    await store
      .dispatch(
        flowsheetApi.endpoints.addToFlowsheet.initiate({
          artist_name: "Jessica Pratt",
          album_title: "On Your Own Love Again",
          track_title: "Back, Baby",
          record_label: "Drag City",
          request_flag: false,
        })
      )
      // The mutation rejects on non-2xx; .unwrap() throws, which we swallow
      // because we're testing the failure-path behavior, not the rejection.
      .unwrap()
      .catch(() => undefined);

    expect(mockedScheduleDeferred).not.toHaveBeenCalled();
  });
});
