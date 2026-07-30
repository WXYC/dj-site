import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetServerJwtToken = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  getServerJwtToken: (cookieHeader?: string) =>
    mockGetServerJwtToken(cookieHeader),
}));

import {
  resolveLegacyReleaseId,
  albumSerialPath,
} from "@/lib/features/catalog/legacy-permalink.server";

const BACKEND = "http://backend.test";
const COOKIE = "session=test-cookie";
const VALID_LEGACY = "65880";
const SERIAL = 7100;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const realFetch = global.fetch;
let mockFetch: ReturnType<typeof vi.fn>;

describe("resolveLegacyReleaseId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", BACKEND);
    mockGetServerJwtToken.mockResolvedValue("jwt-token");
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
    vi.unstubAllEnvs();
  });

  it("resolves a 200 response to the serial in the body's id", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: SERIAL, album_title: "Confield" }));

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "resolved",
      serial: SERIAL,
    });
  });

  it("calls /library/info with the legacy_release_id and a bearer token", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: SERIAL }));

    await resolveLegacyReleaseId(VALID_LEGACY, COOKIE);

    expect(mockGetServerJwtToken).toHaveBeenCalledWith(COOKIE);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(`${BACKEND}/library/info?legacy_release_id=${VALID_LEGACY}`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-token");
    expect(init.cache).toBe("no-store");
  });

  it("maps a 404 (no catalog row) to not-found", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ message: "No catalog album for that legacy_release_id" }, 404),
    );

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
  });

  it("maps a 400 (bad id) to not-found", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "Invalid legacy_release_id" }, 400));

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
  });

  it("maps a 5xx to not-found", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "boom" }, 503));

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
  });

  it("maps a network failure to not-found", async () => {
    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
  });

  it.each([
    ["a non-number id", { id: "not-a-number" }],
    ["a zero id", { id: 0 }],
    ["a negative id", { id: -3 }],
    ["a missing id", { album_title: "Confield" }],
  ])("treats a 200 body with %s as not-found", async (_label, body) => {
    mockFetch.mockResolvedValue(jsonResponse(body));

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
  });

  it.each([["not-a-number"], ["0"], ["-5"], ["65880xyz"], [""]])(
    "rejects an invalid legacy id (%s) without a network call",
    async (bad) => {
      await expect(resolveLegacyReleaseId(bad, COOKIE)).resolves.toEqual({
        status: "not-found",
      });
      expect(mockGetServerJwtToken).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("returns not-found without fetching when no bearer token can be minted", async () => {
    mockGetServerJwtToken.mockResolvedValue(null);

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns not-found when NEXT_PUBLIC_BACKEND_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");

    await expect(resolveLegacyReleaseId(VALID_LEGACY, COOKIE)).resolves.toEqual({
      status: "not-found",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("albumSerialPath", () => {
  it("builds the canonical serial-keyed album route", () => {
    expect(albumSerialPath(SERIAL)).toBe("/dashboard/album/7100");
  });
});
