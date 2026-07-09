import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Security tests for the `/auth/verify-email` Route Handler (issue #597).
 *
 * The handler forwards the verification token to the backend, then 302s the
 * browser to `callbackURL`. Before the fix, `callbackURL` was resolved with
 * `new URL(callbackURL, request.url)` and handed straight to
 * `NextResponse.redirect` — an absolute (`https://evil.example`) or
 * protocol-relative (`//evil.example`) value overrides the origin entirely,
 * turning the handler into an open redirect that ALSO forwards the
 * freshly-minted session cookie off-site. These tests pin that `callbackURL`
 * is constrained to a same-origin relative path, falling back to `/onboarding`.
 *
 * Harness mirrors app/auth/[...path]/__tests__/route.test.ts: direct import of
 * the handler + a `global.fetch` spy standing in for the backend.
 */

const FRONTEND_ORIGIN = "https://dj.wxyc.org";

// Backend response that "auto-signed-in" the user: carries a session cookie, so
// the handler takes the callbackURL branch (the vulnerable one).
function backendSessionResponse(): Response {
  const headers = new Headers();
  headers.append(
    "set-cookie",
    "__Secure-better-auth.session_token=abc.sig; Path=/; HttpOnly; Secure; SameSite=Lax",
  );
  return new Response(null, { status: 302, headers });
}

// Backend response with no session cookie: handler falls back to /login.
function backendNoSessionResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function verifyEmailRequest(callbackURL: string | null): NextRequest {
  const url = new URL(`${FRONTEND_ORIGIN}/auth/verify-email`);
  url.searchParams.set("token", "valid-token");
  if (callbackURL !== null) url.searchParams.set("callbackURL", callbackURL);
  return new NextRequest(url);
}

async function invoke(callbackURL: string | null): Promise<Response> {
  const { GET } = await import("@/app/auth/verify-email/route");
  return GET(verifyEmailRequest(callbackURL));
}

describe("/auth/verify-email open-redirect protection (#597)", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("coerces an absolute off-origin callbackURL to the safe default", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("https://evil.example/dj-signin");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/onboarding");
  });

  it("rejects a protocol-relative callbackURL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("//evil.example");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/onboarding");
  });

  it("rejects a backslash-escaped callbackURL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("/\\evil.example");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/onboarding");
  });

  it("rejects an encoded-slash callbackURL that normalises to off-origin", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("/%2F%2Fevil.example");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
  });

  it("honors a legitimate same-origin relative callbackURL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("/dashboard/flowsheet");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/dashboard/flowsheet");
  });

  it("preserves query and hash on a legitimate relative callbackURL", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke("/dashboard/flowsheet?tab=queue#now");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/dashboard/flowsheet");
    expect(location.search).toBe("?tab=queue");
    expect(location.hash).toBe("#now");
  });

  it("falls back to /onboarding when callbackURL is absent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendSessionResponse());

    const response = await invoke(null);
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/onboarding");
  });

  it("does not forward an unsafe callbackURL upstream to the backend", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(backendSessionResponse());

    await invoke("https://evil.example/dj-signin");

    const forwarded = String(fetchMock.mock.calls[0][0]);
    expect(forwarded).not.toContain("evil.example");
  });

  it("ignores callbackURL entirely on the no-session branch", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(backendNoSessionResponse());

    const response = await invoke("https://evil.example/dj-signin");
    const location = new URL(response.headers.get("location")!);

    expect(location.origin).toBe(FRONTEND_ORIGIN);
    expect(location.pathname).toBe("/login");
    expect(location.search).toBe("?verified=true");
  });
});
