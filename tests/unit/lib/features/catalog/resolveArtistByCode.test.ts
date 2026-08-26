import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server, TEST_BACKEND_URL, createTestStore } from "@/tests/helpers";
import { catalogApi } from "@/lib/features/catalog/api";

vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const ROCK_GENRE_ID = 11;
const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;

const initiate = (
  overrides: Partial<{ genre_id: number; code_letters: string; code_number: number }> = {},
) =>
  catalogApi.endpoints.resolveArtistByCode.initiate({
    genre_id: ROCK_GENRE_ID,
    code_letters: "MO",
    code_number: 12,
    ...overrides,
  });

describe("resolveArtistByCode", () => {
  it("resolves a single owner", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({
          artists: [
            { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 12, genre_id: ROCK_GENRE_ID },
          ],
        }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(false);
    expect(result.data?.artists).toEqual([
      { id: 12, artist_name: "Juana Molina", code_letters: "MO", code_number: 12, genre_id: ROCK_GENRE_ID },
    ]);
  });

  it("resolves multiple owners of a collided triple", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({
          artists: [
            { id: 1, artist_name: "Various Artists - Rock - A", code_letters: "V/A", code_number: 0, genre_id: ROCK_GENRE_ID },
            { id: 2, artist_name: "Various Artists - Rock - B", code_letters: "V/A", code_number: 0, genre_id: ROCK_GENRE_ID },
          ],
        }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(
      initiate({ code_letters: "V/A", code_number: 0 }),
    );

    expect(result.isError).toBe(false);
    expect(result.data?.artists).toHaveLength(2);
  });

  // The caller reads `.length` to pick its branch, so a body missing
  // `artists` must resolve to a shape it can read rather than throwing
  // mid-handler, where the throw would be caught and reported as a
  // retryable outage.
  it("resolves a body missing the owner list to an empty list", async () => {
    server.use(http.get(BY_CODE_URL, () => HttpResponse.json({})));

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(false);
    expect(result.data).toEqual({ artists: [] });
  });

  it("surfaces a genre_not_found 404 as an error", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ message: "Genre not found", reason: "genre_not_found" }, { status: 404 }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it("surfaces a code_not_assigned 404 as an error", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json(
          { message: "Artist code not assigned in that genre", reason: "code_not_assigned" },
          { status: 404 },
        ),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(true);
  });

  // A non-JSON body (a gateway's HTML 502, Express's HTML 404) must not
  // soft-fail into a successful `null` -- this lookup backs the create-flow
  // decision, and a false "unassigned" would walk the librarian into filing
  // a duplicate of a code that already exists.
  it.each([
    ["a gateway HTML error page", 502],
    ["the framework's HTML 404", 404],
  ])("surfaces %s as an error rather than a soft-failed null", async (_name, status) => {
    server.use(
      http.get(
        BY_CODE_URL,
        () =>
          new HttpResponse("<!DOCTYPE html><html><body>Not Found</body></html>", {
            status,
            headers: { "Content-Type": "text/html" },
          }),
      ),
    );

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(true);
    expect(result.data).toBeUndefined();
  });

  // Every failure shape here is handled inline by the chooser (see
  // resolveArtistByCodeErrorReason), so none of them should also land as a
  // second, generic banner from the shared rtk-query-error-logger
  // middleware -- same technique, and the same reasoning, as
  // searchArtistsInGenre.
  it.each([
    ["a gateway HTML error page (PARSING_ERROR opt-out)", () =>
      new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    ],
    ["a structured JSON 404", () =>
      HttpResponse.json({ message: "Artist code not assigned in that genre", reason: "code_not_assigned" }, { status: 404 }),
    ],
  ])("keeps %s out of the global toast", async (_name, respond) => {
    const { toast } = await import("sonner");
    vi.mocked(toast.error).mockClear();
    server.use(http.get(BY_CODE_URL, respond));

    const store = createTestStore();
    const result = await store.dispatch(initiate());

    expect(result.isError).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
