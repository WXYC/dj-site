import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import {
  createTestStore,
  server,
  renderWithProviders,
  TEST_BACKEND_URL,
} from "@/tests/helpers";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";
import { playlistSearchSlice } from "@/lib/features/playlist-search/frontend";
import { rangeEntry, serveArchive } from "@/tests/fakes/flowsheetRange";

// The base query's prepareHeaders fetches a JWT; no auth server runs here.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

// Reassigned by the test between renders: opening a show is a query-only
// navigation, and a fixed URLSearchParams cannot flip.
let currentParams = new URLSearchParams();

// Stable across renders so a test can read what the toggle wrote; a fresh
// vi.fn() per useRouter() call records into an object the test cannot reach.
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/playlists",
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => currentParams,
}));

// The branch's other arm, stubbed: this spec is about what the listing keeps
// across it, not about what a show renders.
vi.mock(
  "@/src/components/experiences/modern/previous-sets/ShowView",
  () => ({
    default: ({ showId }: { showId: number }) => <p>show {showId}</p>,
  }),
);

import PreviousSetsSurface from "@/src/components/experiences/modern/previous-sets/PreviousSetsSurface";

const PAGE = 50;
const ARCHIVE = 120;

beforeEach(() => {
  currentParams = new URLSearchParams();
});

/**
 * The ranked listing as the walk specs below expect it: a non-chronological
 * sort, so the flat table mounts. Date (Oldest) keeps the date cursor the
 * fake's walk assertions are written against.
 */
function rankedStore() {
  const store = createTestStore();
  store.dispatch(
    playlistSearchSlice.actions.setSort({ sortBy: "date", sortOrder: "asc" }),
  );
  return store;
}

function scrollport(): HTMLElement {
  return screen.getByTestId("previous-sets-scrollport");
}

function rowCount(): number {
  const table = screen.getByRole("table", { name: "playlist search results" });
  // Every row but the header is a result.
  return within(table).getAllByRole("row").length - 1;
}

async function settleFirstPage() {
  await waitFor(() => expect(rowCount()).toBe(PAGE));
}

/**
 * One scroll to the bottom, and the appended page.
 *
 * The metrics are stated rather than left at jsdom's zeroes: against zeroes the
 * handler's `scrollHeight <= scrollTop + clientHeight + 100` is true for any
 * formula of that shape, so a dropped term would still pass here — and would
 * fetch a page on every scroll event in a browser.
 */
async function loadSecondPage() {
  const scroller = scrollport();
  Object.defineProperty(scroller, "scrollHeight", {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(scroller, "clientHeight", {
    value: 500,
    configurable: true,
  });
  scroller.scrollTop = 1500;
  fireEvent.scroll(scroller);
  await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
}

/** The walk as the fake saw it — page and cursor together, since the default
 *  `date` sort paginates by cursor and holds `page` at 0 throughout. */
function walk(fake: ReturnType<typeof playlistSearchFake>) {
  return fake.requests.map((r) => ({ page: r.page, cursor: r.cursor }));
}

function openShow() {
  currentParams = new URLSearchParams({ show: "3", entry: "10004" });
}

function closeShow() {
  currentParams = new URLSearchParams();
}

describe("PreviousSetsSurface — returning from a show", () => {
  // No clock is advanced here on purpose. The subscription above the branch
  // never unsubscribes, so no removal timer is ever scheduled — a dwell has
  // nothing to expire and asserting one would claim coverage this does not
  // have. What pins the retention setting is the fresh-arrival spec below,
  // which watches the entry actually get dropped.
  it("keeps the walked pages and re-runs nothing", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: rankedStore(),
    });

    await settleFirstPage();
    await loadSecondPage();
    const walked = walk(fake);
    expect(walked).toEqual([
      { page: 0, cursor: null },
      { page: 0, cursor: `after:${fake.rows[PAGE - 1].id}` },
    ]);

    openShow();
    rerender(<PreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<PreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
    expect(walk(fake)).toEqual(walked);
  });

  it("puts the listing back at the offset it was left at", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: rankedStore(),
    });

    await settleFirstPage();
    scrollport().scrollTop = 840;

    openShow();
    rerender(<PreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<PreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    expect(scrollport().scrollTop).toBe(840);
  });
});

describe("PreviousSetsSurface — a sub-threshold detour", () => {
  // A single character is below the search threshold, so both consumers skip
  // and the listing shows the "keep typing" prompt. Deleting it is an undo, not
  // a new listing — the walk it returns to has to still be there, which at zero
  // retention it only is because the subscription holds the last addressable
  // key rather than following the partial one.
  it("keeps the walk across a character typed and deleted", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const store = rankedStore();

    renderWithProviders(<PreviousSetsSurface />, { store });
    await settleFirstPage();
    await loadSecondPage();
    const walked = walk(fake);

    const rowId = store.getState().playlistSearch.rows[0].id;
    const type = (value: string) =>
      act(() => {
        store.dispatch(
          playlistSearchSlice.actions.updateRow({ id: rowId, updates: { value } }),
        );
      });

    type("j");
    await waitFor(() =>
      expect(
        screen.getByText("Keep typing to search previous sets…"),
      ).toBeInTheDocument(),
    );
    type("");

    await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
    expect(walk(fake)).toEqual(walked);
  });
});

describe("PreviousSetsSurface — removing a search row", () => {
  const { addRow, updateRow } = playlistSearchSlice.actions;

  function storeWithTwoRows() {
    const store = createTestStore();
    store.dispatch(addRow());
    const [first, second] = store.getState().playlistSearch.rows;
    store.dispatch(updateRow({ id: first.id, updates: { value: "stereolab" } }));
    store.dispatch(
      updateRow({ id: second.id, updates: { value: "jessica pratt" } }),
    );
    return store;
  }

  function removeButtons(): HTMLElement[] {
    return screen
      .getAllByTestId("RemoveIcon")
      .map((icon) => icon.closest("button") as HTMLElement);
  }

  function queriesInFlight(store: ReturnType<typeof createTestStore>) {
    return Object.values(store.getState().playlistSearchApi.queries)
      .filter((entry) => entry?.status === "pending")
      .map((entry) => (entry?.originalArgs as { q: string }).q);
  }

  // Read off the store in the tick of the click, not off the network after a
  // wait: a request that sat out the typing delay would reach the network too,
  // and only the tick it started in tells the two apart.
  it.each([
    { removed: "first", index: 0, remaining: "artist:jessica pratt" },
    { removed: "second", index: 1, remaining: "stereolab" },
  ])(
    "requests the remaining query on the click that removes the $removed row",
    async ({ index, remaining }) => {
      const fake = playlistSearchFake({ archiveSize: ARCHIVE });
      server.use(fake.handler);
      const store = storeWithTwoRows();

      renderWithProviders(<PreviousSetsSurface />, { store });
      await settleFirstPage();
      expect(queriesInFlight(store)).toEqual([]);

      fireEvent.click(removeButtons()[index]);

      expect(queriesInFlight(store)).toEqual([remaining]);
      await waitFor(() => expect(fake.requests.at(-1)?.q).toBe(remaining));
    },
  );
});

describe("PreviousSetsSurface — arriving fresh", () => {
  it("fetches a fresh first page rather than serving what the last visit walked", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const store = rankedStore();

    const first = renderWithProviders(<PreviousSetsSurface />, { store });
    await settleFirstPage();
    await loadSecondPage();
    first.unmount();

    // Leaving the screen drops the entry, so nothing is left for the next
    // arrival to be served or to re-walk. RTK schedules that removal rather
    // than running it inline, even at zero retention — a remount inside the
    // same tick would still find the pages, and a real navigation never is.
    await waitFor(() =>
      expect(
        Object.keys(store.getState().playlistSearchApi.queries),
      ).toHaveLength(0),
    );

    renderWithProviders(<PreviousSetsSurface />, { store });

    await waitFor(() => expect(fake.requests).toHaveLength(3));
    expect(fake.requests[2]).toMatchObject({ page: 0, cursor: null });
    await settleFirstPage();
  });

  it("searches nothing for a permalink that opens straight into a show", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    openShow();
    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: rankedStore(),
    });
    await screen.findByText("show 3");

    // A listing nobody has asked for must not spend a request on an endpoint
    // whose result count is capped because it is expensive.
    await waitFor(() => expect(fake.requests).toHaveLength(0));

    closeShow();
    rerender(<PreviousSetsSurface />);

    await settleFirstPage();
    expect(fake.requests).toHaveLength(1);
  });
});

describe("PreviousSetsSurface — the chronological default", () => {
  const { setSort } = playlistSearchSlice.actions;
  const BASE = Date.parse("2026-10-01T18:00:00.000Z");
  const archiveRows = Array.from({ length: 60 }, (_, i) =>
    rangeEntry(900000 + i, BASE - i * 60_000),
  );

  // Jsdom lays nothing out, so every scroll height reads zero and the
  // bottom-of-scrollport check would walk the whole archive on its own.
  // A tall scrollport keeps the walk to the pages each spec asks for.
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollHeight", {
      configurable: true,
      get: () => 100_000,
    });
    Object.defineProperty(Element.prototype, "clientHeight", {
      configurable: true,
      get: () => 500,
    });
  });

  afterEach(() => {
    delete (Element.prototype as { scrollHeight?: number }).scrollHeight;
    delete (Element.prototype as { clientHeight?: number }).clientHeight;
  });

  function archiveTable() {
    return screen.getByRole("table", { name: "playlist archive" });
  }

  it("lists the archive, not a search, with the search bar and sort mounted", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const windows = serveArchive(archiveRows);

    renderWithProviders(<PreviousSetsSurface />, {
      store: createTestStore(),
    });

    await waitFor(() =>
      expect(within(archiveTable()).getAllByRole("row").length).toBeGreaterThan(1),
    );
    expect(windows.length).toBeGreaterThan(0);
    expect(fake.requests).toHaveLength(0);
    expect(
      screen.queryByRole("table", { name: "playlist search results" }),
    ).not.toBeInTheDocument();
  });

  it("swaps to the ranked table when sorted away, and back without re-walking the archive", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const windows = serveArchive(archiveRows);
    const store = createTestStore();

    renderWithProviders(<PreviousSetsSurface />, { store });
    await waitFor(() => expect(windows.length).toBeGreaterThan(0));
    const walked = windows.length;

    act(() => {
      store.dispatch(setSort({ sortBy: "artist", sortOrder: "asc" }));
    });
    await waitFor(() => expect(fake.requests).toHaveLength(1));
    expect(
      screen.getByRole("table", { name: "playlist search results" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "playlist archive" }),
    ).not.toBeInTheDocument();

    act(() => {
      store.dispatch(setSort({ sortBy: "date", sortOrder: "desc" }));
    });
    await waitFor(() => expect(archiveTable()).toBeInTheDocument());
    expect(windows).toHaveLength(walked);
  });

  it("keeps the walked archive across a show visit", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const windows = serveArchive(archiveRows);

    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: createTestStore(),
    });
    await waitFor(() => expect(windows.length).toBeGreaterThan(0));
    const walked = windows.length;

    openShow();
    rerender(<PreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<PreviousSetsSurface />);

    await waitFor(() => expect(archiveTable()).toBeInTheDocument());
    expect(windows).toHaveLength(walked);
    expect(fake.requests).toHaveLength(0);
  });

  it("keeps each mode's scroll offset to itself", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    serveArchive(archiveRows);
    const store = createTestStore();

    renderWithProviders(<PreviousSetsSurface />, { store });
    await waitFor(() => expect(archiveTable()).toBeInTheDocument());
    scrollport().scrollTop = 840;

    act(() => {
      store.dispatch(setSort({ sortBy: "artist", sortOrder: "asc" }));
    });
    await waitFor(() =>
      expect(
        screen.getByRole("table", { name: "playlist search results" }),
      ).toBeInTheDocument(),
    );
    expect(scrollport().scrollTop).toBe(0);
  });
});

describe("PreviousSetsSurface — the Week toggle from inside a show", () => {
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

    openShow();
    renderWithProviders(<PreviousSetsSurface />, { store: createTestStore() });
    await screen.findByText("show 3");

    // Clicked only once the show's week has actually arrived; clicking against
    // an unresolved query would assert the fallback and pass for the old code.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /week/i })).toBeEnabled(),
    );
    await waitFor(() => {
      mockReplace.mockClear();
      fireEvent.click(screen.getByRole("button", { name: /week/i }));
      const url = mockReplace.mock.calls.at(-1)?.[0] as string | undefined;
      // 2003-04-09 is a Wednesday; the station week containing it opens Sunday
      // the 6th. A literal, not a recomputation of the code under test.
      expect(url).toContain("week=2003-04-06");
    });
  });

  it("opens the current week when no show is open", async () => {
    renderWithProviders(<PreviousSetsSurface />, { store: createTestStore() });
    // The toggle, not the listing: this asserts where the week comes from with
    // nothing open, and the listing behind it is another spec's subject.
    await screen.findByRole("button", { name: /week/i });

    fireEvent.click(screen.getByRole("button", { name: /week/i }));

    const url = mockReplace.mock.calls.at(-1)![0] as string;
    expect(url).toContain("view=week");
    expect(url).not.toContain("week=2003-04-06");
  });
});
