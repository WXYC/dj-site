import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { http, HttpResponse, delay } from "msw";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { useCompilationBucketResolution } from "@/src/hooks/useCompilationBucketResolution";
import {
  VARIOUS_ARTISTS_CODE_LETTERS,
  VARIOUS_ARTISTS_CODE_NUMBER,
} from "@/lib/features/catalog/libraryCode";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn().mockResolvedValue(null),
  clearTokenCache: vi.fn(),
  authBaseURL: "http://localhost:3001/auth",
  authClient: {},
}));

const BY_CODE_URL = `${TEST_BACKEND_URL}/library/artists/by-code`;

const ROCK_GENRE_ID = 11;
const SOUNDTRACKS_GENRE_ID = 12;

function bucket(id: number, artist_name: string, genre_id = ROCK_GENRE_ID) {
  return {
    id,
    artist_name,
    code_letters: VARIOUS_ARTISTS_CODE_LETTERS,
    code_number: VARIOUS_ARTISTS_CODE_NUMBER,
    genre_id,
  };
}

function renderResolution(initial: { active: boolean; genreId: number | null }) {
  const store = createTestStore();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });
  const view = renderHook(
    ({ active, genreId }: { active: boolean; genreId: number | null }) =>
      useCompilationBucketResolution(active, genreId),
    { wrapper, initialProps: initial },
  );
  return { ...view, store };
}

describe("useCompilationBucketResolution — outcome mapping", () => {
  it("is idle and fires no request while compilation state is off", async () => {
    const requests: string[] = [];
    server.use(
      http.get(BY_CODE_URL, ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ artists: [bucket(1, "Various Artists")] });
      }),
    );

    const { result } = renderResolution({ active: false, genreId: ROCK_GENRE_ID });

    await delay(30);
    expect(result.current.outcome).toBe("idle");
    expect(requests).toEqual([]);
  });

  it("maps a single owner to `existing` and exposes it as the resolved bucket", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ artists: [bucket(7, "Various Artists")] }),
      ),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("existing"));
    expect(result.current.owners).toEqual([bucket(7, "Various Artists")]);
    expect(result.current.resolvedArtistId).toBe(7);
  });

  it("maps several owners to `picking`, resolving only once the librarian picks", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({
          artists: [
            bucket(21, "Various Artists - Rock - H"),
            bucket(22, "Various Artists - Rock - S"),
          ],
        }),
      ),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("picking"));
    // No auto-preselect: the album title cannot name the shelf letter.
    expect(result.current.resolvedArtistId).toBeNull();

    act(() => result.current.pick(22));
    expect(result.current.resolvedArtistId).toBe(22);
    expect(result.current.outcome).toBe("picking");
  });

  it("maps a `code_not_assigned` 404 to `create`", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ reason: "code_not_assigned" }, { status: 404 }),
      ),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("create"));
    expect(result.current.resolvedArtistId).toBeNull();
  });

  it("maps a `genre_not_found` 404 to its own outcome, never to `create`", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({ reason: "genre_not_found" }, { status: 404 }),
      ),
    );

    const { result } = renderResolution({ active: true, genreId: 999 });

    await waitFor(() => expect(result.current.outcome).toBe("genre-missing"));
  });

  it.each([
    [
      "a fulfilled but empty artists list (the normalized unreadable body)",
      () => HttpResponse.json({ artists: [] }),
    ],
    ["a 500", () => new HttpResponse(null, { status: 500 })],
    ["a 400", () => HttpResponse.json({ message: "bad request" }, { status: 400 })],
    ["a non-JSON body", () => new HttpResponse("<html>502</html>", { status: 200 })],
    ["a network failure", () => HttpResponse.error()],
  ])("fails closed on %s — never `create`", async (_label, respond) => {
    server.use(http.get(BY_CODE_URL, respond));

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("unavailable"));
    expect(result.current.resolvedArtistId).toBeNull();
  });

  it("fails closed on an unwrapped SerializedError rather than reading it as unassigned", async () => {
    // A thrown (not rejected-response) error reaches the hook without the
    // endpoint's `resolveArtistByCodeError` wrapper, so the reason helper
    // returns undefined for it — the same branch as an outage, never `create`.
    server.use(
      http.get(BY_CODE_URL, () => {
        throw new Error("boom");
      }),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("unavailable"));
  });
});

describe("useCompilationBucketResolution — freshness and the pick", () => {
  it("never renders or arms a slow answer for a superseded genre", async () => {
    server.use(
      http.get(BY_CODE_URL, async ({ request }) => {
        const genreId = new URL(request.url).searchParams.get("genre_id");
        if (genreId === String(SOUNDTRACKS_GENRE_ID)) {
          return HttpResponse.json({
            artists: [bucket(31, "Soundtracks - K", SOUNDTRACKS_GENRE_ID)],
          });
        }
        await delay(60);
        return HttpResponse.json({ artists: [bucket(7, "Various Artists")] });
      }),
    );

    const { result, rerender } = renderResolution({
      active: true,
      genreId: ROCK_GENRE_ID,
    });

    rerender({ active: true, genreId: SOUNDTRACKS_GENRE_ID });

    await waitFor(() => expect(result.current.resolvedArtistId).toBe(31));

    // Let the slow Rock response land in its now-unsubscribed entry.
    await delay(120);
    expect(result.current.resolvedArtistId).toBe(31);
    expect(result.current.owners.map((o) => o.id)).toEqual([31]);
  });

  it("drops a pick made under a different genre", async () => {
    server.use(
      http.get(BY_CODE_URL, ({ request }) => {
        const genreId = Number(new URL(request.url).searchParams.get("genre_id"));
        return HttpResponse.json({
          artists: [
            bucket(41, "Various Artists - A", genreId),
            bucket(42, "Various Artists - B", genreId),
          ],
        });
      }),
    );

    const { result, rerender } = renderResolution({
      active: true,
      genreId: ROCK_GENRE_ID,
    });

    await waitFor(() => expect(result.current.outcome).toBe("picking"));
    act(() => result.current.pick(42));
    expect(result.current.resolvedArtistId).toBe(42);

    rerender({ active: true, genreId: SOUNDTRACKS_GENRE_ID });
    expect(result.current.resolvedArtistId).toBeNull();
  });

  it("clears the pick on demand, for the same-genre batch the reset preserves", async () => {
    server.use(
      http.get(BY_CODE_URL, () =>
        HttpResponse.json({
          artists: [bucket(41, "Various Artists - A"), bucket(42, "Various Artists - B")],
        }),
      ),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("picking"));
    act(() => result.current.pick(42));
    expect(result.current.resolvedArtistId).toBe(42);

    act(() => result.current.clearPick());
    expect(result.current.resolvedArtistId).toBeNull();
  });

  it("reports `resolving` ahead of a retained error while a refetch is in flight", async () => {
    let attempt = 0;
    server.use(
      http.get(BY_CODE_URL, async () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json({ reason: "code_not_assigned" }, { status: 404 });
        }
        await delay(60);
        return HttpResponse.json({ artists: [bucket(7, "Various Artists")] });
      }),
    );

    const { result } = renderResolution({ active: true, genreId: ROCK_GENRE_ID });

    await waitFor(() => expect(result.current.outcome).toBe("create"));

    act(() => {
      result.current.refetch();
    });

    // RTK retains the prior error through the refetch; reading it ahead of
    // `isFetching` would keep the create arm armed across exactly the window
    // the refetch exists to close.
    await waitFor(() => expect(result.current.outcome).toBe("resolving"));
    await waitFor(() => expect(result.current.outcome).toBe("existing"));
  });

  it("no-ops `refetch` while compilation state is off", async () => {
    const { result } = renderResolution({ active: false, genreId: ROCK_GENRE_ID });

    // An RTK hook's `refetch` throws on a query created with `skipToken`.
    expect(() => act(() => result.current.refetch())).not.toThrow();
  });
});
