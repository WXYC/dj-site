import type { FlowsheetV2Entry } from "@wxyc/shared";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import { convertRangeEntry, type FlowsheetRangeEntryWire } from "./conversions";
import { rangeEntryTime } from "./entry-time";
import type { FlowsheetEntry } from "./types";

/**
 * One row of an archive surface built from a `/flowsheet/range` wire row:
 * `ShowEntriesPanel` and the chronological stream listing both build their
 * rows through this rather than each carrying its own copy of the pair, so
 * the two cannot disagree about what a row is.
 */
export type ArchiveStreamRow = {
  id: number;
  /** `null` for an unattributed entry -- see `FlowsheetV2Base.show_id`. */
  showId: number | null;
  timeLabel: string;
  entry: FlowsheetEntry;
};

export function toArchiveStreamRow(entry: FlowsheetRangeEntryWire): ArchiveStreamRow {
  return {
    id: entry.id,
    showId: entry.show_id,
    timeLabel: rangeEntryTime(entry),
    entry: convertRangeEntry(entry),
  };
}

/**
 * The same row, from a stream entry (the contract's `FlowsheetV2Entry` union)
 * rather than the flat `/flowsheet/range` wire row -- the listing hook's own
 * pages and the server seed are both this shape, not the flat one, and this
 * is the one place either composes `v2ToRangeShape` with `toArchiveStreamRow`
 * so the two cannot each grow their own copy of the pairing.
 */
export function toArchiveStreamRowFromStreamEntry(
  entry: FlowsheetV2Entry,
): ArchiveStreamRow {
  return toArchiveStreamRow(v2ToRangeShape(entry));
}
