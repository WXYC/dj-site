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

// Rounds an instant to the nearest top-of-hour: strictly past :30 rounds up,
// exactly :30 rounds down.
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

// The long-form date `/wxycdb`'s catalog screens print beside the time, e.g.
// "Saturday, June 15, 2024". Reproduces `DateTimeManager.DATE_FULL`
// ("EEEE, MMMM d, yyyy", Locale.US) on the station's wall clock -- note the
// Java method that renders it is named `getLongDateAsMMDDYY`, which describes
// a different format than it produces; the rendered shape is what the
// librarian reads, so that is what is reproduced here.
export function formatStationLongDate(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(isoString));
}

// A week is not reliably 7 * 86_400_000 ms. Adding that constant across a DST
// transition lands at 23:00 or 01:00 rather than midnight, and the resulting
// window is measured against a backend that rejects spans over eight days. So
// every boundary below is resolved through the station's calendar fields
// instead of by arithmetic on the epoch.
const MS_PER_DAY = 86_400_000;

const stationFieldFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

type StationFields = {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number; weekday: number;
};

function stationFields(instant: Date): StationFields {
  const parts = stationFieldFormatter.formatToParts(instant);
  const num = (type: Intl.DateTimeFormatPartTypes) =>
    Number(partValue(parts, type));
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    // "24" is how hour12:false renders midnight in some ICU versions.
    hour: num("hour") % 24,
    minute: num("minute"),
    second: num("second"),
    weekday: WEEKDAY_INDEX[partValue(parts, "weekday")] ?? 0,
  };
}

// The instant at which the station clock reads the given calendar midnight.
// Resolved by correcting a UTC guess against the offset actually in force,
// twice: the first correction can itself cross a transition.
function stationMidnightInstant(year: number, month: number, day: number): Date {
  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 2; i++) {
    const f = stationFields(new Date(guess));
    const readsAs = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
    const target = Date.UTC(year, month - 1, day, 0, 0, 0);
    if (readsAs === target) break;
    guess += target - readsAs;
  }
  return new Date(guess);
}

/** Sunday 00:00 station time for the week containing `instant`. */
export function startOfStationWeek(instant: Date): Date {
  const f = stationFields(instant);
  // Step back in whole station days, re-reading the calendar each time, so a
  // transition inside the week cannot shift the result off midnight.
  const midnightToday = stationMidnightInstant(f.year, f.month, f.day);
  if (f.weekday === 0) return midnightToday;
  const back = stationFields(
    new Date(midnightToday.getTime() - f.weekday * MS_PER_DAY + MS_PER_DAY / 2),
  );
  return stationMidnightInstant(back.year, back.month, back.day);
}

/** Move `n` whole weeks from a Sunday-midnight instant, staying on midnight. */
export function addStationWeeks(weekStart: Date, n: number): Date {
  const shifted = stationFields(
    // Land mid-day before re-reading, so a transition cannot push the guess
    // onto the adjacent calendar date.
    new Date(weekStart.getTime() + n * 7 * MS_PER_DAY + MS_PER_DAY / 2),
  );
  return stationMidnightInstant(shifted.year, shifted.month, shifted.day);
}

/**
 * Half-open `[startMs, endMs)` epoch-millisecond window for one station week.
 * Between 7d-1h and 7d+1h depending on DST, and therefore always inside the
 * backend's eight-day ceiling.
 */
export function stationWeekWindow(weekStart: Date): {
  startMs: number;
  endMs: number;
} {
  return {
    startMs: weekStart.getTime(),
    endMs: addStationWeeks(weekStart, 1).getTime(),
  };
}

/**
 * The seven station midnights of a week. Day lengths are not uniform: the
 * spring-forward day is 23 hours and the fall-back day is 25, which is why a
 * grid must measure each column against its own bounds.
 */
export function stationDaysOfWeek(weekStart: Date): Date[] {
  const days = [weekStart];
  for (let i = 1; i < 7; i++) {
    const f = stationFields(
      new Date(days[i - 1].getTime() + MS_PER_DAY + MS_PER_DAY / 2),
    );
    days.push(stationMidnightInstant(f.year, f.month, f.day));
  }
  return days;
}

const WEEK_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The `YYYY-MM-DD` station date naming a week, for the URL. */
export function formatStationWeekParam(weekStart: Date): string {
  const f = stationFields(weekStart);
  return `${f.year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`;
}

/**
 * Parse a `YYYY-MM-DD` week parameter, normalized to that week's Sunday.
 * Returns null for anything unparseable rather than falling back to a default,
 * so a malformed URL cannot silently render a different week than it names.
 */
export function parseStationWeekParam(value: string): Date | null {
  const match = WEEK_PARAM_PATTERN.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const instant = stationMidnightInstant(year, month, day);
  const f = stationFields(instant);
  // Rejects impossible dates that Date.UTC would roll over (e.g. 02-31).
  if (f.year !== year || f.month !== month || f.day !== day) return null;
  return startOfStationWeek(instant);
}
