import { formatStationClockTime } from "@/src/utilities/stationTime";
import { FlowsheetEntry } from "./types";

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

// The converted FlowsheetEntry union carries no entry_type, so it needs its
// own breakpoint test, and `isFlowsheetBreakpointEntry` is the wrong one: that
// predicate matches on message text ("Breakpoint"), which a talkset or plain
// message row's own text can also contain without the row being one.
// conversions.ts attaches `radio_hour` only via `breakpointDisplayFields`,
// which only the wire `case "breakpoint"` arm of convertV2Entry and
// convertRangeEntry calls -- every other arm leaves the key off entirely. So
// a converted row's own `radio_hour` key is the discriminator conversion
// actually produces: present, whatever it resolves to, only on a converted
// breakpoint.
export function flowsheetEntryTime(entry: FlowsheetEntry): string {
  return stationClockTimeFor(entry, "radio_hour" in entry);
}
