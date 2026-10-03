import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { renderWithPublicProviders, renderWithProviders } from "@/tests/helpers/render";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import ReadOnlyEntry, {
  SHOW_LINK_Z_INDEX,
} from "@/src/components/experiences/modern/flowsheet/Entries/ReadOnly/ReadOnlyEntry";
import {
  FLOWSHEET_TABLE_SX,
  FLOWSHEET_XL_QUERY,
  flowsheetChipsReservePx,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import {
  FlowsheetBreakpointEntry,
  FlowsheetMessageEntry,
  FlowsheetShowBlockEntry,
  FlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { convertV2Entry } from "@/lib/features/flowsheet/conversions";
import {
  V2_ENTRY_FACTORIES_BY_TYPE,
  createTestFlowsheetEntry,
} from "@/tests/fixtures/fixtures";

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
  entry_type: "show_start",
  dj_name: "DJ Juana",
  day: "Monday",
  time: "10:00 PM",
  isStart: true,
};

const talksetEntry: FlowsheetMessageEntry = {
  id: 12,
  play_order: 5,
  show_id: 100,
  entry_type: "talkset",
  message: "Talkset - Station ID",
};

const breakpointEntry: FlowsheetBreakpointEntry = {
  id: 13,
  play_order: 7,
  show_id: 100,
  entry_type: "breakpoint",
  message: "Breakpoint - Hour Mark",
  day: "Monday",
  time: "11:00 PM",
};

// Every-entry-type cases, built through the V2 factory for each kind so no
// row is hand-built. `overrides` carries what the kind's text comes from;
// `text` is what its row must render. Keyed by the contract enum, so a new
// kind fails `tsc` here until it has a case.
const ENTRY_TYPE_CASES = {
  track: { overrides: { track_title: "Track title" }, text: "Track title" },
  show_start: { overrides: { dj_name: "DJ Juana" }, text: "DJ Juana" },
  show_end: { overrides: { dj_name: "DJ Juana" }, text: "DJ Juana" },
  dj_join: { overrides: { dj_name: "DJ Marz" }, text: "DJ Marz" },
  dj_leave: { overrides: { dj_name: "DJ Marz" }, text: "DJ Marz" },
  talkset: { overrides: { message: "Talkset - Station ID" }, text: "Talkset - Station ID" },
  breakpoint: { overrides: { message: "3:00 PM Breakpoint", radio_hour: null }, text: "3:00 PM Breakpoint" },
  message: { overrides: { message: "Generic notification message" }, text: "Generic notification message" },
} satisfies Record<FlowsheetEntryType, { overrides: object; text: string }>;

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

  it.each(Object.values(FlowsheetEntryType))("renders non-empty output for FlowsheetEntryType %s", (type) => {
    const { overrides, text } = ENTRY_TYPE_CASES[type];
    const entry = convertV2Entry(V2_ENTRY_FACTORIES_BY_TYPE[type](overrides));
    const { container } = renderWithPublicProviders(
      <ReadOnlyEntry entry={entry} playing={false} />
    );

    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
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

describe("ReadOnlyEntry albumInfo prop", () => {
  it("renders no album information control by default, and reserves no room for one", () => {
    const { container } = renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} />
    );

    expect(
      screen.queryByRole("button", { name: "Album information" })
    ).not.toBeInTheDocument();
    const chips = container.querySelector("tr")?.lastElementChild?.firstElementChild;
    if (!(chips instanceof HTMLElement)) throw new Error("no chip strip");
    expect(getComputedStyle(chips).paddingRight).not.toBe(
      `${flowsheetChipsReservePx(false)}px`
    );
  });

  it("renders the album information control, enabled, when asked for a linked entry", () => {
    renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} albumInfo />
    );

    expect(
      screen.getByRole("button", { name: "Album information" })
    ).toHaveProperty("disabled", false);
  });

  // The control sits over the chip cell's right edge, so the chips must keep
  // clear of it, and it must stay clickable above a row-wide overlay link.
  it("keeps the chips clear of the control and leaves the control clickable", () => {
    renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} albumInfo />
    );

    const button = screen.getByRole("button", { name: "Album information" });
    const cell = button.closest("td");
    const chips = cell?.firstElementChild;
    if (!(chips instanceof HTMLElement)) throw new Error("no chip strip");
    expect(getComputedStyle(chips).paddingRight).toBe(
      `${flowsheetChipsReservePx(false)}px`
    );

    for (
      let el: HTMLElement | null = button;
      el !== null && el !== cell;
      el = el.parentElement
    ) {
      const style = getComputedStyle(el);
      expect(style.pointerEvents).not.toBe("none");
      expect(Number.parseInt(style.zIndex, 10) || 0).toBeGreaterThanOrEqual(0);
    }
  });

  it("disables the album information control for a row with no album_id", () => {
    const unlinked = createTestFlowsheetEntry({ ...songEntry, album_id: undefined });
    renderWithPublicProviders(
      <ReadOnlyEntry entry={unlinked} playing={false} albumInfo />
    );

    expect(
      screen.getByRole("button", { name: "Album information" })
    ).toHaveProperty("disabled", true);
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

const SHOW_HREF = "/dashboard/archive/show/100#entry-3001";

// jsdom computes no pseudo-element styles, so the overlay's level is read from
// the `::after` rules Emotion wrote for the link's own class, last one winning.
// NaN unless one of those rules is Joy's overlay box: the row's own `::after`
// level is written whether or not the link is an overlay at all.
function overlayZIndex(link: HTMLElement): number {
  const selectors = Array.from(link.classList, (name) => `.${name}::after`);
  let zIndex = Number.NaN;
  let stretched = false;
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      if (!rule.selectorText.split(",").some((s) => selectors.includes(s.trim()))) continue;
      if (rule.style.position === "absolute") stretched = true;
      if (rule.style.zIndex !== "") zIndex = Number(rule.style.zIndex);
    }
  }
  return stretched ? zIndex : Number.NaN;
}

function zIndexOf(element: Element): number {
  return Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;
}

function renderLinkedSongRow(entry: FlowsheetSongEntry = songEntry, albumInfo = false) {
  return renderWithPublicProviders(
    <ReadOnlyEntry
      entry={entry}
      playing={false}
      timeLabel="9:15 PM"
      showHref={SHOW_HREF}
      albumInfo={albumInfo}
    />
  );
}

describe("ReadOnlyEntry showHref prop", () => {
  it.each<[string, string, string]>([
    ["with a time", "9:15 PM", `9:15 PM — see the full show for ${songEntry.track_title} by ${songEntry.artist_name}`],
    ["without a time", "", `See the full show for ${songEntry.track_title} by ${songEntry.artist_name}`],
  ])("links a song row %s, named for the show", (_label, timeLabel, name) => {
    renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} timeLabel={timeLabel} showHref={SHOW_HREF} />
    );

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(name);
    expect(links[0]).toHaveAttribute("href", SHOW_HREF);
    expect(links[0].closest("td")).toHaveClass("col-time");
    expect(links[0]).toHaveTextContent(timeLabel);
  });

  it.each<[string, { showHref?: null }]>([
    ["no showHref", {}],
    ["a null showHref", { showHref: null }],
  ])("renders no link for %s, leaving the Time cell unlinked", (_label, extra) => {
    renderWithPublicProviders(
      <ReadOnlyEntry entry={songEntry} playing={false} timeLabel="9:15 PM" {...extra} />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("9:15 PM").closest("td")).toHaveClass("col-time");
  });

  const markerTypes = Object.values(FlowsheetEntryType).filter((type) => type !== "track");
  it.each(markerTypes)("renders no link on a %s row, even with a showHref", (type) => {
    const entry = convertV2Entry(V2_ENTRY_FACTORIES_BY_TYPE[type](ENTRY_TYPE_CASES[type].overrides));
    renderWithPublicProviders(
      <ReadOnlyEntry entry={entry} playing={false} timeLabel="9:15 PM" showHref={SHOW_HREF} />
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("rejects a showHref without a timeLabel at the type level", () => {
    // @ts-expect-error a link needs the Time cell it sits in
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} showHref={SHOW_HREF} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const row = screen.getByTestId(`flowsheet-entry-${songEntry.id}`);
    expect(getComputedStyle(row).position).not.toBe("relative");
  });

  it("makes the linked row its own stacking context, and leaves its Time cell unpositioned", () => {
    renderLinkedSongRow();

    const row = screen.getByTestId(`flowsheet-entry-${songEntry.id}`);
    expect(getComputedStyle(row).position).toBe("relative");
    expect(getComputedStyle(row).isolation).toBe("isolate");
    expect(["", "static"]).toContain(getComputedStyle(screen.getByRole("link").closest("td")!).position);
  });

  it("puts the overlay above the row's positioned cells", () => {
    renderLinkedSongRow();

    const overlay = overlayZIndex(screen.getByRole("link"));
    expect(overlay).toBe(SHOW_LINK_Z_INDEX);
    const row = screen.getByTestId(`flowsheet-entry-${songEntry.id}`);
    const positionedCells = Array.from(row.querySelectorAll(":scope > td")).filter(
      (cell) => getComputedStyle(cell).position === "relative"
    );
    expect(positionedCells).toHaveLength(2);
    for (const cell of positionedCells) expect(zIndexOf(cell)).toBeLessThan(overlay);
  });

  it("leaves an unlinked row unpositioned and unisolated", () => {
    renderWithPublicProviders(<ReadOnlyEntry entry={songEntry} playing={false} timeLabel="9:15 PM" />);

    const row = screen.getByTestId(`flowsheet-entry-${songEntry.id}`);
    expect(getComputedStyle(row).position).not.toBe("relative");
    expect(getComputedStyle(row).isolation).not.toBe("isolate");
  });

  it.each<string>([songEntry.track_title, songEntry.artist_name, songEntry.album_title, songEntry.record_label])(
    "raises every copy of the field %s above the show link",
    (value) => {
      renderLinkedSongRow();

      const overlay = overlayZIndex(screen.getByRole("link"));
      const copies = screen.getAllByText(value);
      expect(copies.length).toBeGreaterThan(0);
      for (const copy of copies) {
        expect(getComputedStyle(copy)).toMatchObject({
          position: "relative",
          width: "fit-content",
          maxWidth: "100%",
          cursor: "pointer",
        });
        expect(zIndexOf(copy)).toBeGreaterThan(overlay);
      }
    }
  );

  it("raises the Not-on-Discogs artwork cell above the show link", () => {
    const unavailable = createTestFlowsheetEntry({ ...songEntry, discogsUnavailable: true });
    renderLinkedSongRow(unavailable);

    const artworkCell = screen.getByTestId(`flowsheet-entry-${unavailable.id}`).querySelector(":scope > td:nth-child(2)");
    if (!(artworkCell instanceof HTMLElement)) throw new Error("no artwork cell");
    expect(zIndexOf(artworkCell)).toBeGreaterThan(overlayZIndex(screen.getByRole("link")));
  });

  it("leaves ordinary artwork under the show link", () => {
    renderLinkedSongRow();

    const artworkCell = screen.getByTestId(`flowsheet-entry-${songEntry.id}`).querySelector(":scope > td:nth-child(2)");
    if (!(artworkCell instanceof HTMLElement)) throw new Error("no artwork cell");
    expect(zIndexOf(artworkCell)).toBeLessThan(overlayZIndex(screen.getByRole("link")));
  });

  it("raises the album control's wrapper above the show link and keeps the control enabled", () => {
    renderLinkedSongRow(songEntry, true);

    const button = screen.getByRole("button", { name: "Album information" });
    expect(button).toHaveProperty("disabled", false);
    expect(zIndexOf(button.parentElement!)).toBeGreaterThan(overlayZIndex(screen.getByRole("link")));
  });

  it("leaves an unlinked row's fields, artwork cell and album control at their own level", () => {
    const unavailable = createTestFlowsheetEntry({ ...songEntry, discogsUnavailable: true });
    renderWithPublicProviders(
      <ReadOnlyEntry entry={unavailable} playing={false} timeLabel="9:15 PM" albumInfo />
    );

    const row = screen.getByTestId(`flowsheet-entry-${unavailable.id}`);
    const artworkCell = row.querySelector(":scope > td:nth-child(2)")!;
    const albumWrapper = screen.getByRole("button", { name: "Album information" }).parentElement!;
    const fields = [songEntry.track_title, songEntry.artist_name, songEntry.album_title, songEntry.record_label]
      .flatMap((value) => screen.getAllByText(value));
    for (const element of [artworkCell, albumWrapper, ...fields]) {
      expect(["", "auto"]).toContain(getComputedStyle(element).zIndex);
    }
    for (const field of fields) {
      expect(getComputedStyle(field).position).not.toBe("relative");
      expect(getComputedStyle(field).width).not.toBe("fit-content");
      expect(getComputedStyle(field).cursor).not.toBe("pointer");
    }
  });

  it("keeps a raised field's tooltip opening on hover", async () => {
    const user = userEvent.setup();
    renderLinkedSongRow();

    await user.hover(screen.getByText(songEntry.track_title));

    await waitFor(() => {
      expect(screen.getAllByText(songEntry.track_title)).toHaveLength(2);
    });
  });

  it.each<[string, MouseEventInit, number]>([
    ["plain primary click", {}, 1],
    ["metaKey click", { metaKey: true }, 0],
    ["ctrlKey click", { ctrlKey: true }, 0],
    ["shiftKey click", { shiftKey: true }, 0],
    ["altKey click", { altKey: true }, 0],
    ["middle-button click", { button: 1 }, 0],
  ])("applies the forwarding rule to a field's %s", (_label, init, calls) => {
    renderLinkedSongRow();
    const link = screen.getByRole("link");
    // No app router is mounted, so stop the document navigation jsdom cannot do.
    link.addEventListener("click", (event) => event.preventDefault());
    const clickSpy = vi.spyOn(link, "click");

    fireEvent.click(screen.getByText(songEntry.track_title), init);

    expect(clickSpy).toHaveBeenCalledTimes(calls);
    clickSpy.mockRestore();
  });

  it("does not forward a field click that ends a text selection", () => {
    renderLinkedSongRow();
    const clickSpy = vi.spyOn(screen.getByRole("link"), "click");
    const field = screen.getByText(songEntry.track_title);

    const range = document.createRange();
    range.selectNodeContents(field);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    fireEvent.click(field);
    window.getSelection()?.removeAllRanges();

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
