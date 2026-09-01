import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchBackendJson, fetchBackendSeed } from "@/lib/features/server-fetch";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

const BACKEND_URL = "http://backend.test";

describe("fetchBackendJson", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves with the parsed body on a 2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ genres: ["Rock"] })));
    await expect(fetchBackendJson("/library/genres")).resolves.toEqual({
      genres: ["Rock"],
    });
  });

  it("throws when NEXT_PUBLIC_BACKEND_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    await expect(fetchBackendJson("/library/genres")).rejects.toThrow(
      "NEXT_PUBLIC_BACKEND_URL is not set",
    );
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(undefined, false, 500)),
    );
    await expect(fetchBackendJson("/library/genres")).rejects.toThrow(
      "backend responded 500",
    );
  });

  it("throws on an empty response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(undefined)));
    await expect(fetchBackendJson("/library/genres")).rejects.toThrow(
      "empty response body",
    );
  });

  it("passes init options through to fetch and applies the request-time timeout", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBackendJson("/library/genres", { cache: "no-store" });

    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/library/genres`,
      expect.objectContaining({
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("does not let init override the request-time timeout signal", async () => {
    const fetchMock: (
      input: string,
      init: RequestInit,
    ) => Promise<Response> = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBackendJson("/library/genres", {
      signal: new AbortController().signal,
    } as RequestInit);

    const [, init] = vi.mocked(fetchMock).mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("fetchBackendSeed delegation", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the value fetchBackendJson resolves with", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ hello: "world" })));
    await expect(fetchBackendSeed("/library/genres")).resolves.toEqual({
      hello: "world",
    });
  });

  it("swallows a fetchBackendJson rejection and returns undefined", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(undefined, false, 500)),
    );
    await expect(fetchBackendSeed("/library/genres")).resolves.toBeUndefined();
  });

  it("requests with cache: no-store", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchBackendSeed("/library/genres");

    expect(fetchMock).toHaveBeenCalledWith(
      `${BACKEND_URL}/library/genres`,
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
