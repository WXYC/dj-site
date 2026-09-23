import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  createTestStore,
  server,
  renderWithProviders,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

// Reassigned between renders: opening a show is a query-only navigation, and a
// fixed URLSearchParams cannot flip.
let currentParams = new URLSearchParams();

// Stable across renders so a test can read what the toggle wrote; a fresh
// vi.fn() per useRouter() call records into an object the test cannot reach.
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/playlists",
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => currentParams,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: vi.fn() }),
  // Rendered through Navigation, which reads the registry for the identity slot.
  useRegistry: () => ({ info: { id: "u1", real_name: "Test User" }, loading: false }),
}));

// The branch's other arm, stubbed: these specs are about what the listing keeps
// across it, not about what a show renders.
vi.mock("@/src/components/experiences/classic/playlists/ShowView", () => ({
  default: ({ showId }: { showId: number }) => <p>show {showId}</p>,
}));

import ClassicPreviousSetsSurface from "@/src/components/experiences/classic/playlists/ClassicPreviousSetsSurface";

const PAGE = 50;
const ARCHIVE = 120;

// The setup file's IntersectionObserver stub never fires, so classic's sentinel
// can never ask for a second page. This one hands the callback back to the
// spec, which is the only way to walk the listing in jsdom.
let observedCallback: IntersectionObserverCallback | undefined;

/**
 * The shell's scrollport, which lives above this tree: `html, body` clip their
 * overflow and `#classic-container` is where globals.css puts scrolling back,
 * so classic's listing offset is an inner one exactly as modern's is. Rendering
 * the surface alone does not produce it, so the spec supplies it.
 */
let shellScrollport: HTMLElement;

beforeEach(() => {
  observedCallback = undefined;
  currentParams = new URLSearchParams();
  shellScrollport = document.createElement("div");
  shellScrollport.id = "classic-container";
  document.body.appendChild(shellScrollport);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observedCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  shellScrollport.remove();
});

function rowCount(): number {
  const table = screen.getByRole("table");
  // Every row but the header is a result.
  return within(table).getAllByRole("row").length - 1;
}

function openShow() {
  currentParams = new URLSearchParams({ show: "3", entry: "10004" });
}

function closeShow() {
  currentParams = new URLSearchParams();
}

function walk(fake: ReturnType<typeof playlistSearchFake>) {
  return fake.requests.map((r) => ({ page: r.page, cursor: r.cursor }));
}

describe("ClassicPreviousSetsSurface", () => {
  // Every other classic dashboard screen reaches Navigation through a shell
  // component. This surface owns it directly rather than borrowing
  // Layout/Main, whose `textAlign: center` would re-centre the week grid, so
  // nothing above it guarantees the bar is on the page.
  it("renders the classic navigation bar", () => {
    renderWithProviders(<ClassicPreviousSetsSurface />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Card Catalog" })
    ).toBeInTheDocument();
  });

  it("keeps the walked pages when a show is opened and closed", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });

    await waitFor(() => expect(rowCount()).toBe(PAGE));

    act(() => {
      observedCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        null as unknown as IntersectionObserver,
      );
    });
    await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
    const walked = walk(fake);

    openShow();
    rerender(<ClassicPreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<ClassicPreviousSetsSurface />);

    // Holding the pages is half of landing back in the right place; the other
    // half is the offset, asserted below.
    await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
    expect(walk(fake)).toEqual(walked);
  });

  it("puts the shell's scrollport back where the listing left it", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    shellScrollport.scrollTop = 840;

    openShow();
    rerender(<ClassicPreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<ClassicPreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    expect(shellScrollport.scrollTop).toBe(840);
  });

  it("searches nothing for a permalink that opens straight into a show", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    currentParams = new URLSearchParams({ show: "3", entry: "10004" });
    const { rerender } = renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });
    await screen.findByText("show 3");

    await waitFor(() => expect(fake.requests).toHaveLength(0));

    closeShow();
    rerender(<ClassicPreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    expect(fake.requests).toHaveLength(1);
  });
});

// Exercises the real `searchPlaylists` endpoint end to end (no mocked hook),
// so it proves the endpoint's own `surfaceNonJsonAsError` wiring rather than
// just `backendBaseQuery`'s standalone behaviour.
describe("ClassicPreviousSetsSurface — a genuinely unparseable response body", () => {
  it("shows an error instead of silently claiming the archive is empty", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/search`, () =>
        new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });

    expect(
      await screen.findByText(/an error occurred while searching/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

// A rejected page is never appended, so the walk's next param survives it and
// `hasMore` stays true — while the sentinel re-arms on every `isLoading` flip
// and a fresh observer fires immediately for an element already in view.
// Nothing but the hook's own guard stands between a broken page and an
// unthrottled retry loop against the archive's most expensive endpoint.
describe("ClassicPreviousSetsSurface — a page that fails mid-walk", () => {
  it("asks for the failed page once, however often the sentinel re-enters view", async () => {
    const { rows } = playlistSearchFake({ archiveSize: PAGE });
    let calls = 0;
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/search`, () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({
            results: rows,
            total: 4 * PAGE,
            page: 0,
            totalPages: 4,
            nextCursor: `after:${rows[rows.length - 1].id}`,
          });
        }
        return new HttpResponse("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }),
    );

    renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });
    await waitFor(() => expect(rowCount()).toBe(PAGE));

    const sentinelEntersView = () =>
      act(() => {
        observedCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          null as unknown as IntersectionObserver,
        );
      });

    sentinelEntersView();
    await screen.findByText(/an error occurred while searching/i);
    expect(calls).toBe(2);

    sentinelEntersView();
    sentinelEntersView();

    // The walk is still open — "End of results" never renders, so the sentinel
    // stays armed — and a re-request needs a turn of the event loop to reach
    // the handler, which is what this settles for. Unguarded, `calls` is 3 here.
    expect(screen.queryByText(/end of results/i)).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    expect(calls).toBe(2);
  });
});

describe("ClassicPreviousSetsSurface — the Week toggle from inside a show", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  // A show reached by walking the archive carries no week in the URL, so the
  // toggle's own fallback resolves to today. Left that way it takes a reader of
  // a 2003 set to this week's calendar, which is why the header used to need a
  // second, differently-destined link beside it.
  it("opens the week the open show aired in, not the current one", async () => {
    server.use(
      http.get(`${TEST_BACKEND_URL}/flowsheet/playlist`, () =>
        HttpResponse.json({
          id: 3,
          show_name: "Sunrise Service",
          specialty_show_name: "",
          start_time: "2003-04-09T18:00:00.000Z",
          end_time: null,
          show_djs: [],
          dj_name_override: null,
          legacy_dj_name: "DJ Wandering",
          previous_show_id: null,
          next_show_id: null,
          entries: [],
        }),
      ),
    );

    currentParams = new URLSearchParams({ show: "3" });
    renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });
    await screen.findByText("show 3");

    // Retried until the show's week has actually arrived; clicking against an
    // unresolved query would assert the fallback and pass for the old code.
    await waitFor(() => {
      mockReplace.mockClear();
      screen.getByRole("button", { name: "Week" }).click();
      const url = mockReplace.mock.calls.at(-1)?.[0] as string | undefined;
      // 2003-04-09 is a Wednesday; the station week containing it opens Sunday
      // the 6th. A literal, not a recomputation of the code under test.
      expect(url).toContain("week=2003-04-06");
    });
  });

  it("opens the current week when no show is open", async () => {
    renderWithProviders(<ClassicPreviousSetsSurface />, {
      store: createTestStore(),
    });
    await screen.findByRole("button", { name: "Week" });

    screen.getByRole("button", { name: "Week" }).click();

    const url = mockReplace.mock.calls.at(-1)![0] as string;
    expect(url).toContain("view=week");
    expect(url).not.toContain("week=2003-04-06");
  });
});
