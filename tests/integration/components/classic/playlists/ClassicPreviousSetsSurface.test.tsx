import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
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

// Reassigned between renders: opening a show is a query-only navigation, and a
// fixed URLSearchParams cannot flip.
let currentParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/playlists",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => currentParams,
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useLogout: () => ({ handleLogout: vi.fn() }),
  // Rendered through Navigation, which reads the registry for the identity slot.
  useRegistry: () => ({ info: { id: "u1", real_name: "Maura Partrick" }, loading: false }),
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

let removeScrollTopShim: (() => void) | undefined;
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
  removeScrollTopShim = installScrollTopShim();
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
  removeScrollTopShim?.();
});

function rowCount(): number {
  const table = screen.getByRole("table");
  // Every row but the header is a result.
  return within(table).getAllByRole("row").length - 1;
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

    currentParams = new URLSearchParams({ show: "3", entry: "10004" });
    rerender(<ClassicPreviousSetsSurface />);
    await screen.findByText("show 3");

    currentParams = new URLSearchParams();
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
    makeScrollable(shellScrollport, { scrollTop: 840 });

    currentParams = new URLSearchParams({ show: "3", entry: "10004" });
    rerender(<ClassicPreviousSetsSurface />);
    await screen.findByText("show 3");

    currentParams = new URLSearchParams();
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

    currentParams = new URLSearchParams();
    rerender(<ClassicPreviousSetsSurface />);

    await waitFor(() => expect(rowCount()).toBe(PAGE));
    expect(fake.requests).toHaveLength(1);
  });
});
