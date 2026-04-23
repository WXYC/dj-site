import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server, createTestLmlLibraryItem } from "@/lib/test-utils";
import { useLmlLibrarySearch } from "./useLmlLibrarySearch";
import type { LmlLibrarySearchResponse } from "./types";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-jwt-token"),
}));

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
const PROXY_SEARCH_URL = `${BACKEND_URL}/proxy/library/search`;

describe("useLmlLibrarySearch", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return empty array when query is too short", async () => {
    const { result } = renderHook(() =>
      useLmlLibrarySearch({ artist: "a", album: "" })
    );

    await vi.advanceTimersByTimeAsync(400);

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("should send correct query params to Backend-Service proxy", async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(PROXY_SEARCH_URL, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          results: [],
          total: 0,
          query: "Juana Molina",
        } satisfies LmlLibrarySearchResponse);
      })
    );

    renderHook(() =>
      useLmlLibrarySearch({ artist: "Juana Molina", album: "DOGA" })
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(capturedUrl).toBeDefined());

    expect(capturedUrl!.searchParams.get("artist")).toBe("Juana Molina");
    expect(capturedUrl!.searchParams.get("title")).toBe("DOGA");
    expect(capturedUrl!.searchParams.get("limit")).toBe("10");
  });

  it("should include Authorization header", async () => {
    let capturedHeaders: Headers | undefined;
    server.use(
      http.get(PROXY_SEARCH_URL, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse);
      })
    );

    renderHook(() =>
      useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" })
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(capturedHeaders).toBeDefined());

    expect(capturedHeaders!.get("Authorization")).toMatch(/^Bearer /);
  });

  it("should convert results to AlbumEntry[]", async () => {
    const lmlItem = createTestLmlLibraryItem({
      id: 99,
      title: "Moon Pix",
      artist: "Cat Power",
      call_letters: "RO",
      artist_call_number: 23,
      release_call_number: 5,
      genre: "Rock",
      format: "CD",
    });

    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return HttpResponse.json({
          results: [lmlItem],
          total: 1,
          query: "Cat Power",
        } satisfies LmlLibrarySearchResponse);
      })
    );

    const { result } = renderHook(() =>
      useLmlLibrarySearch({ artist: "Cat Power", album: "Moon" })
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.results.length).toBe(1));

    expect(result.current.results[0]).toEqual(
      expect.objectContaining({
        id: 99,
        title: "Moon Pix",
        artist: expect.objectContaining({
          name: "Cat Power",
          lettercode: "RO",
        }),
        format: "CD",
        label: "",
      })
    );
  });

  it("should return empty array on HTTP error", async () => {
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderHook(() =>
      useLmlLibrarySearch({ artist: "Stereolab", album: "Aluminum" })
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([]);
  });

  it("should return empty array on network error", async () => {
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        return HttpResponse.error();
      })
    );

    const { result } = renderHook(() =>
      useLmlLibrarySearch({ artist: "Anne Gillis", album: "Eyry" })
    );

    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([]);
  });

  it("should debounce requests", async () => {
    let callCount = 0;
    server.use(
      http.get(PROXY_SEARCH_URL, () => {
        callCount++;
        return HttpResponse.json({
          results: [],
          total: 0,
          query: null,
        } satisfies LmlLibrarySearchResponse);
      })
    );

    const { rerender } = renderHook(
      ({ artist, album }) => useLmlLibrarySearch({ artist, album }),
      { initialProps: { artist: "Jua", album: "" } }
    );

    // Change query before debounce fires
    await vi.advanceTimersByTimeAsync(100);
    rerender({ artist: "Juan", album: "" });
    await vi.advanceTimersByTimeAsync(100);
    rerender({ artist: "Juana", album: "" });

    // Wait for debounce
    await vi.advanceTimersByTimeAsync(400);
    await waitFor(() => expect(callCount).toBeGreaterThan(0));

    // Only one request should have been made
    expect(callCount).toBe(1);
  });
});
