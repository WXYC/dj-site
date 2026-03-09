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

describe("POST /api/view/rightbar (Bug 5)", () => {
  beforeEach(async () => {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    (store as any)._reset();
  });

  it("should return the NEW state after toggling, not the old state", async () => {
    const { POST } = await import("@/app/api/view/rightbar/route");

    const response = await POST({} as any);
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

    const response = await POST({} as any);
    const body = (response as any).body;

    expect(body.rightBarMini).toBe(true);
  });
});
