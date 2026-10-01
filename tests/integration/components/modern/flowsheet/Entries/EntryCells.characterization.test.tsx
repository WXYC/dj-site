import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Reorder } from "motion/react";
import { fireEvent, screen, act } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import {
  FlowsheetSongEntry,
  FlowsheetMessageEntry,
  FlowsheetBreakpointEntry,
  FlowsheetShowBlockEntry,
} from "@/lib/features/flowsheet/types";

/**
 * Pins what DraggableEntryWrapper.characterization.test.tsx deliberately
 * leaves out: the cells inside the row, not just its own opening tag. For
 * every row kind this covers -- how many cells render, their order, classes
 * and colSpan -- plus the exact markup (generated class names included) of
 * the subtrees three sibling modules own: EntryFieldText.tsx (a song row's
 * four field texts, including the Tooltip it wraps them in), EntryArtwork.tsx
 * (a song row's artwork and a message row's marker artwork), and
 * messageEntrySlots.tsx (a message row's end-decorator date/time and its
 * headline/caption block). Each of those modules must reproduce this markup
 * byte-for-byte; this spec is what makes "byte-for-byte" checkable instead of
 * asserted.
 *
 * Only the data hooks (live-show state, flowsheet mutations) and routing are
 * stubbed; every presentational component between `Entry` and the row stays
 * real, so what's pinned below is whatever the real tree actually renders,
 * not a hand-written transcription of it.
 */

const mockUseShowControl = vi.fn();
const mockUseLiveStatus = vi.fn();
const mockUseFlowsheetActions = vi.fn();

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => mockUseShowControl(),
  useLiveStatus: () => mockUseLiveStatus(),
  useFlowsheetActions: () => mockUseFlowsheetActions(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const SONG_ENTRY: FlowsheetSongEntry = {
  id: 1,
  play_order: 0,
  show_id: 100,
  track_title: "la paradoja",
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  request_flag: false,
  segue: false,
};

const SONG_ENTRY_WITH_ARTWORK: FlowsheetSongEntry = {
  id: 5,
  play_order: 4,
  show_id: 100,
  track_title: "Back, Baby",
  artist_name: "Jessica Pratt",
  album_title: "On Your Own Love Again",
  record_label: "Drag City",
  request_flag: false,
  segue: false,
  artwork_url: "/test-album-art.jpg",
};

// Distinguishes EntryArtwork.tsx's `entry.artwork_url ?? fallback` from a
// `||` rewrite: an empty string is defined (so `??` keeps it, rendering an
// `<img>` with no `src`) but falsy (so `||` would replace it with the
// cassette placeholder).
const SONG_ENTRY_EMPTY_ARTWORK_URL: FlowsheetSongEntry = {
  ...SONG_ENTRY,
  id: 6,
  artwork_url: "",
};

const SONG_ENTRY_NOT_ON_DISCOGS: FlowsheetSongEntry = {
  id: 7,
  play_order: 5,
  show_id: 100,
  track_title: "Call Your Name",
  artist_name: "Chuquimamani-Condori",
  album_title: "Edits",
  record_label: "self-released",
  request_flag: false,
  segue: false,
  discogsUnavailable: true,
  discogsUnavailableNote: "No Discogs match found",
};

const TALKSET_ENTRY: FlowsheetMessageEntry = {
  id: 2,
  play_order: 1,
  show_id: 100,
  message: "Talkset",
};

const BREAKPOINT_ENTRY: FlowsheetBreakpointEntry = {
  id: 3,
  play_order: 2,
  show_id: 100,
  message: "Breakpoint",
  day: "Monday",
  time: "11:00 PM",
};

const MARKER_ENTRY: FlowsheetShowBlockEntry = {
  id: 4,
  play_order: 3,
  show_id: 100,
  dj_name: "DJ Test",
  day: "Monday",
  time: "10:00 PM",
  isStart: true,
  isToday: false,
};

const MARKER_ENTRY_TODAY: FlowsheetShowBlockEntry = {
  ...MARKER_ENTRY,
  isToday: true,
};

// Mirrors the live flowsheet page: a row requested as draggable mounts inside
// a real Reorder.Group; a row requested as non-draggable (the archive's
// previous-shows tbody, and every "readOnly" case here, since Entry forces
// resolvedDraggable false whenever readOnly is true) renders in a plain
// tbody outside the motion tree entirely.
function renderRow(
  entry: FlowsheetSongEntry | FlowsheetMessageEntry | FlowsheetShowBlockEntry,
  draggable: boolean,
  readOnly: boolean
): HTMLTableRowElement {
  const rows = (
    <Entry entry={entry} playing={false} draggable={draggable} readOnly={readOnly} />
  );
  const table = draggable ? (
    <table>
      <Reorder.Group as="tbody" axis="y" values={[entry]} onReorder={() => {}}>
        {rows}
      </Reorder.Group>
    </table>
  ) : (
    <table>
      <tbody>{rows}</tbody>
    </table>
  );
  const { container } = renderWithProviders(table);
  const row = container.querySelector(`[data-testid="flowsheet-entry-${entry.id}"]`);
  if (!(row instanceof HTMLTableRowElement)) {
    throw new Error(`Expected a <tr> for entry ${entry.id}, found ${row?.tagName ?? "nothing"}.`);
  }
  return row;
}

type CellShape = { tag: string; className: string; colSpan: string | null };

function cellShapes(row: HTMLTableRowElement): CellShape[] {
  return Array.from(row.children).map((cell) => ({
    tag: cell.tagName,
    className: cell.className,
    colSpan: cell.getAttribute("colspan"),
  }));
}

// The AspectRatio EntryArtwork.tsx owns (SongEntryArtwork for a song row,
// MarkerEntryArtwork for a message row): the row's first cell always holds
// it, directly for a message row's marker icon or inside SongEntry's
// drag-handling Stack for a song row, whether or not a drag grip also
// renders there.
function artworkHtml(row: HTMLTableRowElement): string | undefined {
  return row.children[0].querySelector(".MuiAspectRatio-root")?.outerHTML;
}

// The Tooltip+Typography EntryFieldText.tsx owns. Joy's Tooltip clones its
// single child rather than wrapping it, so the element this finds (by the
// full-value aria-label the live Tooltip sets) is already the exact node
// EntryFieldText renders -- no wrapper to strip first.
function fieldHtml(row: HTMLTableRowElement, value: string): string | undefined {
  return row.querySelector(`[aria-label="${value}"]`)?.outerHTML;
}

// The headline/caption Stack getMessageEntrySlots builds in
// messageEntrySlots.tsx: always the direct (and only) child of the row's
// middle cell.
function messageBlockHtml(row: HTMLTableRowElement): string | undefined {
  return row.children[1].firstElementChild?.outerHTML;
}

// The Typography getMessageEntrySlots fills with the DateTimeStack end
// decorator (or with nothing, for a row kind with no `time`): the first
// child of the row's third cell's Stack, whether or not a RemoveButton also
// renders beside it there.
function endDecoratorHtml(row: HTMLTableRowElement): string | undefined {
  return row.children[2].firstElementChild?.firstElementChild?.outerHTML;
}

const SONG_ARTWORK_HTML =
  '<div class="MuiAspectRatio-root css-1stm5m6-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantSoft MuiAspectRatio-colorNeutral css-6e7lq1-JoyAspectRatio-content"><img alt="album art" style="min-width: 48px; min-height: 48px;" data-first-child="" src="/img/cassette.png"></div></div>';

const SONG_ARTWORK_WITH_URL_HTML =
  '<div class="MuiAspectRatio-root css-1stm5m6-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantSoft MuiAspectRatio-colorNeutral css-6e7lq1-JoyAspectRatio-content"><img alt="album art" style="min-width: 48px; min-height: 48px;" data-first-child="" src="/test-album-art.jpg"></div></div>';

// No `src` attribute at all: React drops an empty string rather than
// emitting `src=""`. If `EntryArtwork.tsx`'s `??` ever became `||`, an empty
// (but defined) artwork_url would instead fall back to the cassette
// placeholder's `src="/img/cassette.png"`.
const SONG_ARTWORK_EMPTY_URL_HTML =
  '<div class="MuiAspectRatio-root css-1stm5m6-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantSoft MuiAspectRatio-colorNeutral css-6e7lq1-JoyAspectRatio-content"><img alt="album art" style="min-width: 48px; min-height: 48px;" data-first-child=""></div></div>';

const NOT_ON_DISCOGS_ARTWORK_HTML =
  '<div class="MuiAspectRatio-root css-1stm5m6-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantSoft MuiAspectRatio-colorNeutral css-6e7lq1-JoyAspectRatio-content"><div class="MuiBox-root css-o0p7yw" aria-label="Not on Discogs"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-1vcqpmp-MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="BlockOutlinedIcon"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2M4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12m8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8"></path></svg><span class="MuiTypography-root MuiTypography-body-xs css-15lyvrs-JoyTypography-root">Not on Discogs</span></div></div></div>';

// The empty end decorator every message row renders when
// getMessageEntryPresentation gives it no `time` (talkset, breakpoint, and
// generic messages -- only the two show markers carry `time`).
const EMPTY_END_DECORATOR_HTML =
  '<span class="MuiTypography-root MuiTypography-body-xs css-h7h2qx-JoyTypography-root"></span>';

const MARKER_END_DECORATOR_NOT_TODAY_HTML =
  '<span class="MuiTypography-root MuiTypography-body-xs css-h7h2qx-JoyTypography-root"><div class="MuiStack-root css-qmy8nh-JoyStack-root"><span class="MuiTypography-root MuiTypography-body-xs css-e3eix1-JoyTypography-root">10:00 PM</span><span class="MuiTypography-root MuiTypography-body-xxs css-cylgzm-JoyTypography-root">Monday</span></div></span>';

const MARKER_END_DECORATOR_TODAY_HTML =
  '<span class="MuiTypography-root MuiTypography-body-xs css-h7h2qx-JoyTypography-root"><div class="MuiStack-root css-qmy8nh-JoyStack-root"><span class="MuiTypography-root MuiTypography-body-xs css-e3eix1-JoyTypography-root">10:00 PM</span></div></span>';

// Point jsdom's matchMedia at the xl breakpoint (the vitest setup's global
// mock always matches false, i.e. sub-xl). Mirrors SongEntry.test.tsx's
// "Column order" helper of the same name.
const originalMatchMedia = window.matchMedia;
function setXl(isXl: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isXl && query === "(min-width: 1536px)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

describe("Entry row cells (characterization)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShowControl.mockReturnValue({ live: true, autoplay: false, currentShow: 100 });
    mockUseLiveStatus.mockReturnValue({
      live: true,
      loading: false,
      userData: { id: "test-dj" },
      userloading: false,
    });
    mockUseFlowsheetActions.mockReturnValue({
      addToFlowsheet: vi.fn().mockResolvedValue(undefined),
      removeFromFlowsheet: vi.fn(),
      updateFlowsheet: vi.fn(),
      switchEntries: vi.fn(),
      removeFromQueue: vi.fn(),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.useRealTimers();
  });

  describe("song", () => {
    const SONG_CELLS: CellShape[] = [
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "", colSpan: null },
    ];

    it("readOnly", () => {
      const row = renderRow(SONG_ENTRY, false, true);

      expect(cellShapes(row)).toEqual(SONG_CELLS);
      expect(artworkHtml(row)).toBe(SONG_ARTWORK_HTML);
      expect(fieldHtml(row, "la paradoja")).toBe(
        '<p aria-label="la paradoja" class="MuiTypography-root MuiTypography-title-sm css-124gg8z-JoyTypography-root">la paradoja&nbsp;</p>'
      );
      expect(fieldHtml(row, "Juana Molina")).toBe(
        '<span aria-label="Juana Molina" class="MuiTypography-root MuiTypography-body-xs css-1xj2hey-JoyTypography-root">Juana Molina&nbsp;</span>'
      );
      expect(fieldHtml(row, "DOGA")).toBe(
        '<p aria-label="DOGA" class="MuiTypography-root MuiTypography-body-sm css-billxu-JoyTypography-root">DOGA&nbsp;</p>'
      );
      expect(fieldHtml(row, "Sonamos")).toBe(
        '<span aria-label="Sonamos" class="MuiTypography-root MuiTypography-body-xs css-1xj2hey-JoyTypography-root">Sonamos&nbsp;</span>'
      );
    });

    // canEdit (live && editable) changes the field's own cursor declaration,
    // which changes its generated class: a shared field component that
    // reorders or drops that declaration relative to its sx neighbors would
    // silently restyle every live field. The artwork is unaffected: it
    // carries no editing state of its own.
    it("editable + draggable", () => {
      const row = renderRow(SONG_ENTRY, true, false);

      expect(cellShapes(row)).toEqual(SONG_CELLS);
      expect(artworkHtml(row)).toBe(SONG_ARTWORK_HTML);
      expect(fieldHtml(row, "la paradoja")).toBe(
        '<p aria-label="la paradoja" class="MuiTypography-root MuiTypography-title-sm css-1wnp3kj-JoyTypography-root">la paradoja&nbsp;</p>'
      );
      expect(fieldHtml(row, "Juana Molina")).toBe(
        '<span aria-label="Juana Molina" class="MuiTypography-root MuiTypography-body-xs css-y6ceb6-JoyTypography-root">Juana Molina&nbsp;</span>'
      );
      expect(fieldHtml(row, "DOGA")).toBe(
        '<p aria-label="DOGA" class="MuiTypography-root MuiTypography-body-sm css-1kzpq29-JoyTypography-root">DOGA&nbsp;</p>'
      );
      expect(fieldHtml(row, "Sonamos")).toBe(
        '<span aria-label="Sonamos" class="MuiTypography-root MuiTypography-body-xs css-y6ceb6-JoyTypography-root">Sonamos&nbsp;</span>'
      );

      // Depends on `renderRow`'s own `draggable` argument actually reaching
      // Entry: a drag grip renders in the first cell only when both this
      // row is editable and `draggable` is true. SongEntry.tsx keeps it a
      // sibling of the artwork's Stack, ahead of it, not inside it.
      expect(row.children[0].children[0]).toHaveClass("drag-grip");
      const stack = row.children[0].children[1];
      expect(stack).toHaveClass("MuiStack-root");
      expect(stack.children[0]).toHaveClass("MuiAspectRatio-root");
    });

    it("uses a real artwork_url instead of the cassette placeholder", () => {
      const row = renderRow(SONG_ENTRY_WITH_ARTWORK, false, true);

      expect(artworkHtml(row)).toBe(SONG_ARTWORK_WITH_URL_HTML);
    });

    it("omits the img src rather than falling back, for an empty (but defined) artwork_url", () => {
      const row = renderRow(SONG_ENTRY_EMPTY_ARTWORK_URL, false, true);

      expect(artworkHtml(row)).toBe(SONG_ARTWORK_EMPTY_URL_HTML);
    });

    it("renders the Not-on-Discogs badge instead of artwork, with the MD note as its tooltip title", async () => {
      const row = renderRow(SONG_ENTRY_NOT_ON_DISCOGS, false, true);

      expect(artworkHtml(row)).toBe(NOT_ON_DISCOGS_ARTWORK_HTML);

      vi.useFakeTimers();
      const badge = row.querySelector('[aria-label="Not on Discogs"]');
      if (!badge) throw new Error("Expected the Not-on-Discogs badge to render.");
      fireEvent.mouseOver(badge);
      await act(async () => {
        vi.advanceTimersByTime(150);
      });
      expect(screen.getByRole("tooltip")).toHaveTextContent("No Discogs match found");

      // Joy's Tooltip tracks a cross-instance "hysteresis" window (an
      // immediate reopen within 800ms of a close skips the next enterDelay)
      // in module-level state. Left open, this tooltip would make a later
      // test's Tooltip open before its own enterDelay elapses; close it and
      // let that window lapse before the test ends.
      fireEvent.mouseLeave(badge);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    });

    it("splits artist and label into their own columns at xl", () => {
      setXl(true);
      const row = renderRow(SONG_ENTRY, false, true);

      expect(cellShapes(row)).toEqual([
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "col-artist", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "col-label", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
      ]);
    });
  });

  describe("field Tooltip", () => {
    // EntryFieldText.tsx's Tooltip config: placement="top-start",
    // enterDelay={400}, variant="outlined", size="sm". Pinned by opening it
    // rather than reading props off the source, so a changed value is
    // caught by what actually renders.
    it("stays closed until 400ms, then opens with the pinned placement, variant and size", async () => {
      const row = renderRow(SONG_ENTRY, false, true);
      const field = row.querySelector('[aria-label="la paradoja"]');
      if (!field) throw new Error("Expected the song-title field to render.");

      vi.useFakeTimers();
      fireEvent.mouseOver(field);

      await act(async () => {
        vi.advanceTimersByTime(399);
      });
      expect(screen.queryByRole("tooltip")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(2);
      });
      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toHaveTextContent("la paradoja");
      expect(tooltip).toHaveAttribute("data-popper-placement", "top-start");
      expect(tooltip).toHaveClass("MuiTooltip-variantOutlined");
      expect(tooltip).toHaveClass("MuiTooltip-sizeSm");

      // See the matching comment in the Not-on-Discogs test: close this
      // tooltip and let the hysteresis window lapse so it can't shortcut a
      // later test's enterDelay.
      fireEvent.mouseLeave(field);
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    });
  });

  describe("talkset", () => {
    const MESSAGE_CELLS: CellShape[] = [
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "MuiBox-root css-0", colSpan: "2" },
      { tag: "TD", className: "", colSpan: null },
    ];
    const TALKSET_ARTWORK_HTML =
      '<div class="MuiAspectRatio-root css-4mstob-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantPlain MuiAspectRatio-colorNeutral css-1dbufxu-JoyAspectRatio-content"><p data-first-child="" class="MuiTypography-root MuiTypography-body-md css-ff7dcq-JoyTypography-root"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-5pnok8-MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="MicIcon"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3m5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72z"></path></svg></p></div></div>';
    const TALKSET_MESSAGE_HTML =
      '<div class="MuiStack-root css-ktu002-JoyStack-root"><p class="MuiTypography-root MuiTypography-body-lg MuiTypography-colorDanger css-lo7d5y-JoyTypography-root">Talkset</p></div>';

    it("readOnly", () => {
      const row = renderRow(TALKSET_ENTRY, false, true);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(TALKSET_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(TALKSET_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(EMPTY_END_DECORATOR_HTML);
    });

    // The headline/caption block carries no editing state of its own (only
    // the end cell's RemoveButton does, out of scope for this spec), so it's
    // identical to the readOnly case; pinned again here so a future change
    // that makes the block editable-aware is caught in both forms.
    it("editable + draggable", () => {
      const row = renderRow(TALKSET_ENTRY, true, false);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(TALKSET_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(TALKSET_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(EMPTY_END_DECORATOR_HTML);

      // A talkset is editable, unlike a show marker, so this is where
      // MessageEntry.tsx actually mounts a drag grip beside the artwork --
      // depends on `renderRow`'s `draggable` argument the same way the song
      // case above does.
      expect(row.children[0].children[0]).toHaveClass("drag-grip");
      expect(row.children[0].children[1]).toHaveClass("MuiAspectRatio-root");
    });

    it("spans the middle cell across 4 columns at xl (2 below it)", () => {
      setXl(true);
      const row = renderRow(TALKSET_ENTRY, false, true);

      expect(row.children[1].getAttribute("colspan")).toBe("4");
    });
  });

  describe("breakpoint", () => {
    const MESSAGE_CELLS: CellShape[] = [
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "MuiBox-root css-0", colSpan: "2" },
      { tag: "TD", className: "", colSpan: null },
    ];
    const BREAKPOINT_ARTWORK_HTML =
      '<div class="MuiAspectRatio-root css-4mstob-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantPlain MuiAspectRatio-colorNeutral css-1dbufxu-JoyAspectRatio-content"><p data-first-child="" class="MuiTypography-root MuiTypography-body-md css-ff7dcq-JoyTypography-root"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-5pnok8-MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="TimerIcon"><path d="M9 1h6v2H9zm10.03 6.39 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61M13 14h-2V8h2z"></path></svg></p></div></div>';
    const BREAKPOINT_MESSAGE_HTML =
      '<div class="MuiStack-root css-ktu002-JoyStack-root"><p class="MuiTypography-root MuiTypography-body-lg MuiTypography-colorWarning css-th0jkn-JoyTypography-root">Breakpoint</p></div>';

    it("readOnly", () => {
      const row = renderRow(BREAKPOINT_ENTRY, false, true);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(BREAKPOINT_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(BREAKPOINT_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(EMPTY_END_DECORATOR_HTML);
    });

    it("editable + draggable", () => {
      const row = renderRow(BREAKPOINT_ENTRY, true, false);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(BREAKPOINT_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(BREAKPOINT_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(EMPTY_END_DECORATOR_HTML);

      expect(row.children[0].children[0]).toHaveClass("drag-grip");
      expect(row.children[0].children[1]).toHaveClass("MuiAspectRatio-root");
    });
  });

  describe("show marker", () => {
    const MESSAGE_CELLS: CellShape[] = [
      { tag: "TD", className: "", colSpan: null },
      { tag: "TD", className: "MuiBox-root css-0", colSpan: "2" },
      { tag: "TD", className: "", colSpan: null },
    ];
    const MARKER_ARTWORK_HTML =
      '<div class="MuiAspectRatio-root css-4mstob-JoyAspectRatio-root"><div class="MuiAspectRatio-content MuiAspectRatio-variantPlain MuiAspectRatio-colorNeutral css-1dbufxu-JoyAspectRatio-content"><p data-first-child="" class="MuiTypography-root MuiTypography-body-md css-ff7dcq-JoyTypography-root"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-5pnok8-MuiSvgIcon-root" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="HeadphonesIcon"><path d="M12 3c-4.97 0-9 4.03-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-4v8h4c1.1 0 2-.9 2-2v-7c0-4.97-4.03-9-9-9"></path></svg></p></div></div>';
    const MARKER_MESSAGE_HTML =
      '<div class="MuiStack-root css-ktu002-JoyStack-root"><p class="MuiTypography-root MuiTypography-body-lg MuiTypography-colorSuccess css-1w3h90d-JoyTypography-root">DJ Test</p><p class="MuiTypography-root MuiTypography-body-md css-ljoq8r-JoyTypography-root">started the set</p></div>';

    it("readOnly", () => {
      const row = renderRow(MARKER_ENTRY, false, true);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(MARKER_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(MARKER_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(MARKER_END_DECORATOR_NOT_TODAY_HTML);
    });

    // A show marker is never editable (Entry hardcodes disableEditing=true
    // for it via getMessageEntryPresentation) and never draggable (Entry's
    // isMarker check forces resolvedDraggable false), whatever draggable and
    // readOnly say -- so this form renders byte-identical to readOnly's.
    // Pinned anyway, as its own case, so a change to either hardcoding is
    // caught here rather than only in the row-level <tr> characterization.
    it("editable + draggable (identical to readOnly by design)", () => {
      const row = renderRow(MARKER_ENTRY, true, false);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(MARKER_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(MARKER_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(MARKER_END_DECORATOR_NOT_TODAY_HTML);
    });

    it("drops the date line when the show started today", () => {
      const row = renderRow(MARKER_ENTRY_TODAY, false, true);

      expect(cellShapes(row)).toEqual(MESSAGE_CELLS);
      expect(artworkHtml(row)).toBe(MARKER_ARTWORK_HTML);
      expect(messageBlockHtml(row)).toBe(MARKER_MESSAGE_HTML);
      expect(endDecoratorHtml(row)).toBe(MARKER_END_DECORATOR_TODAY_HTML);
    });
  });

  // The queue page (@queue/page.tsx) renders SongEntry directly rather than
  // through Entry, and its artwork cell holds the hover-revealed Play-now
  // button -- a sibling of the AspectRatio EntryArtwork.tsx owns, not a
  // wrapper around it, so the cell's hover behavior is independent of what
  // SongEntryArtwork itself renders.
  describe("queue song entry", () => {
    function renderQueueRow(): HTMLTableRowElement {
      const entry = SONG_ENTRY;
      const { container } = renderWithProviders(
        <table>
          <Reorder.Group as="tbody" axis="y" values={[entry]} onReorder={() => {}}>
            <SongEntry entry={entry} playing={false} queue />
          </Reorder.Group>
        </table>
      );
      const row = container.querySelector(`[data-testid="flowsheet-entry-${entry.id}"]`);
      if (!(row instanceof HTMLTableRowElement)) {
        throw new Error(`Expected a <tr> for entry ${entry.id}, found ${row?.tagName ?? "nothing"}.`);
      }
      return row;
    }

    it("renders the same field texts and artwork as the live editable row", () => {
      const row = renderQueueRow();

      expect(cellShapes(row)).toEqual([
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
        { tag: "TD", className: "", colSpan: null },
      ]);
      expect(artworkHtml(row)).toBe(SONG_ARTWORK_HTML);
      expect(fieldHtml(row, "la paradoja")).toBe(
        '<p aria-label="la paradoja" class="MuiTypography-root MuiTypography-title-sm css-1wnp3kj-JoyTypography-root">la paradoja&nbsp;</p>'
      );
      expect(fieldHtml(row, "Sonamos")).toBe(
        '<span aria-label="Sonamos" class="MuiTypography-root MuiTypography-body-xs css-y6ceb6-JoyTypography-root">Sonamos&nbsp;</span>'
      );
    });

    it("keeps the Play-now button beside the artwork, not inside it, once hovered", () => {
      const row = renderQueueRow();
      fireEvent.mouseEnter(row.children[0]);

      expect(artworkHtml(row)).toBe(SONG_ARTWORK_HTML);
      const stack = row.children[0].querySelector(".MuiStack-root");
      if (!stack) throw new Error("Expected the artwork Stack to render.");
      // Artwork first, Play-now button after it -- both inside the same
      // Stack, so a change that moves the artwork out of it or past the
      // button fails here.
      expect(stack.children[0]).toHaveClass("MuiAspectRatio-root");
      expect(stack.children[1]).toHaveAttribute(
        "aria-label",
        "Play this song now (add to flowsheet)"
      );
    });
  });
});
