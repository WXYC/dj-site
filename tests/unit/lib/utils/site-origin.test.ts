import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: mockGet })),
}));

import { getSiteOrigin } from "@/lib/utils/site-origin";

describe("getSiteOrigin", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("prefers x-forwarded-host and x-forwarded-proto over host", async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === "x-forwarded-host") return "dj.wxyc.org, internal.local";
      if (name === "x-forwarded-proto") return "https";
      if (name === "host") return "internal.local:8080";
      return null;
    });

    await expect(getSiteOrigin()).resolves.toBe("https://dj.wxyc.org");
  });

  it("uses only the first entry of a multi-proxy x-forwarded-proto list", async () => {
    mockGet.mockImplementation((name: string) => {
      if (name === "x-forwarded-host") return "dj.wxyc.org";
      if (name === "x-forwarded-proto") return "https, http";
      return null;
    });

    await expect(getSiteOrigin()).resolves.toBe("https://dj.wxyc.org");
  });

  it("falls back to the host header when no forwarded headers are present", async () => {
    mockGet.mockImplementation((name: string) =>
      name === "host" ? "preview.wxyc-dj.pages.dev" : null
    );

    await expect(getSiteOrigin()).resolves.toBe(
      "https://preview.wxyc-dj.pages.dev"
    );
  });

  it("defaults to http for localhost when no proto header is set", async () => {
    mockGet.mockImplementation((name: string) =>
      name === "host" ? "localhost:3000" : null
    );

    await expect(getSiteOrigin()).resolves.toBe("http://localhost:3000");
  });

  it("falls back to localhost:3000 when no host headers are present at all", async () => {
    mockGet.mockImplementation(() => null);

    await expect(getSiteOrigin()).resolves.toBe("http://localhost:3000");
  });
});
