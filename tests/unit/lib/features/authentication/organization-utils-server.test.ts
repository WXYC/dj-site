import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveOrganizationId } from "@/lib/features/authentication/organization-utils.server";

const mockFetch = vi.fn();
const realFetch = global.fetch;

function fullOrgResponse(body: BodyInit, status = 200) {
  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/organization/get-full-organization")) {
      return Promise.resolve(
        new Response(body, {
          status,
          headers: { "content-type": "application/json" },
        })
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
}

describe("resolveOrganizationId (server)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BETTER_AUTH_URL", "https://api.wxyc.org/auth");
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  it("returns the resolved id from a valid body", async () => {
    fullOrgResponse(JSON.stringify({ id: "org-uuid-1" }));
    await expect(resolveOrganizationId("wxyc")).resolves.toBe("org-uuid-1");
  });

  it("passes the input through when a valid body has no id (input already an ID)", async () => {
    fullOrgResponse(JSON.stringify({}));
    await expect(resolveOrganizationId("org-uuid-2")).resolves.toBe(
      "org-uuid-2"
    );
  });

  it("fails closed to undefined when an ok response body does not parse", async () => {
    fullOrgResponse("<html>gateway error</html>");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveOrganizationId("wxyc")).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });

  it("fails closed to undefined on a non-ok response", async () => {
    fullOrgResponse(JSON.stringify({ code: "NOT_FOUND" }), 404);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveOrganizationId("wxyc")).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
