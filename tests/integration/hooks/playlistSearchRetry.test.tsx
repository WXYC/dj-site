import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { Provider } from "react-redux";
import { http, HttpResponse } from "msw";
import { createTestStore, server, TEST_BACKEND_URL } from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

const PAGE = 50;
const ARCHIVE = 120;
const SEARCH_URL = `${TEST_BACKEND_URL}/flowsheet/search`;

const failOnce = () =>
  http.get(
    SEARCH_URL,
    () => HttpResponse.json({ message: "search failed" }, { status: 500 }),
    { once: true },
  );

function mountDateSort() {
  const store = createTestStore();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(Provider, { store, children });
  return renderHook(() => usePlaylistSearch(), { wrapper });
}

describe("usePlaylistSearch retry (real store + RTK + MSW)", () => {
  it("retries a failed first page with exactly one request, and the listing renders on success", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    // Registered after the fake, so it answers first, once; the fake's own
    // handler answers every request after it.
    server.use(fake.handler);
    server.use(failOnce());

    const { result } = mountDateSort();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fake.requests).toHaveLength(0);

    act(() => {
      result.current.retry();
    });
    // The failure is held while its retry runs, so the notice can stay up.
    expect(result.current.isRetrying).toBe(true);
    expect(result.current.failedPage).toBe("first");

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    expect(result.current.isError).toBe(false);
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.failedPage).toBeNull();
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].q).toBe("");
  });

  it("retries a failed later page by requesting only that page, keeping the loaded rows on screen", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { result } = mountDateSort();
    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    const firstPageResults = result.current.results;

    server.use(failOnce());
    act(() => {
      result.current.loadNextPage();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.results).toEqual(firstPageResults);
    expect(fake.requests).toHaveLength(1);

    // A sentinel re-firing on every render must not re-dispatch the request
    // this already failed.
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.loadNextPage();
      });
    }
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(fake.requests).toHaveLength(1);

    act(() => {
      result.current.retry();
    });

    await waitFor(() =>
      expect(result.current.results).toHaveLength(2 * PAGE),
    );
    expect(fake.requests).toHaveLength(2);
    // Only the failed page is re-requested, not a re-walk from the start.
    expect(fake.requests[1].cursor).toBe(
      `after:${fake.rows[PAGE - 1].id}`,
    );
  });

  // After a sort change the hook still holds the previous sort's rows, so a
  // failure of the new sort's first page must not be read as a failed later
  // page of a walk that does not exist for that sort.
  it("retries a failed first page after a sort change with one first-page request for the new sort", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { result } = mountDateSort();
    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));

    server.use(failOnce());
    act(() => {
      result.current.setSort({ sortBy: "artist", sortOrder: "asc" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fake.requests).toHaveLength(1);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(fake.requests).toHaveLength(2));
    expect(fake.requests[1]).toEqual(
      expect.objectContaining({ sort: "artist", order: "asc", page: 0, cursor: null }),
    );
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.results).toHaveLength(PAGE);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(fake.requests).toHaveLength(2);
  });

  it("shows the notice again on a second failure, and sends nothing more until retried", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    server.use(failOnce());

    const { result } = mountDateSort();
    await waitFor(() => expect(result.current.isError).toBe(true));

    server.use(failOnce());
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fake.requests).toHaveLength(0);
    // The failed retry hands the control back rather than holding it inert.
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.failedPage).toBe("first");
    expect(result.current.failedRetries).toBe(1);

    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(fake.requests).toHaveLength(0);

    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.results).toHaveLength(PAGE));
    expect(fake.requests).toHaveLength(1);
  });
});
