import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for the `/auth/[...path]` reverse-proxy Route Handler.
 *
 * This handler replaces the `next.config.mjs` `/auth/:path*` rewrite, which on
 * the OpenNext/Cloudflare Workers runtime folds multiple `Set-Cookie` response
 * headers into one (opennextjs-cloudflare#501). Folding drops all but the last
 * cookie, which breaks better-auth flows that emit several cookies at once:
 *   - sign-out (session_token + session_data + dont_remember deletions)
 *   - re-login while a stale cookie is present (session_token SET is dropped)
 *
 * These tests pin the handler's *forwarding logic* against a mocked upstream:
 * path/query reconstruction, request-header hygiene, method/body handling,
 * response fidelity, base-URL resolution, and that it emits each `Set-Cookie`
 * as a separate header. They cannot reproduce the Cloudflare fold — Node/undici
 * never folds, so a naive header copy would pass these too. The authoritative
 * proof that multiple `Set-Cookie` survive the OpenNext/Cloudflare runtime is
 * the wrangler/preview edge check, not this suite.
 */

const AUTH_COOKIE_DELETIONS = [
  "__Secure-better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  "__Secure-better-auth.session_data=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
  "__Secure-better-auth.dont_remember=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax",
];

function upstreamResponseWithCookies(cookies: string[]): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response("null", { status: 200, headers });
}

describe("/auth/[...path] reverse proxy", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Deterministic base URL: with neither override set the handler falls back
    // to the production default (https://api.wxyc.org/auth).
    process.env = { ...originalEnv };
    delete process.env.AUTH_REWRITE_URL;
    delete process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("preserves every Set-Cookie header from the upstream auth service", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      upstreamResponseWithCookies(AUTH_COOKIE_DELETIONS),
    );

    const { POST } = await import("@/app/auth/[...path]/route");
    const request = new Request("https://dj.wxyc.org/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const response = await POST(request, {
      params: Promise.resolve({ path: ["sign-out"] }),
    });

    expect(response.headers.getSetCookie()).toEqual(AUTH_COOKIE_DELETIONS);
  });

  it("forwards method, reconstructed path, query, cookies and body upstream", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { POST } = await import("@/app/auth/[...path]/route");
    const request = new Request(
      "https://dj.wxyc.org/auth/sign-in/username?disableCookieCache=true",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "__Secure-better-auth.session_token=stale.signature",
        },
        body: JSON.stringify({ username: "jake", password: "hunter2" }),
      },
    );

    await POST(request, {
      params: Promise.resolve({ path: ["sign-in", "username"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://api.wxyc.org/auth/sign-in/username?disableCookieCache=true",
    );
    expect(init?.method).toBe("POST");

    const forwarded = new Headers(init?.headers as HeadersInit);
    expect(forwarded.get("cookie")).toBe(
      "__Secure-better-auth.session_token=stale.signature",
    );

    const forwardedBody = new TextDecoder().decode(init?.body as ArrayBuffer);
    expect(JSON.parse(forwardedBody)).toEqual({
      username: "jake",
      password: "hunter2",
    });
  });

  it("passes the upstream status, body and non-cookie headers through unchanged", async () => {
    const upstreamHeaders = new Headers({
      "content-type": "application/json",
      location: "/login?verified=true",
      "x-better-auth": "signal",
    });
    upstreamHeaders.append("set-cookie", "session_token=abc; Path=/");
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response('{"redirect":true}', {
        status: 302,
        headers: upstreamHeaders,
      }),
    );

    const { GET } = await import("@/app/auth/[...path]/route");
    const request = new Request("https://dj.wxyc.org/auth/get-session", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ path: ["get-session"] }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?verified=true");
    expect(response.headers.get("x-better-auth")).toBe("signal");
    expect(await response.text()).toBe('{"redirect":true}');
  });

  it("does not forward a request body for GET", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { GET } = await import("@/app/auth/[...path]/route");
    const request = new Request("https://dj.wxyc.org/auth/get-session", {
      method: "GET",
    });

    await GET(request, {
      params: Promise.resolve({ path: ["get-session"] }),
    });

    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("leaves the response with no Set-Cookie when the upstream sets none", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { GET } = await import("@/app/auth/[...path]/route");
    const response = await GET(
      new Request("https://dj.wxyc.org/auth/get-session", { method: "GET" }),
      { params: Promise.resolve({ path: ["get-session"] }) },
    );

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("proxies a HEAD request without a body", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const { HEAD } = await import("@/app/auth/[...path]/route");
    await HEAD(new Request("https://dj.wxyc.org/auth/ok", { method: "HEAD" }), {
      params: Promise.resolve({ path: ["ok"] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
    expect(fetchMock.mock.calls[0][1]?.body).toBeUndefined();
  });

  it("forces an identity accept-encoding upstream", async () => {
    // The handler pins `accept-encoding: identity` so the upstream body is never
    // compressed — undici (Node: `next dev` / E2E) would otherwise decompress it
    // while leaving a stale content-encoding header, corrupting the passthrough.
    // (Cookie forwarding is covered by the forwarding test above; hop-by-hop /
    // `host` stripping is forbidden-header handling this Request layer can't
    // reliably represent.)
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { POST } = await import("@/app/auth/[...path]/route");
    await POST(
      new Request("https://dj.wxyc.org/auth/sign-out", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["sign-out"] }) },
    );

    const forwarded = new Headers(
      fetchMock.mock.calls[0][1]?.headers as HeadersInit,
    );
    expect(forwarded.get("accept-encoding")).toBe("identity");
  });

  it("returns 404 without proxying when a path segment escapes the /auth prefix", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    const { GET } = await import("@/app/auth/[...path]/route");
    const response = await GET(
      new Request("https://dj.wxyc.org/auth/..%2Fadmin", { method: "GET" }),
      { params: Promise.resolve({ path: ["..", "admin", "users"] }) },
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies under a path-less base URL without a false traversal 404", async () => {
    // A base with no path (pathname "/") has no prefix to protect, so the
    // traversal guard must not reject ordinary requests against it.
    process.env.AUTH_REWRITE_URL = "https://api.wxyc.org";
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { GET } = await import("@/app/auth/[...path]/route");
    const response = await GET(
      new Request("https://dj.wxyc.org/auth/get-session", { method: "GET" }),
      { params: Promise.resolve({ path: ["get-session"] }) },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.wxyc.org/get-session",
    );
  });

  // Base-URL resolution migrated from the removed next.config.mjs `/auth`
  // rewrite (see lib/__tests__/next.config.test.ts before this change).
  it("targets AUTH_REWRITE_URL when set, overriding NEXT_PUBLIC_BETTER_AUTH_URL", async () => {
    process.env.AUTH_REWRITE_URL = "http://auth:8082/auth";
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "http://localhost:8082/auth";
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { POST } = await import("@/app/auth/[...path]/route");
    await POST(
      new Request("https://dj.wxyc.org/auth/sign-in/username", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ path: ["sign-in", "username"] }) },
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://auth:8082/auth/sign-in/username",
    );
  });

  it("falls back to NEXT_PUBLIC_BETTER_AUTH_URL when AUTH_REWRITE_URL is unset", async () => {
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "http://localhost:8082/auth";
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("null", { status: 200 }));

    const { GET } = await import("@/app/auth/[...path]/route");
    await GET(
      new Request("https://dj.wxyc.org/auth/jwks", { method: "GET" }),
      { params: Promise.resolve({ path: ["jwks"] }) },
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:8082/auth/jwks",
    );
  });
});
