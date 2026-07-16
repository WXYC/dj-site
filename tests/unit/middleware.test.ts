import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";

function requestWithCookie(pathname: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`http://localhost${pathname}`), { headers });
}

describe("middleware (admin RBAC edge gate, #909)", () => {
  it("scopes the matcher tightly to /dashboard/admin", () => {
    expect(config.matcher).toEqual(["/dashboard/admin/:path*"]);
  });

  it("denies an unauthenticated admin request with an atomic 307 to login", () => {
    const res = middleware(requestWithCookie("/dashboard/admin/roster"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("bounced=no-session");
  });

  it("passes an authenticated request through (role check stays server-side)", () => {
    const res = middleware(
      requestWithCookie("/dashboard/admin/roster", "better-auth.session_token=abc.def")
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
