import { formatStationClockTime } from "@/src/utilities/stationTime";
import { FlowsheetEntry, isFlowsheetBreakpointEntry } from "./types";

export type RangeTimedEntry = {
  entry_type?: string | null;
  add_time?: string | null;
  radio_hour?: string | null;
};

// The single Time-cell rule, shared by both archive views and the converted
// live shape below: a breakpoint is logged roughly a minute either side of
// the hour it marks, so its own add_time reads the wrong hour, and
// radio_hour is the hour it stands for instead. Each exported entry point
// below decides breakpoint-ness itself, from the discriminator its own row
// shape actually carries, rather than trusting a caller-supplied flag that
// nothing checks against the row.
function stationClockTimeFor(
  entry: { add_time?: string | null; radio_hour?: string | null },
  isBreakpoint: boolean
): string {
  return formatStationClockTime(
    isBreakpoint && entry.radio_hour != null ? entry.radio_hour : entry.add_time
  );
}

// GET /flowsheet and GET /flowsheet/range both discriminate on entry_type.
export function rangeEntryTime(entry: RangeTimedEntry): string {
  return stationClockTimeFor(entry, entry.entry_type === "breakpoint");
}

// The converted FlowsheetEntry union carries no entry_type; its
// breakpoint-ness test is isFlowsheetBreakpointEntry, the same predicate
// convertV2Entry/convertRangeEntry already gate radio_hour on, so a
// non-breakpoint member of the union can never carry one.
export function flowsheetEntryTime(entry: FlowsheetEntry): string {
  return stationClockTimeFor(entry, isFlowsheetBreakpointEntry(entry));
}
