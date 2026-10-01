import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithPublicProviders, renderWithProviders } from "@/tests/helpers/render";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import ReadOnlyEntry from "@/src/components/experiences/modern/flowsheet/Entries/ReadOnly/ReadOnlyEntry";
import {
  FLOWSHEET_TABLE_SX,
  FLOWSHEET_XL_QUERY,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import {
  FlowsheetBreakpointEntry,
  FlowsheetMessageEntry,
  FlowsheetShowBlockEntry,
  FlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { createTestFlowsheetEntry } from "@/tests/fixtures/fixtures";

// ReadOnlyEntry's module graph is pinned by
// tests/contract/entries-motion-free.test.ts, not by this file: the public
// store this file renders against already includes flowsheetSlice,
// flowsheetApi, liveUpdatesSlice and authenticationSlice, so a component
// that reached a live-show hook would render against them, not throw.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: true, autoplay: false, currentShow: 100 }),
  useFlowsheetActions: () => ({
    updateFlowsheet: vi.fn(),
    addToFlowsheet: vi.fn().mockResolvedValue(undefined),
    removeFromQueue: vi.fn(),
  }),
  useLiveStatus: () => ({ live: true }),
}));

vi.mock("motion/react", () => ({
  useDragControls: () => ({ start: vi.fn() }),
}));

const songEntry: FlowsheetSongEntry = createTestFlowsheetEntry({
  rotation: "H",
  request_flag: true,
});

const startShowEntry: FlowsheetShowBlockEntry = {
  id: 10,
  play_order: 0,
  show_id: 100,
  dj_name: "DJ Juana",
  day: "Monday",
  time: "10:00 PM",
  isStart: true,
};

const endShowEntry: FlowsheetShowBlockEntry = {
  ...startShowEntry,
  id: 11,
  isStart: false,
};

const talksetEntry: FlowsheetMessageEntry = {
  id: 12,
  play_order: 5,
  show_id: 100,
  message: "Talkset - Station ID",
};

const breakpointEntry: FlowsheetBreakpointEntry = {
  id: 13,
  play_order: 7,
  show_id: 100,
  message: "Breakpoint - Hour Mark",
  day: "Monday",
  time: "11:00 PM",
};

const djJoinEntry: FlowsheetMessageEntry = {
  id: 14,
  play_order: 8,
  show_id: 100,
  message: "DJ joined the show",
};

const djLeaveEntry: FlowsheetMessageEntry = {
  id: 15,
  play_order: 9,
  show_id: 100,
  message: "DJ left the show",
};

const genericMessageEntry: FlowsheetMessageEntry = {
  id: 16,
  play_order: 10,
  show_id: 100,
  message: "Generic notification message",
};

describe("ReadOnlyEntry", () => {
  it("renders every field for a song entry, both xl and below-xl copies", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} />);

    expect(screen.getAllByText(songEntry.artist_name)).toHaveLength(2);
    expect(screen.getAllByText(songEntry.album_title)).toHaveLength(1);
    expect(screen.getAllByText(songEntry.record_label)).toHaveLength(2);
    expect(screen.getByText(songEntry.track_title)).toBeInTheDocument();
  });

  it("gives the artist and label their own col-artist/col-label cells", () => {
    const { container } = renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} />
    );

    const colArtist = container.querySelector("td.col-artist");
    const colLabel = container.querySelector("td.col-label");
    expect(colArtist).not.toBeNull();
    expect(colLabel).not.toBeNull();
    expect(colArtist).toHaveTextContent(songEntry.artist_name);
    expect(colLabel).toHaveTextContent(songEntry.record_label);
  });

  it("wraps the stacked below-xl second lines in .field-second-line", () => {
    const { container } = renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} />
    );

    const secondLines = container.querySelectorAll(".field-second-line");
    expect(secondLines).toHaveLength(2);
    expect(secondLines[0]).toHaveTextContent(songEntry.artist_name);
    expect(secondLines[1]).toHaveTextContent(songEntry.record_label);
  });

  it("renders the read-only status chips, unhidden by editability", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} />);

    expect(screen.getByLabelText("Rotation H")).toBeInTheDocument();
    expect(screen.getByText("REQ")).toBeInTheDocument();
  });

  it.each<[string, FlowsheetSongEntry | FlowsheetShowBlockEntry | FlowsheetMessageEntry | FlowsheetBreakpointEntry, string]>([
    ["track", songEntry, songEntry.track_title],
    ["show_start", startShowEntry, startShowEntry.dj_name],
    ["show_end", endShowEntry, endShowEntry.dj_name],
    ["talkset", talksetEntry, talksetEntry.message],
    ["breakpoint", breakpointEntry, breakpointEntry.message],
    ["dj_join", djJoinEntry, djJoinEntry.message],
    ["dj_leave", djLeaveEntry, djLeaveEntry.message],
    ["message", genericMessageEntry, genericMessageEntry.message],
  ])("renders non-empty output for FlowsheetEntryType %s", (_type, entry, expectedText) => {
    const { container } = renderWithPublicProviders(
      <ReadOnlyEntry entry={entry} playing={false} />
    );

    expect(screen.getAllByText(expectedText).length).toBeGreaterThan(0);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("renders a marker's text in both the xl and below-xl middle cells", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={talksetEntry} playing={false} />);

    const copies = screen.getAllByText(talksetEntry.message);
    expect(copies).toHaveLength(2);

    const xlCell = copies[0].closest("td.col-marker-xl");
    const compactCell = copies[1].closest("td.col-marker-compact");
    expect(xlCell).toHaveAttribute("colspan", "4");
    expect(compactCell).toHaveAttribute("colspan", "2");
  });

  it("carries the leading Time cell when given a timeLabel", () => {
    renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} timeLabel="9:15 PM" />
    );

    expect(screen.getByText("9:15 PM").closest("td")).toHaveClass("col-time");
  });

  it("keeps the view-mode Tooltip that recovers a truncated value on hover", async () => {
    const user = userEvent.setup();
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} />);

    // The song field renders exactly once (unlike artist/label, it has no
    // below-xl second-line copy), so a second instance of its text only
    // appears once the Tooltip itself opens.
    expect(screen.getAllByText(songEntry.track_title)).toHaveLength(1);

    await user.hover(screen.getByText(songEntry.track_title));

    // findBy*/findAllBy* resolve on the first non-empty match, which the
    // row's own (pre-existing) text already satisfies -- waitFor is what
    // actually waits out the Tooltip's enterDelay for the second copy.
    await waitFor(() => {
      expect(screen.getAllByText(songEntry.track_title)).toHaveLength(2);
    });
  });
});

describe("ReadOnlyEntry highlighted prop", () => {
  it.each<
    [string, FlowsheetSongEntry | FlowsheetMessageEntry | FlowsheetShowBlockEntry]
  >([
    ["song", songEntry],
    ["marker", talksetEntry],
  ])(
    "marks a highlighted %s row with row-highlighted and the deep-link anchor id",
    (_kind, entry) => {
      const { rerender } = renderWithPublicProviders(
        <ReadOnlyEntry entry={entry} playing={false} />
      );

      const unhighlightedRow = screen.getByTestId(`flowsheet-entry-${entry.id}`);
      expect(unhighlightedRow).not.toHaveClass("row-highlighted");
      expect(unhighlightedRow).not.toHaveAttribute("id");

      rerender(<ReadOnlyEntry entry={entry} playing={false} highlighted />);

      const highlightedRow = screen.getByTestId(`flowsheet-entry-${entry.id}`);
      expect(highlightedRow).toHaveClass("row-highlighted");
      expect(highlightedRow).toHaveAttribute("id", `entry-${entry.id}`);
    }
  );
});

// FlowsheetColumnSizingRow declares 6 column units (4 below xl); every row
// type must total the same or fixed-layout sizing degrades. jsdom applies no
// media query, so both breakpoint copies of a field are always in the DOM —
// "visible" here means "FLOWSHEET_TABLE_SX would show this cell at this
// width", read off the same classes that rule keys on, not actual layout.
const XL_ONLY_TD_CLASSES = ["col-artist", "col-label", "col-marker-xl"];
const BELOW_XL_ONLY_TD_CLASSES = ["col-marker-compact"];

function visibleColumnUnits(row: HTMLElement, atXl: boolean): number {
  const cells = Array.from(
    row.querySelectorAll(":scope > td")
  ) as HTMLTableCellElement[];
  return cells.reduce((sum, td) => {
    const hiddenAtThisWidth = atXl
      ? BELOW_XL_ONLY_TD_CLASSES.some((c) => td.classList.contains(c))
      : XL_ONLY_TD_CLASSES.some((c) => td.classList.contains(c));
    return hiddenAtThisWidth ? sum : sum + (td.colSpan || 1);
  }, 0);
}

describe("ReadOnlyEntry column-unit parity with FlowsheetColumnSizingRow", () => {
  it("sums to 6 column units at xl and 4 below xl for a song row", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} />);
    const row = screen.getByTestId(`flowsheet-entry-${songEntry.id}`);

    expect(visibleColumnUnits(row, true)).toBe(6);
    expect(visibleColumnUnits(row, false)).toBe(4);
  });

  it("sums to 6 column units at xl and 4 below xl for a marker row", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={talksetEntry} playing={false} />);
    const row = screen.getByTestId(`flowsheet-entry-${talksetEntry.id}`);

    expect(visibleColumnUnits(row, true)).toBe(6);
    expect(visibleColumnUnits(row, false)).toBe(4);
  });
});

// SxProps's type admits a function/array/null, none of which the exported
// constant actually is — it's the plain rule map defined in tableStyles.tsx.
const tableSxRules = FLOWSHEET_TABLE_SX as Record<
  string,
  { display: { xs: string; xl: string } }
>;

describe("FLOWSHEET_TABLE_SX pins the breakpoint that hides each copy", () => {
  it("shows col-artist/col-label/col-marker-xl only at xl", () => {
    expect(tableSxRules["& .col-artist, & .col-label, & .col-marker-xl"]).toEqual({
      display: { xs: "none", xl: "table-cell" },
    });
  });

  it("shows the stacked .field-second-line copy only below xl", () => {
    expect(tableSxRules["& .field-second-line"]).toEqual({
      display: { xs: "block", xl: "none" },
    });
  });

  it("shows the compact marker cell only below xl", () => {
    expect(tableSxRules["& .col-marker-compact"]).toEqual({
      display: { xs: "table-cell", xl: "none" },
    });
  });
});

describe("ReadOnlyEntry matches the live Entry's xl cell text under readOnly", () => {
  const originalMatchMedia = window.matchMedia;
  const setXl = (isXl: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: isXl && query === FLOWSHEET_XL_QUERY,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  };
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  // The read-only row paints both breakpoint copies in one document (jsdom
  // applies no media query), so its below-xl echo — a song cell's nested
  // .field-second-line, or the marker's colSpan-2 cell — has to be stripped
  // before its xl-variant cell text lines up with the live row's single
  // xl-only render. Both rows render a song field through the same shared
  // EntryFieldText, which ends every value with a trailing non-breaking
  // space; trimmed here so the comparison isn't sensitized to that shared
  // formatting detail rather than to actual content.
  function xlCellTexts(row: HTMLElement): string[] {
    const cells = Array.from(row.querySelectorAll(":scope > td")) as HTMLTableCellElement[];
    return cells
      .filter((td) => !td.classList.contains("col-marker-compact"))
      .map((td) => {
        const clone = td.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".field-second-line").forEach((el) => el.remove());
        return (clone.textContent ?? "").replace(/ +$/, "").trim();
      });
  }

  it.each<[string, FlowsheetSongEntry | FlowsheetMessageEntry | FlowsheetBreakpointEntry | FlowsheetShowBlockEntry]>([
    ["track", songEntry],
    ["talkset", talksetEntry],
    ["breakpoint", breakpointEntry],
    ["show marker", startShowEntry],
  ])("renders the same xl cell text as the live Entry under readOnly for %s", (_type, entry) => {
    setXl(true);
    const live = renderWithProviders(<Entry entry={entry} playing={false} readOnly />);
    const liveTexts = xlCellTexts(live.getByTestId(`flowsheet-entry-${entry.id}`));
    live.unmount();

    const readOnly = renderWithPublicProviders(<ReadOnlyEntry entry={entry} playing={false} />);
    const readOnlyTexts = xlCellTexts(readOnly.getByTestId(`flowsheet-entry-${entry.id}`));

    expect(readOnlyTexts).toEqual(liveTexts);
  });
});

describe("ReadOnlyEntry matches the live Entry's variant/colour/class signature under readOnly", () => {
  // The signal a row's variant/colour resolve to: the class the fill-driving
  // ternaries add (row-playing, row-marker, row-highlighted), the custom
  // properties EntryRow paints the fill from, and the inline height. Compared
  // against the live row rather than hardcoded literals so the two can't
  // silently drift apart.
  function rowSignature(row: HTMLElement) {
    return {
      id: row.id,
      className: row.className,
      rowBg: row.style.getPropertyValue("--row-bg"),
      rowAccent: row.style.getPropertyValue("--row-accent"),
      height: row.style.height,
    };
  }

  it.each<[boolean, boolean]>([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "song row (playing: %s, highlighted: %s)",
    (playing, highlighted) => {
      const live = renderWithProviders(
        <Entry entry={songEntry} playing={playing} readOnly highlighted={highlighted} />
      );
      const liveSignature = rowSignature(live.getByTestId(`flowsheet-entry-${songEntry.id}`));
      live.unmount();

      const readOnly = renderWithPublicProviders(
        <ReadOnlyEntry entry={songEntry} playing={playing} highlighted={highlighted} />
      );
      const readOnlySignature = rowSignature(
        readOnly.getByTestId(`flowsheet-entry-${songEntry.id}`)
      );

      expect(readOnlySignature).toEqual(liveSignature);
    }
  );

  it.each<[boolean]>([[false], [true]])(
    // breakpointEntry, not talksetEntry: its own tone (warning) differs from
    // the highlighted override (danger), so the comparison can actually tell
    // the two apart -- a talkset's own tone already is danger.
    "marker row (highlighted: %s)",
    (highlighted) => {
      const live = renderWithProviders(
        <Entry entry={breakpointEntry} playing={false} readOnly highlighted={highlighted} />
      );
      const liveSignature = rowSignature(live.getByTestId(`flowsheet-entry-${breakpointEntry.id}`));
      live.unmount();

      const readOnly = renderWithPublicProviders(
        <ReadOnlyEntry entry={breakpointEntry} playing={false} highlighted={highlighted} />
      );
      const readOnlySignature = rowSignature(
        readOnly.getByTestId(`flowsheet-entry-${breakpointEntry.id}`)
      );

      expect(readOnlySignature).toEqual(liveSignature);
    }
  );
});

describe("ReadOnlyEntry matches the live Entry's other readOnly-invisible signals", () => {
  it("gives a marker row the leading Time cell too, like the live row", () => {
    const live = renderWithProviders(
      <Entry entry={talksetEntry} playing={false} readOnly timeLabel="9:15 PM" />
    );
    expect(
      live.getByTestId(`flowsheet-entry-${talksetEntry.id}`).firstElementChild
    ).toHaveClass("col-time");
    live.unmount();

    const readOnly = renderWithPublicProviders(
      <ReadOnlyEntry entry={talksetEntry} playing={false} timeLabel="9:15 PM" />
    );
    expect(
      readOnly.getByTestId(`flowsheet-entry-${talksetEntry.id}`).firstElementChild
    ).toHaveClass("col-time");
  });

  it("renders the same song artwork as the live row", () => {
    const live = renderWithProviders(<Entry entry={songEntry} playing={false} readOnly />);
    const liveImg = live
      .getByTestId(`flowsheet-entry-${songEntry.id}`)
      .querySelector("img");
    const liveSrc = liveImg?.getAttribute("src");
    const liveAlt = liveImg?.getAttribute("alt");
    live.unmount();

    const readOnly = renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} />);
    const readOnlyImg = readOnly
      .getByTestId(`flowsheet-entry-${songEntry.id}`)
      .querySelector("img");

    expect(readOnlyImg).not.toBeNull();
    expect(readOnlyImg?.getAttribute("src")).toBe(liveSrc);
    expect(readOnlyImg?.getAttribute("alt")).toBe(liveAlt);
  });

  it("renders the same marker icon as the live row", () => {
    const live = renderWithProviders(<Entry entry={talksetEntry} playing={false} readOnly />);
    const liveIcon = live
      .getByTestId(`flowsheet-entry-${talksetEntry.id}`)
      .querySelector("svg")
      ?.getAttribute("data-testid");
    live.unmount();

    const readOnly = renderWithPublicProviders(
      <ReadOnlyEntry entry={talksetEntry} playing={false} />
    );
    const readOnlyIcon = readOnly
      .getByTestId(`flowsheet-entry-${talksetEntry.id}`)
      .querySelector("svg")
      ?.getAttribute("data-testid");

    expect(readOnlyIcon).toBeTruthy();
    expect(readOnlyIcon).toBe(liveIcon);
  });

  // entryFieldTextColor switches the title field's text to white when
  // playing; comparing getComputedStyle's resolved `color` (a CSS variable
  // reference, not a hash) against the live row catches a row that stops
  // threading `playing` through, not just one that renders a wrong literal.
  it("gives the title field the same playing-aware text colour as the live row", () => {
    const live = renderWithProviders(<Entry entry={songEntry} playing readOnly />);
    const liveTitle = within(
      live.getByTestId(`flowsheet-entry-${songEntry.id}`)
    ).getByText(songEntry.track_title);
    const liveColor = getComputedStyle(liveTitle).color;
    live.unmount();

    const readOnly = renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing />);
    const readOnlyTitle = within(
      readOnly.getByTestId(`flowsheet-entry-${songEntry.id}`)
    ).getByText(songEntry.track_title);

    expect(getComputedStyle(readOnlyTitle).color).toBe(liveColor);
  });

  // Typography's level ("title-sm", "body-sm", ...) surfaces as a literal
  // MuiTypography-<level> class, so comparing it against the live row catches
  // a field pinned to the wrong level without hardcoding which level each
  // field should be.
  it("keeps each field's own text level, not one level forced across the row", () => {
    const levelClass = (el: Element) =>
      Array.from(el.classList).find((c) => /^MuiTypography-(h\d|title-|body-)/.test(c));

    // The live row only mounts col-artist at xl; ReadOnlyEntry mounts it
    // unconditionally and leaves hiding it below xl to FLOWSHEET_TABLE_SX, so
    // the live row needs the same breakpoint forced on to have a col-artist
    // cell to compare against.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === FLOWSHEET_XL_QUERY,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    try {
      const live = renderWithProviders(<Entry entry={songEntry} playing={false} readOnly />);
      const liveRow = live.getByTestId(`flowsheet-entry-${songEntry.id}`);
      const liveTitleLevel = levelClass(within(liveRow).getByText(songEntry.track_title));
      const liveArtistLevel = levelClass(
        within(liveRow.querySelector("td.col-artist")!).getByText(songEntry.artist_name)
      );
      live.unmount();

      const readOnly = renderWithPublicProviders(
        <ReadOnlyEntry entry={songEntry} playing={false} />
      );
      const readOnlyRow = readOnly.getByTestId(`flowsheet-entry-${songEntry.id}`);
      const readOnlyTitleLevel = levelClass(within(readOnlyRow).getByText(songEntry.track_title));
      const readOnlyArtistLevel = levelClass(
        within(readOnlyRow.querySelector("td.col-artist")!).getByText(songEntry.artist_name)
      );

      expect(readOnlyTitleLevel).toBe(liveTitleLevel);
      expect(readOnlyArtistLevel).toBe(liveArtistLevel);
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
