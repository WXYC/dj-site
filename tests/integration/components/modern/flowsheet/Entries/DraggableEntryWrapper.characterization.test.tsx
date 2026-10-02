import { describe, it, expect, vi, beforeEach } from "vitest";
import { Reorder } from "motion/react";
import { renderWithProviders } from "@/tests/helpers/render";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import {
  FlowsheetSongEntry,
  FlowsheetMessageEntry,
  FlowsheetShowBlockEntry,
} from "@/lib/features/flowsheet/types";

/**
 * Pins the live `Entry` -> `SongEntry` / `MessageEntry` -> `DraggableEntryWrapper`
 * tree's rendered `<tr>` opening tag -- every attribute name, value, and the
 * whole style string in its real order -- across the full matrix: kind
 * (song, talkset, marker) x playing x highlighted x draggable x readOnly (48
 * cases). Only the data hooks (live-show state, flowsheet mutations,
 * routing) are stubbed; every presentational component between `Entry` and
 * the row stays real, so the variant/color/className/style
 * DraggableEntryWrapper receives are whatever its actual callers compute,
 * not a hand-written transcription of them. A row-presentation change shows
 * up as a failing assertion against the hand-written table below instead of
 * passing silently.
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
  entry_type: "track",
  track_title: "la paradoja",
  artist_name: "Juana Molina",
  album_title: "DOGA",
  record_label: "Sonamos",
  request_flag: false,
  segue: false,
};

const TALKSET_ENTRY: FlowsheetMessageEntry = {
  id: 2,
  play_order: 1,
  show_id: 100,
  entry_type: "talkset",
  message: "Talkset",
};

const MARKER_ENTRY: FlowsheetShowBlockEntry = {
  id: 3,
  play_order: 2,
  show_id: 100,
  entry_type: "show_start",
  dj_name: "DJ Test",
  day: "Monday",
  time: "10:00 PM",
  isStart: true,
};

const ENTRIES = {
  song: SONG_ENTRY,
  talkset: TALKSET_ENTRY,
  marker: MARKER_ENTRY,
} as const;

type Kind = keyof typeof ENTRIES;

function renderRow(
  kind: Kind,
  playing: boolean,
  highlighted: boolean,
  draggable: boolean,
  readOnly: boolean
) {
  const entry = ENTRIES[kind];

  // Mirrors the live flowsheet page: rows requested as draggable mount
  // inside a real Reorder.Group (axis="y", as="tbody"); rows requested as
  // non-draggable (the archive's previous-shows tbody) render in a plain
  // tbody outside the motion tree entirely.
  const rows = <Entry entry={entry} playing={playing} draggable={draggable} readOnly={readOnly} highlighted={highlighted} />;
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

// The row's whole opening tag (attribute names, values, and the style
// string's own order), captured via a shallow clone so the cells (which
// this spec does not pin) never enter the comparison.
function openingTag(row: HTMLTableRowElement): string {
  return (row.cloneNode(false) as Element).outerHTML;
}

// The row's opening tag is a pure function of (kind, playing, highlighted,
// reorderItem), where reorderItem = draggable && !readOnly && kind !==
// "marker" mirrors Entry's own resolvedDraggable: a marker is never
// draggable, whatever draggable/readOnly say, so it has no reorderItem
// variant. highlighted collapses both playing states into one for song;
// MessageEntry's own highlighted-aware color resolution happens to leave
// talkset's danger color unchanged whether or not it's highlighted, so only
// its class/id differ there. That's 3 distinguishable states for song, 2 for
// talkset, 2 for marker. Song and talkset each render a second, distinct
// opening tag when reorderItem is true -- a real `Reorder.Item` moves
// `opacity` to the end of the style string and appends `z-index: unset;
// transform: none;` -- so (3 + 2) states x 2 reorderItem variants, plus
// marker's 2 states x 1 variant, is the 12 distinct opening tags below.
const SONG_HIGHLIGHTED_STATIC_TR =
  '<tr id="entry-1" data-testid="flowsheet-entry-1" class="row-highlighted" style="height: 60px; margin-bottom: initial; opacity: 1; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent;"></tr>';
const SONG_HIGHLIGHTED_REORDER_TR =
  '<tr id="entry-1" data-testid="flowsheet-entry-1" class="row-highlighted" style="height: 60px; margin-bottom: initial; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent; opacity: 1; z-index: unset; transform: none;"></tr>';
const SONG_PLAYING_STATIC_TR =
  '<tr data-testid="flowsheet-entry-1" class="row-playing" style="height: 60px; margin-bottom: initial; opacity: 1; --row-bg: var(--joy-palette-primary-500, #0B6BCB); --row-accent: var(--joy-palette-primary-500, #0B6BCB); background: transparent;"></tr>';
const SONG_PLAYING_REORDER_TR =
  '<tr data-testid="flowsheet-entry-1" class="row-playing" style="height: 60px; margin-bottom: initial; --row-bg: var(--joy-palette-primary-500, #0B6BCB); --row-accent: var(--joy-palette-primary-500, #0B6BCB); background: transparent; opacity: 1; z-index: unset; transform: none;"></tr>';
const SONG_PLAIN_STATIC_TR =
  '<tr data-testid="flowsheet-entry-1" class="row-plain" style="height: 60px; margin-bottom: initial; opacity: 1; --row-bg: rgba(255, 255, 255, 0.015); --row-accent: var(--joy-palette-neutral-500, #636B74); background: transparent;"></tr>';
const SONG_PLAIN_REORDER_TR =
  '<tr data-testid="flowsheet-entry-1" class="row-plain" style="height: 60px; margin-bottom: initial; --row-bg: rgba(255, 255, 255, 0.015); --row-accent: var(--joy-palette-neutral-500, #636B74); background: transparent; opacity: 1; z-index: unset; transform: none;"></tr>';
const TALKSET_HIGHLIGHTED_STATIC_TR =
  '<tr id="entry-2" data-testid="flowsheet-entry-2" class="row-marker row-highlighted" style="height: 40px; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent;"></tr>';
const TALKSET_HIGHLIGHTED_REORDER_TR =
  '<tr id="entry-2" data-testid="flowsheet-entry-2" class="row-marker row-highlighted" style="height: 40px; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent; z-index: unset; transform: none;"></tr>';
const TALKSET_PLAIN_STATIC_TR =
  '<tr data-testid="flowsheet-entry-2" class="row-marker" style="height: 40px; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent;"></tr>';
const TALKSET_PLAIN_REORDER_TR =
  '<tr data-testid="flowsheet-entry-2" class="row-marker" style="height: 40px; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent; z-index: unset; transform: none;"></tr>';
const MARKER_HIGHLIGHTED_TR =
  '<tr id="entry-3" data-testid="flowsheet-entry-3" class="row-marker row-highlighted" style="height: 40px; --row-bg: var(--joy-palette-danger-100, #FCE4E4); --row-accent: var(--joy-palette-danger-500, #C41C1C); background: transparent;"></tr>';
const MARKER_PLAIN_TR =
  '<tr data-testid="flowsheet-entry-3" class="row-marker" style="height: 40px; --row-bg: var(--joy-palette-success-100, #E3FBE3); --row-accent: var(--joy-palette-success-500, #1F7A1F); background: transparent;"></tr>';

function expectedTag(kind: Kind, playing: boolean, highlighted: boolean, reorderItem: boolean): string {
  if (kind === "song") {
    if (highlighted) return reorderItem ? SONG_HIGHLIGHTED_REORDER_TR : SONG_HIGHLIGHTED_STATIC_TR;
    if (playing) return reorderItem ? SONG_PLAYING_REORDER_TR : SONG_PLAYING_STATIC_TR;
    return reorderItem ? SONG_PLAIN_REORDER_TR : SONG_PLAIN_STATIC_TR;
  }
  if (kind === "talkset") {
    return highlighted
      ? reorderItem
        ? TALKSET_HIGHLIGHTED_REORDER_TR
        : TALKSET_HIGHLIGHTED_STATIC_TR
      : reorderItem
        ? TALKSET_PLAIN_REORDER_TR
        : TALKSET_PLAIN_STATIC_TR;
  }
  // marker: Entry's isMarker check forces resolvedDraggable false regardless
  // of the draggable/readOnly inputs, so there is no reorderItem variant.
  return highlighted ? MARKER_HIGHLIGHTED_TR : MARKER_PLAIN_TR;
}

describe("Entry row presentation (characterization)", () => {
  const kinds = ["song", "talkset", "marker"] as const;
  const bools = [true, false] as const;

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

  for (const kind of kinds) {
    for (const playing of bools) {
      for (const highlighted of bools) {
        for (const draggable of bools) {
          for (const readOnly of bools) {
            it(`renders ${kind} (playing=${playing} highlighted=${highlighted} draggable=${draggable} readOnly=${readOnly})`, () => {
              const row = renderRow(kind, playing, highlighted, draggable, readOnly);
              const reorderItem = draggable && !readOnly && kind !== "marker";
              expect(openingTag(row)).toBe(expectedTag(kind, playing, highlighted, reorderItem));
            });
          }
        }
      }
    }
  }
});
