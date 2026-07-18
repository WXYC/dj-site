// Breakpoint hour semantics are pinned to the station's wall clock, not the
// DJ's browser. WXYC runs on US Eastern; a DJ logging from another zone was
// otherwise stamping (and de-duping) breakpoints against their own local hour,
// landing an hour off and blocking the correct hour.
//
// Everything here keys off an explicit IANA `timeZone`, so results are
// identical regardless of the client's local zone. The IANA zone also carries
// DST, so the offset is EST (-5) or EDT (-4) automatically — never hardcode it.
export const STATION_TIME_ZONE = "America/New_York";

const MS_PER_HOUR = 3_600_000;

// The label the DJ sees / the string persisted in `message`. Kept as the single
// producer of breakpoint hour text so creation, tooltip, guard, and display all
// agree.
const BREAKPOINT_SUFFIX = "Breakpoint";

// Rounds an instant to the nearest top-of-hour, matching the legacy
// getClosestHour rule (strictly past :30 rounds up, exactly :30 rounds down).
//
// Rounding on the raw epoch is equivalent to rounding the Eastern wall clock:
// the Eastern offset is always a whole number of hours, so a UTC hour boundary
// is also an Eastern hour boundary and the minutes-into-hour are identical in
// both. This makes DST transitions and midnight/day rollover fall out for free.
export function closestStationHour(now: Date = new Date()): Date {
  const ms = now.getTime();
  const minutesIntoHour = (ms % MS_PER_HOUR) / 60_000;
  const flooredToHour = ms - (ms % MS_PER_HOUR);
  return new Date(minutesIntoHour > 30 ? flooredToHour + MS_PER_HOUR : flooredToHour);
}

// e.g. "2:00 PM" — the station-local closest hour, no leading zero.
export function formatStationHourLabel(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(closestStationHour(now));
}

// The exact string persisted as the breakpoint's `message`, e.g.
// "2:00 PM Breakpoint". Must keep the word "Breakpoint" — both the client type
// guard and the backend entry-type inference discriminate on it.
export function stationBreakpointMessage(now: Date = new Date()): string {
  return `${formatStationHourLabel(now)} ${BREAKPOINT_SUFFIX}`;
}

// One breakpoint per station hour: a new breakpoint is a duplicate when an
// existing breakpoint already carries this station hour's message. Because the
// message is derived purely from station time, two DJs in different zones at the
// same instant produce the same key, and the next station hour produces a
// different one even if the client's local hour is unchanged.
export function isStationHourBreakpointPresent(
  existingBreakpointMessages: Iterable<string>,
  now: Date = new Date()
): boolean {
  const target = stationBreakpointMessage(now);
  for (const message of existingBreakpointMessages) {
    if (message === target) return true;
  }
  return false;
}

const partValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((p) => p.type === type)?.value ?? "";

// Station-tz counterpart of conversions.ts `formatAddTime`: renders a backend
// timestamp into the same "M/D/YYYY" + "h:mm:ss AM/PM" shapes that the classic
// marker-format regexes expect, but in station time so a breakpoint row reads
// the station's clock rather than the viewer's.
export function formatStationDateTime(isoString: string): {
  day: string;
  time: string;
  isToday: boolean;
} {
  const date = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).formatToParts(date);

  const day = `${partValue(parts, "month")}/${partValue(parts, "day")}/${partValue(parts, "year")}`;
  const time = `${partValue(parts, "hour")}:${partValue(parts, "minute")}:${partValue(parts, "second")} ${partValue(parts, "dayPeriod")}`;

  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const today = `${partValue(todayParts, "month")}/${partValue(todayParts, "day")}/${partValue(todayParts, "year")}`;

  return { day, time, isToday: day === today };
}
