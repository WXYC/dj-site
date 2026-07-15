import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";

import { flowsheetApi } from "@/lib/features/flowsheet/api";
import { OFF_AIR_LABEL } from "@/lib/features/flowsheet/constants";
import { createTestStore, server, TEST_BACKEND_URL } from "@/lib/test-utils";

// Mock the auth client so the base query's prepareHeaders doesn't try to fetch
// a JWT (no auth server running). Mirrors addToFlowsheet.wiring.test.ts.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

// backendBaseQuery soft-fails non-JSON GETs (gateway interstitials, HTML
// error pages) to `{data: null}` (#606). These transforms must map that to
// a safe empty shape instead of crashing in a converter.
describe("flowsheet transformResponse soft-fail guards (#606)", () => {
  it("getInfiniteEntries resolves to an empty page on a non-JSON body", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/`, () =>
        HttpResponse.text("<html>Bad Gateway</html>")
      )
    );
    const store = createTestStore();
    const result = await store.dispatch(
      flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
        subscribe: false,
      })
    );
    expect(result.status).toBe("fulfilled");
    expect(result.data?.pages[0]).toEqual([]);
  });

  it("whoIsLive resolves to the off-air shape on a non-JSON body", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/djs-on-air`, () =>
        HttpResponse.text("<html>Bad Gateway</html>")
      )
    );
    const store = createTestStore();
    const result = await store.dispatch(
      flowsheetApi.endpoints.whoIsLive.initiate(undefined, {
        subscribe: false,
      })
    );
    expect(result.status).toBe("fulfilled");
    expect(result.data).toEqual({ djs: [], onAir: OFF_AIR_LABEL });
  });
});
