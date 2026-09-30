import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import type { FlowsheetRangeResponse } from "@wxyc/shared";
import { archiveStreamApi, MAX_WINDOWS_PER_PAGE } from "@/lib/features/archive-stream/api";
import { clearTokenCache } from "@/lib/features/authentication/client";
import { TEST_BACKEND_URL } from "@/tests/helpers/constants";
import { server } from "@/tests/fakes/server";

// Deliberately does not mock "@/lib/features/authentication/client" -- the
// point of this file is to prove the real getJWTToken() path is never
// entered, not to assert against a stand-in for it.

const EMPTY_PAGE: FlowsheetRangeResponse = { shows: [], entries: [] };

function archiveStreamStore() {
  return configureStore({
    reducer: { [archiveStreamApi.reducerPath]: archiveStreamApi.reducer },
    middleware: (gdm) => gdm().concat(archiveStreamApi.middleware),
  });
}

describe("archiveStreamApi auth-token behavior", () => {
  beforeEach(() => {
    // getJWTToken caches its result at module scope for 4 minutes, so a token
    // resolved by one test would otherwise answer every later test's
    // prepareHeaders call without a request ever reaching /auth/token --
    // each case below needs to prove itself, not inherit the cache state left
    // by whichever case ran first.
    clearTokenCache();
  });

  it.each([
    ["signed out", null],
    ["signed in", "signed-in-token"],
  ])(
    "makes zero /auth/token requests and exactly MAX_WINDOWS_PER_PAGE /flowsheet/range requests for one page, %s",
    async (_label, token) => {
      let tokenRequests = 0;
      let rangeRequests = 0;
      server.use(
        http.get(`${TEST_BACKEND_URL}/flowsheet/range`, () => {
          rangeRequests++;
          return HttpResponse.json(EMPTY_PAGE);
        }),
        http.get(/\/auth\/token$/, () => {
          tokenRequests++;
          return HttpResponse.json({ token });
        })
      );

      const store = archiveStreamStore();
      const result = await store.dispatch(
        archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 50 })
      );

      // Every window came back empty, so a page that ran its full budget
      // reports reachedStart: false with a cursor rather than stopping early
      // for an unrelated reason -- confirming the request counts below cover
      // the whole walk, not a truncated one.
      expect(result.data?.pages[0].reachedStart).toBe(false);
      expect(tokenRequests).toBe(0);
      expect(rangeRequests).toBe(MAX_WINDOWS_PER_PAGE);
    }
  );

  it("never sends Authorization, because the route is public and skipAuth drops the header unconditionally", async () => {
    let sawAuthorization = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
        if (request.headers.has("Authorization")) sawAuthorization = true;
        return HttpResponse.json(EMPTY_PAGE);
      }),
      // Answers with a real token, so a header that slips through has
      // something to carry -- without this, a signed-out default answer of
      // { token: null } would leave the header unset even without skipAuth,
      // and the assertion below would pass for the wrong reason.
      http.get(/\/auth\/token$/, () => HttpResponse.json({ token: "signed-in-token" }))
    );

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 50 })
    );

    expect(result.data?.pages[0].reachedStart).toBe(false);
    expect(sawAuthorization).toBe(false);
  });
});
