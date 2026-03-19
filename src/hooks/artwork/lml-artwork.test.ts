import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_LML_URL } from "@/lib/test-utils";
import getArtworkFromLml from "./lml-artwork";

const LML_SEARCH_URL = `${TEST_LML_URL}/api/v1/discogs/search`;

describe("getArtworkFromLml", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns artwork_url from first result on success", async () => {
    server.use(
      http.post(LML_SEARCH_URL, () => {
        return HttpResponse.json({
          results: [
            { artwork_url: "https://example.com/art.jpg", release_id: 123 },
          ],
          total: 1,
          cached: false,
        });
      }),
    );

    const result = await getArtworkFromLml({
      title: "DOGA",
      artist: "Juana Molina",
    });
    expect(result).toBe("https://example.com/art.jpg");
  });

  it("returns null when results array is empty", async () => {
    server.use(
      http.post(LML_SEARCH_URL, () => {
        return HttpResponse.json({ results: [], total: 0, cached: false });
      }),
    );

    const result = await getArtworkFromLml({
      title: "Nonexistent Album",
      artist: "Unknown Artist",
    });
    expect(result).toBeNull();
  });

  it("returns null when artwork_url is null on first result", async () => {
    server.use(
      http.post(LML_SEARCH_URL, () => {
        return HttpResponse.json({
          results: [{ artwork_url: null, release_id: 456 }],
          total: 1,
          cached: true,
        });
      }),
    );

    const result = await getArtworkFromLml({
      title: "Moon Pix",
      artist: "Cat Power",
    });
    expect(result).toBeNull();
  });

  it("returns null on non-200 HTTP status", async () => {
    server.use(
      http.post(LML_SEARCH_URL, () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const result = await getArtworkFromLml({
      title: "Aluminum Tunes",
      artist: "Stereolab",
    });
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    server.use(
      http.post(LML_SEARCH_URL, () => {
        return HttpResponse.error();
      }),
    );

    const result = await getArtworkFromLml({
      title: "Edits",
      artist: "Chuquimamani-Condori",
    });
    expect(result).toBeNull();
  });

  it("sends correct JSON body with ?limit=1", async () => {
    let capturedBody: unknown;
    let capturedUrl: string;

    server.use(
      http.post(LML_SEARCH_URL, async ({ request }) => {
        capturedUrl = request.url;
        capturedBody = await request.json();
        return HttpResponse.json({ results: [], total: 0, cached: false });
      }),
    );

    await getArtworkFromLml({
      title: "On Your Own Love Again",
      artist: "Jessica Pratt",
    });

    expect(capturedBody).toEqual({
      artist: "Jessica Pratt",
      album: "On Your Own Love Again",
    });
    expect(capturedUrl!).toContain("?limit=1");
  });
});
