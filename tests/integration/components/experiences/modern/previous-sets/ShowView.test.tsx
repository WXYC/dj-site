import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ShowView from "@/src/components/experiences/modern/previous-sets/ShowView";
import type { ShowPlaylist } from "@/src/hooks/showPlaylistHooks";
import type { FlowsheetRangeEntry } from "@wxyc/shared";

// The panel renders the live flowsheet's own rows, which reach for the live
// show's hooks. Stubbed so this file is about the page's layout and not about
// what a row does on the air.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/src/hooks/flowsheetHooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/hooks/flowsheetHooks")>();
  return {
    ...actual,
    useShowControl: () => vi.fn(),
    useLiveStatus: () => vi.fn(),
  };
});

const showPlaylist = vi.fn();
vi.mock("@/src/hooks/showPlaylistHooks", () => ({
  useShowPlaylist: () => showPlaylist(),
}));

const entry = (id: number) =>
  ({
    id,
    play_order: id,
    show_id: 1951179,
    add_time: "2026-08-22T21:00:00.000Z",
    entry_type: "track",
    request_flag: false,
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
  }) as unknown as FlowsheetRangeEntry;

const playlist = (over: Partial<ShowPlaylist> = {}): ShowPlaylist =>
  ({
    title: "DJ Chowder",
    djName: "DJ Chowder",
    day: "Saturday, August 22, 2026",
    timeRange: "4:36 PM – 8:01 PM",
    weekParam: "2026-08-16",
    entries: [entry(1), entry(2), entry(3)],
    isLoading: false,
    notFound: false,
    ...over,
  }) as ShowPlaylist;

const renderShowView = (over: Partial<ShowPlaylist> = {}) => {
  showPlaylist.mockReturnValue(playlist(over));
  return render(<ShowView showId={1951179} />);
};

describe("ShowView", () => {
  it("owns the page's vertical scroll", () => {
    const { container } = renderShowView();

    // `Main` is a fixed 100dvh box with overflow:hidden, so a page that owns no
    // scroll container has its overflow clipped away rather than scrolled to.
    // An archived set is arbitrarily long and the panel inside deliberately
    // holds no scrollport of its own, so this is where the set's own scroll
    // lives: `flex` + `minHeight` shrink it to the space left below the page
    // header, `overflowY` scrolls the rest.
    expect(container.firstElementChild).toHaveStyle({
      flex: "1",
      minHeight: "0px",
      overflowY: "auto",
    });
  });

  it("scrolls the show's header with its set rather than pinning it", () => {
    const { container } = renderShowView();

    // The date, DJ and the link back to the week belong to the set, and the
    // week view above scrolls its own header the same way. Pinning this one
    // would spend viewport height a long set needs.
    // Level 2: the panel below repeats the show's name as its own heading.
    const heading = screen.getByRole("heading", { level: 2, name: "DJ Chowder" });
    expect(container.firstElementChild).toContainElement(heading);
  });

  it("states a missing show instead of scrolling an empty frame", () => {
    renderShowView({ notFound: true });

    expect(screen.getByText("No show with that id")).toBeInTheDocument();
  });
});
