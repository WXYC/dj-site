import { formatStationClockTime } from "@/src/utilities/stationTime";

export type TimedEntry = {
  add_time?: string | null;
  radio_hour?: string | null;
};

// The single Time-cell rule for both archive views: a breakpoint is logged
// roughly a minute either side of the hour it marks, so its own add_time
// reads the wrong hour, and radio_hour is the hour it stands for instead.
// isBreakpoint is taken explicitly rather than read off the entry, since the
// wire shape discriminates on entry_type and the converted live shape on
// isFlowsheetBreakpointEntry -- callers already know which test applies.
export function timeOf(entry: TimedEntry, isBreakpoint: boolean): string {
  return formatStationClockTime(
    isBreakpoint && entry.radio_hour != null ? entry.radio_hour : entry.add_time
  );
}
