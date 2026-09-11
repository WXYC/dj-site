import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import {
  createTestStore,
  installScrollTopShim,
  makeScrollable,
  server,
} from "@/tests/helpers";
import { renderWithProviders } from "@/tests/helpers/render";
import { playlistSearchFake } from "@/tests/fakes/playlistSearch";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/playlists",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

let removeScrollTopShim: (() => void) | undefined;

beforeEach(() => {
  removeScrollTopShim = installScrollTopShim();
  currentParams = new URLSearchParams();
});

afterEach(() => {
  removeScrollTopShim?.();
});

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

/** One scroll to the bottom, and the appended page. */
async function loadSecondPage() {
  makeScrollable(scrollport(), { scrollTop: 1500 });
  fireEvent.scroll(scrollport());
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
  it("keeps the walked pages and re-runs nothing", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: createTestStore(),
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

  it("keeps them after dwelling on the show past the retention window", async () => {
    // The window is now zero — the entry lives exactly as long as the surface —
    // so the dwell is no longer what decides. Asserted at a minute anyway,
    // because a minute is the number the old default made load-bearing.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const fake = playlistSearchFake({ archiveSize: ARCHIVE });
      server.use(fake.handler);

      const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
        store: createTestStore(),
      });

      await settleFirstPage();
      await loadSecondPage();
      const walked = walk(fake);

      openShow();
      rerender(<PreviousSetsSurface />);
      await screen.findByText("show 3");

      await vi.advanceTimersByTimeAsync(61_000);

      closeShow();
      rerender(<PreviousSetsSurface />);

      await waitFor(() => expect(rowCount()).toBe(2 * PAGE));
      expect(walk(fake)).toEqual(walked);
    } finally {
      vi.useRealTimers();
    }
  });

  it("puts the listing back at the offset it was left at", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);

    const { rerender } = renderWithProviders(<PreviousSetsSurface />, {
      store: createTestStore(),
    });

    await settleFirstPage();
    makeScrollable(scrollport(), { scrollTop: 840 });

    openShow();
    rerender(<PreviousSetsSurface />);
    await screen.findByText("show 3");

    closeShow();
    rerender(<PreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    expect(scrollport().scrollTop).toBe(840);
  });
});

describe("PreviousSetsSurface — arriving fresh", () => {
  it("fetches a fresh first page rather than serving what the last visit walked", async () => {
    const fake = playlistSearchFake({ archiveSize: ARCHIVE });
    server.use(fake.handler);
    const store = createTestStore();

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
      store: createTestStore(),
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
