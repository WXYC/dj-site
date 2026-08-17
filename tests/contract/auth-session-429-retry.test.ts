import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fakes/server";

vi.mock("server-only", () => ({}));

// Real react cache() outside a render is a pass-through, so this identity
// mock changes nothing observable for the single call this test makes — it
// mirrors the convention in session-cache.test.ts / server-session.test.ts
// rather than relying on that pass-through behavior holding forever.
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});

const AUTH_BASE_URL = "http://localhost:8082/auth";

/**
 * getSessionCached's transport retry is written around the `.catch` of a
 * REJECTED fetch. The tripwire this guards: `@better-fetch/fetch` does not
 * throw on an HTTP error status today, so a 429 resolves rather than
 * rejects, and the retry never sees it. If a future better-auth /
 * @better-fetch/fetch bump ever sets `throw` (or `catchAllError`) and starts
 * turning HTTP errors into rejections, this retry would start firing on
 * every rate-limited read — doubling load against a service that is already
 * rate-limiting the caller, which is exactly what the retry is written to
 * exclude.
 *
 * A mocked `getSession` can't catch that regression: it can only ever
 * resolve the shape the mock is told to, so it pins our own branching
 * against a shape we hand ourselves rather than against the client's actual
 * wire contract. This drives a real 429 through the real better-auth client
 * and @better-fetch/fetch (via MSW, no live network) and asserts on the
 * request count the retry would have doubled.
 */
describe("session read against a real 429 (auth-client wire contract)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, AUTH_REWRITE_URL: AUTH_BASE_URL };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("makes exactly one request for a resolved 429 — the retry must not fire on a non-throwing HTTP error", async () => {
    let requestCount = 0;
    server.use(
      http.get(`${AUTH_BASE_URL}/get-session`, () => {
        requestCount += 1;
        return HttpResponse.json(
          { message: "Too many requests. Please try again later." },
          { status: 429 }
        );
      })
    );

    vi.resetModules();
    const { getSessionCached } = await import(
      "@/lib/features/authentication/session-cache"
    );
    const { classifySessionRead } = await import(
      "@/lib/features/authentication/utilities"
    );

    const result = await getSessionCached("session=real-429-cookie");

    expect(requestCount).toBe(1);
    expect(classifySessionRead(result).kind).toBe("unavailable");
  });
});
