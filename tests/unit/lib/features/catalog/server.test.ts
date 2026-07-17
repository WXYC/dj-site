import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
// The use-cache directive/profile helpers only run inside a Next server
// request; stub them so the accessor's fetch/validate logic is testable.
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

import { getCachedGenres } from "@/lib/features/catalog/server";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

const BACKEND_URL = "http://backend.test";
const genres = [
  { id: 1, genre_name: "Noise" },
  { id: 2, genre_name: "Ambient" },
];

describe("getCachedGenres", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the genre list on a successful array response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(genres)));
    expect(await getCachedGenres()).toEqual(genres);
  });

  it("fails open to undefined on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(genres, false)));
    expect(await getCachedGenres()).toBeUndefined();
  });

  it("fails open to undefined on a valid-JSON non-array body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ genres })));
    expect(await getCachedGenres()).toBeUndefined();
  });

  it("fails open to undefined on an empty body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(undefined)));
    expect(await getCachedGenres()).toBeUndefined();
  });

  it("fails open to undefined when the fetch rejects (e.g. timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    );
    expect(await getCachedGenres()).toBeUndefined();
  });

  it("fails open to undefined when the backend url is unset", async () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await getCachedGenres()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
