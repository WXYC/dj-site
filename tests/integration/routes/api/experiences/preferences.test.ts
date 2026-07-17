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

vi.mock("@/lib/features/authentication/server-utils", () => ({
  getServerSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

const SITE_HOST = "dj.wxyc.org";

// Build a request-like object exposing the headers the guard reads and the
// JSON body the preferences handler parses. Defaults to a same-origin,
// authenticated request setting the classic/dark skin.
function makeRequest(
  body: unknown = { experience: "classic", colorMode: "dark" },
  headers: Record<string, string> = {
    host: SITE_HOST,
    origin: `https://${SITE_HOST}`,
  }
): any {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

async function getServerSessionMock() {
  const { getServerSession } = await import(
    "@/lib/features/authentication/server-utils"
  );
  return vi.mocked(getServerSession);
}

describe("POST /api/experiences/preferences", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    (store as any)._reset();
    (await getServerSessionMock()).mockResolvedValue({
      user: { id: "test-user" },
    } as any);
  });

  it("writes the preference on a same-origin authenticated POST", async () => {
    const { POST } = await import("@/app/api/experiences/preferences/route");
    const { cookies } = await import("next/headers");
    const store = await cookies();

    const response = await POST(
      makeRequest({ experience: "classic", colorMode: "dark" })
    );

    expect((response as any).status).toBe(200);
    expect((response as any).body.experience).toBe("classic");
    expect((response as any).body.colorMode).toBe("dark");
    const persisted = JSON.parse(store.get("app_state")!.value);
    expect(persisted.experience).toBe("classic");
    expect(persisted.colorMode).toBe("dark");
  });

  it("rejects an invalid experience with 400", async () => {
    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest({ experience: "space-age", colorMode: "dark" })
    );

    expect((response as any).status).toBe(400);
  });

  it("rejects an invalid color mode with 400", async () => {
    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest({ experience: "classic", colorMode: "ultraviolet" })
    );

    expect((response as any).status).toBe(400);
  });

  it("rejects a cross-origin POST with 403 and does not mutate the cookie", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set({
      name: "app_state",
      value: JSON.stringify({ ...defaultApplicationState, experience: "modern" }),
    });

    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest(
        { experience: "classic", colorMode: "dark" },
        { host: SITE_HOST, origin: "https://evil.example" }
      )
    );

    expect((response as any).status).toBe(403);
    expect(JSON.parse(store.get("app_state")!.value).experience).toBe("modern");
  });

  it("rejects a cross-origin POST via the Referer fallback with 403", async () => {
    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest(
        { experience: "classic", colorMode: "dark" },
        { host: SITE_HOST, referer: "https://evil.example/attack" }
      )
    );

    expect((response as any).status).toBe(403);
  });

  it("rejects a POST with no Origin or Referer with 403 (fail closed)", async () => {
    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest({ experience: "classic", colorMode: "dark" }, { host: SITE_HOST })
    );

    expect((response as any).status).toBe(403);
  });

  it("accepts an unauthenticated same-origin POST (logged-out theme persistence from /login)", async () => {
    (await getServerSessionMock()).mockResolvedValue(null);

    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest({ experience: "modern", colorMode: "dark" })
    );

    expect((response as any).status).toBe(200);
  });

  it("still rejects an unauthenticated CROSS-origin POST with 403", async () => {
    (await getServerSessionMock()).mockResolvedValue(null);

    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest(
        { experience: "modern" },
        { host: SITE_HOST, origin: "https://evil.example" }
      )
    );

    expect((response as any).status).toBe(403);
  });

  it("returns success with defaults, not 500, when app_state is malformed", async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set({ name: "app_state", value: "{not valid json" });

    const { POST } = await import("@/app/api/experiences/preferences/route");
    const response = await POST(
      makeRequest({ experience: "classic", colorMode: "dark" })
    );

    expect((response as any).status).toBe(200);
    expect((response as any).body.experience).toBe("classic");
  });
});
