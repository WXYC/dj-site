import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { http, HttpResponse } from "msw";
import type { FlowsheetRangeResponse } from "@wxyc/shared";
import { archiveStreamApi, MAX_WINDOWS_PER_PAGE } from "@/lib/features/archive-stream/api";
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
  it("makes zero /auth/token requests across a full page walk, signed in or out", async () => {
    let tokenRequests = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, () => HttpResponse.json(EMPTY_PAGE)),
      // Answers as a signed-in session would (a real token). `skipAuth`
      // drops the header unconditionally once it is set, so a token being
      // available here is exactly what proves the walk never resolves one --
      // this is the one case that would tell the two behaviors apart.
      http.get(/\/auth\/token$/, () => {
        tokenRequests++;
        return HttpResponse.json({ token: "signed-in-token" });
      })
    );

    const store = archiveStreamStore();
    const result = await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 50 })
    );

    // Confirms the walk actually ran its full 16-window page rather than
    // stopping early for an unrelated reason, so the zero count below means
    // what it claims to mean.
    expect(result.data?.pages[0].reachedStart).toBe(false);
    expect(tokenRequests).toBe(0);
  });

  it("never sends Authorization, because the route is public and skipAuth drops the header unconditionally", async () => {
    let sawAuthorization = false;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, ({ request }) => {
        if (request.headers.has("Authorization")) sawAuthorization = true;
        return HttpResponse.json(EMPTY_PAGE);
      })
    );

    const store = archiveStreamStore();
    await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 50 })
    );

    expect(sawAuthorization).toBe(false);
  });

  it("stops the empty walk at MAX_WINDOWS_PER_PAGE", async () => {
    let requests = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/range`, () => {
        requests++;
        return HttpResponse.json(EMPTY_PAGE);
      })
    );

    const store = archiveStreamStore();
    await store.dispatch(
      archiveStreamApi.endpoints.getArchiveStream.initiate({ pageSize: 50 })
    );

    expect(requests).toBe(MAX_WINDOWS_PER_PAGE);
  });
});
