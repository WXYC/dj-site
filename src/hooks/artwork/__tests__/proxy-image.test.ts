import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/lib/test-utils/msw/server";

const BACKEND_URL = "http://localhost:3001";

// Mock the auth client module to avoid pulling in better-auth React internals
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn(),
}));

import { getJWTToken } from "@/lib/features/authentication/client";
import getArtworkFromProxy from "../proxy-image";

const mockedGetJWTToken = vi.mocked(getJWTToken);

describe("getArtworkFromProxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", BACKEND_URL);
    mockedGetJWTToken.mockResolvedValue("test-jwt-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a blob URL when the proxy returns image bytes", async () => {
    const fakeImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes

    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, () => {
        return new HttpResponse(fakeImageBytes, {
          headers: { "Content-Type": "image/png" },
        });
      }),
    );

    const result = await getArtworkFromProxy({
      title: "Confield",
      artist: "Autechre",
    });

    expect(result).not.toBeNull();
    expect(result).toMatch(/^blob:/);
  });

  it("passes artistName and releaseTitle as query parameters", async () => {
    let capturedUrl: URL | null = null;

    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      }),
    );

    await getArtworkFromProxy({
      title: "Moon Pix",
      artist: "Cat Power",
    });

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.get("artistName")).toBe("Cat Power");
    expect(capturedUrl!.searchParams.get("releaseTitle")).toBe("Moon Pix");
  });

  it("includes JWT Bearer token in the request", async () => {
    let capturedAuthHeader: string | null = null;

    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, ({ request }) => {
        capturedAuthHeader = request.headers.get("Authorization");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      }),
    );

    await getArtworkFromProxy({ title: "Confield", artist: "Autechre" });

    expect(capturedAuthHeader).toBe("Bearer test-jwt-token");
  });

  it("works without a JWT token (unauthenticated)", async () => {
    mockedGetJWTToken.mockResolvedValue(null);

    let capturedAuthHeader: string | null = null;

    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, ({ request }) => {
        capturedAuthHeader = request.headers.get("Authorization");
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "image/jpeg" },
        });
      }),
    );

    const result = await getArtworkFromProxy({
      title: "Confield",
      artist: "Autechre",
    });

    expect(capturedAuthHeader).toBeNull();
    expect(result).toMatch(/^blob:/);
  });

  it("returns null when the proxy returns a non-OK response", async () => {
    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, () => {
        return HttpResponse.json(
          { message: "No artwork found" },
          { status: 404 },
        );
      }),
    );

    const result = await getArtworkFromProxy({
      title: "Nonexistent Album",
      artist: "Unknown Artist",
    });

    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    server.use(
      http.get(`${BACKEND_URL}/proxy/artwork/search`, () => {
        return HttpResponse.error();
      }),
    );

    const result = await getArtworkFromProxy({
      title: "Confield",
      artist: "Autechre",
    });

    expect(result).toBeNull();
  });
});
