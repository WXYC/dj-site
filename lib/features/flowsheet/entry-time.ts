import type { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { formatStationClockTime } from "@/src/utilities/stationTime";

export type RangeTimedEntry = {
  entry_type: FlowsheetEntryType;
  add_time?: string | null;
  radio_hour?: string | null;
};

// The Time-cell rule shared by both archive views, for the GET /flowsheet/range
// wire shape: a breakpoint is logged roughly a minute either side of the hour
// it marks, so its own add_time reads the wrong hour, and radio_hour is the
// hour it stands for instead.
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
