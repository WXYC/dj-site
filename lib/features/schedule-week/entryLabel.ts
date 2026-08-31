import type { FlowsheetRangeEntry } from "@wxyc/shared";
import { convertRangeEntry } from "@/lib/features/flowsheet/conversions";
import { messageEntryLabel } from "@/src/components/experiences/modern/flowsheet/Entries/entryPresentation";

/**
 * Display line for an entry the schedule panel does not render as a track.
 *
 * Resolved through the flowsheet's own row-presentation switch rather than a
 * local copy of it: `show_start` and `show_end` carry no `message` at all —
 * they name the DJ in `dj_name` — so a `message ?? entry_type` fallback prints
 * the wire token "show_start" into the panel, and every drill-in opens and
 * closes with one. Going through the shared switch also keeps this surface's
 * wording identical to the live flowsheet's, which a second switch could not
 * promise.
 */
export function describeNonTrackEntry(entry: FlowsheetRangeEntry): string {
  return messageEntryLabel(convertRangeEntry(entry));
}
