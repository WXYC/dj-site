import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockGetServerJwtToken = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  getServerJwtToken: (cookie?: string) => mockGetServerJwtToken(cookie),
}));

import { NO_FEATURE_ACCESS, getReviewsAccess } from "@/lib/features/feature-access.server";

const BACKEND_URL = "http://backend.test";
const COOKIE = "session=test-cookie";

const answer = (status: number, body: unknown) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

const reviews = (audience: string, can_see: unknown) => ({ reviews: { audience, can_see } });

describe("getReviewsAccess", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND_URL;
    mockCookies.mockReturnValue({ toString: () => COOKIE });
    mockGetServerJwtToken.mockResolvedValue("jwt-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it.each([
    ["everyone, can see", reviews("everyone", true), { audience: "everyone", can_see: true }],
    ["staff, can see", reviews("staff", true), { audience: "staff", can_see: true }],
    ["staff, cannot see", reviews("staff", false), { audience: "staff", can_see: false }],
    ["off, cannot see", reviews("off", false), { audience: "off", can_see: false }],
  ])("passes the Backend's answer through: %s", async (_label, body, expected) => {
    vi.stubGlobal("fetch", answer(200, body));

    await expect(getReviewsAccess()).resolves.toEqual(expected);
  });

  it.each([
    ["a 401", () => answer(401, { message: "unauthorized" })],
    ["a 500", () => answer(500, { message: "boom" })],
    ["a body that is not JSON", () => answer(200, "<html>bad gateway</html>")],
    ["an empty body", () => answer(200, "")],
    ["a body without reviews", () => answer(200, {})],
    ["an audience the DJ site does not know", () => answer(200, reviews("nobody", true))],
    ["a can_see that is not a boolean", () => answer(200, reviews("everyone", "yes"))],
    ["a request that times out", () => vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); })],
    ["a network failure", () => vi.fn(async () => { throw new TypeError("fetch failed"); })],
  ])("is no access, audience off, on %s", async (_label, makeFetch) => {
    vi.stubGlobal("fetch", makeFetch());

    await expect(getReviewsAccess()).resolves.toEqual(NO_FEATURE_ACCESS);
    expect(NO_FEATURE_ACCESS).toEqual({ audience: "off", can_see: false });
  });

  it("is no access, and asks the Backend nothing, when no token can be minted", async () => {
    mockGetServerJwtToken.mockResolvedValue(null);
    const fetchMock = answer(200, reviews("everyone", true));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getReviewsAccess()).resolves.toEqual(NO_FEATURE_ACCESS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is no access when the Backend URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    vi.stubGlobal("fetch", answer(200, reviews("everyone", true)));

    await expect(getReviewsAccess()).resolves.toEqual(NO_FEATURE_ACCESS);
  });

  it("sends the minted bearer to /feature-access without caching it", async () => {
    const fetchMock = answer(200, reviews("everyone", true));
    vi.stubGlobal("fetch", fetchMock);

    await getReviewsAccess();

    expect(mockGetServerJwtToken).toHaveBeenCalledWith(COOKIE);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BACKEND_URL}/feature-access`);
    expect(init.headers).toMatchObject({ Authorization: "Bearer jwt-token" });
    expect(init.cache).toBe("no-store");
  });
});
