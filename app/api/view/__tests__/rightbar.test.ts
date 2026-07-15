import { describe, it, expect, vi, beforeEach } from "vitest";
import { defaultApplicationState } from "@/lib/features/application/types";

vi.mock("server-only", () => ({}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: (fn: Function) => fn,
  };
});

vi.mock("next/headers", () => {
  let cookieStore: Record<string, string> = {};
  return {
    cookies: vi.fn(async () => ({
      get: (name: string) => {
        const value = cookieStore[name];
        return value ? { name, value } : undefined;
      },
      set: (opts: { name: string; value: string }) => {
        cookieStore[opts.name] = opts.value;
      },
      _reset: () => { cookieStore = {}; },
    })),
  };
});

vi.mock("next/server", () => {
  return {
    NextRequest: class {},
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  };
});

// The guard requires an authenticated session; mock it so tests control that.
vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

const SITE_HOST = "dj.wxyc.org";

// Build a request-like object exposing the headers the guard reads. Defaults to
// a same-origin, authenticated request; override to exercise the guard.
function makeRequest(
  headers: Record<string, string> = {
    host: SITE_HOST,
    origin: `https://${SITE_HOST}`,
  }
): any {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  };
}

async function getServerSessionMock() {
  const { getServerSession } = await import(
    "@/lib/features/authentication/server-utils"
  );
  return vi.mocked(getServerSession);
}

describe("POST /api/view/rightbar (Bug 5)", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    (store as any)._reset();
    (await getServerSessionMock()).mockResolvedValue({
      user: { id: "test-user" },
    } as any);
  });

  it("should return the NEW state after toggling, not the old state", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");

    const response = await POST(makeRequest());
    const body = (response as any).body;

    expect(body.rightBarMini).toBe(!defaultApplicationState.rightBarMini);
  });

  it("should toggle rightBarMini from the current cookie state", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set({
      name: "app_state",
      value: JSON.stringify({ ...defaultApplicationState, rightBarMini: false }),
    });

    const { POST } = await import("@/app/api/view/rightbar/route");

    const response = await POST(makeRequest());
    const body = (response as any).body;

    expect(body.rightBarMini).toBe(true);
  });
});

describe("POST /api/view/rightbar origin/auth guard (#599)", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    (store as any)._reset();
    (await getServerSessionMock()).mockResolvedValue({
      user: { id: "test-user" },
    } as any);
  });

  it("rejects a cross-origin POST with 403 and does not mutate the cookie", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set({
      name: "app_state",
      value: JSON.stringify({ ...defaultApplicationState, rightBarMini: false }),
    });

    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: SITE_HOST, origin: "https://evil.example" })
    );

    expect((response as any).status).toBe(403);
    // Cookie is untouched: the stored value still parses to the original state.
    expect(JSON.parse(store.get("app_state")!.value).rightBarMini).toBe(false);
  });

  it("rejects a POST with no Origin or Referer with 403 (fail closed)", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(makeRequest({ host: SITE_HOST }));

    expect((response as any).status).toBe(403);
  });

  it("allows a same-origin POST via the Referer header when Origin is absent", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: SITE_HOST, referer: `https://${SITE_HOST}/dashboard` })
    );

    expect((response as any).status).toBe(200);
  });

  it("rejects a cross-origin POST via the Referer fallback with 403", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: SITE_HOST, referer: "https://evil.example/attack" })
    );

    expect((response as any).status).toBe(403);
  });

  it("prefers x-forwarded-host over host when a proxy sets it", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({
        "x-forwarded-host": SITE_HOST,
        host: "internal-render-host:8788",
        origin: `https://${SITE_HOST}`,
      })
    );

    expect((response as any).status).toBe(200);
  });

  it("still rejects a cross-origin POST when x-forwarded-host is set", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({
        "x-forwarded-host": SITE_HOST,
        host: "internal-render-host:8788",
        origin: "https://evil.example",
      })
    );

    expect((response as any).status).toBe(403);
  });

  it("uses the first value of a comma-separated x-forwarded-host list", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({
        "x-forwarded-host": `${SITE_HOST}, inner-proxy.internal`,
        host: "internal-render-host:8788",
        origin: `https://${SITE_HOST}`,
      })
    );

    expect((response as any).status).toBe(200);
  });

  it("matches host header ports against the Origin's port", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: "localhost:3000", origin: "http://localhost:3000" })
    );

    expect((response as any).status).toBe(200);
  });

  it("rejects an Origin on a different port of the same hostname with 403", async () => {
    // The port is part of the origin boundary; a hostname-only comparison
    // would wrongly admit any other service on the same machine.
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: "localhost:3000", origin: "http://localhost:8080" })
    );

    expect((response as any).status).toBe(403);
  });

  it("rejects a literal 'Origin: null' (sandboxed iframe) with 403, not 500", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({ host: SITE_HOST, origin: "null" })
    );

    expect((response as any).status).toBe(403);
  });

  it("compares hosts case-insensitively", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(
      makeRequest({
        "x-forwarded-host": SITE_HOST.toUpperCase(),
        origin: `https://${SITE_HOST}`,
      })
    );

    expect((response as any).status).toBe(200);
  });

  it("rejects an unauthenticated same-origin POST with 403", async () => {
    (await getServerSessionMock()).mockResolvedValue(null);

    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(makeRequest());

    expect((response as any).status).toBe(403);
  });
});

describe("POST /api/view/rightbar malformed cookie (#600)", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    (store as any)._reset();
    (await getServerSessionMock()).mockResolvedValue({
      user: { id: "test-user" },
    } as any);
  });

  it("returns success with defaults, not 500, when app_state is malformed", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set({ name: "app_state", value: "{not valid json" });

    const { POST } = await import("@/app/api/view/rightbar/route");
    const response = await POST(makeRequest());

    expect((response as any).status).toBe(200);
    // Falls back to defaults, then toggles rightBarMini off its default.
    expect((response as any).body.rightBarMini).toBe(
      !defaultApplicationState.rightBarMini
    );
  });
});
