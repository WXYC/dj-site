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
  const flooredToHour = startOfStationHour(ms);
  return new Date(minutesIntoHour > 30 ? flooredToHour + MS_PER_HOUR : flooredToHour);
}

// Floors an instant to the top of the station hour it falls in -- distinct
// from closestStationHour, which rounds a target instant to its NEAREST
// station hour (rounding up past :30). A stored radio_hour is not a target to
// round; it is a server-stamped instant already claiming a specific hour, so
// comparing it to a guard target requires floor, never round. Same whole-hour
// Eastern-offset argument as closestStationHour applies.
function startOfStationHour(ms: number): number {
  return ms - (ms % MS_PER_HOUR);
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

/**
 * The exact string persisted as a breakpoint's `message`, built from an hour
 * label that has already been resolved, e.g. "2:00 PM" → "2:00 PM Breakpoint".
 *
 * Must keep the word "Breakpoint" — both the client type guard and the backend
 * entry-type inference discriminate on it — so this is the only place the two
 * halves are joined. An empty label yields the bare word rather than a leading
 * space, for archive rows that name no hour at all.
 */
export function breakpointMessageForHourLabel(hourLabel: string): string {
  return hourLabel ? `${hourLabel} ${BREAKPOINT_SUFFIX}` : BREAKPOINT_SUFFIX;
}

// The exact string persisted as the breakpoint's `message`, e.g.
// "2:00 PM Breakpoint".
export function stationBreakpointMessage(now: Date = new Date()): string {
  return breakpointMessageForHourLabel(formatStationHourLabel(now));
}

/**
 * What the one-per-hour guard needs from an existing breakpoint row: the
 * server-stamped instant it marks, when known, and the display text it
 * fell back to before that instant existed.
 *
 * `radio_hour` absent or null covers two different rows the same way: an
 * archive row logged before the server started stamping it, and the
 * client-only optimistic row inserted before the server has responded to
 * this submission at all. Both have to fall back to the message, or a
 * double-click on Add Breakpoint stops being caught until the real row
 * lands.
 */
export type StationHourBreakpoint = {
  radio_hour?: string | null;
  message: string;
};

// One breakpoint per station hour: a new breakpoint is a duplicate when an
// existing breakpoint already claims this station hour. Rows carrying a
// `radio_hour` are compared as instants -- the same field the server watermark
// keys on -- so a skewed browser clock can no longer disagree with the server
// about which hour a row belongs to. A row with no usable `radio_hour` falls
// back to the previous message-label comparison, which is purely a function of
// station time: two DJs in different zones at the same instant still produce
// the same label, and the next station hour still produces a different one.
//
// The target is still `closestStationHour(browser clock)`, so this stays
// optimistic, not authoritative -- a browser skewed far enough to straddle :30
// aims at one hour while the server stamps the next, and neither key then
// matches a row the server considers this hour's. That residual is the
// server's to close (its watermark today, a uniqueness constraint later), and
// it replaces a strictly worse accepted edge: keying on the label collapsed
// the two legitimate 1 AM breakpoints of a DST fall-back night into one key.
export function isStationHourBreakpointPresent(
  existingBreakpoints: Iterable<StationHourBreakpoint>,
  now: Date = new Date()
): boolean {
  const targetHour = closestStationHour(now);
  const targetInstant = targetHour.getTime();
  // Built on demand: a live show's rows all carry a `radio_hour`, so the
  // label branch is usually never taken, and producing it costs an
  // Intl.DateTimeFormat -- on a path one caller runs in a render body.
  let targetLabel: string | null = null;
  for (const { radio_hour, message } of existingBreakpoints) {
    const instant = radio_hour ? Date.parse(radio_hour) : NaN;
    // No usable instant -- absent, null, or an unparseable string -- means the
    // label is all this row says about which hour it marks, so use it. An
    // unparseable value is deliberately treated as absent rather than as an
    // instant that happens to match nothing: a row that can match on neither
    // key stops suppressing duplicates altogether, which is the failure mode
    // the flooring below also exists to avoid.
    if (Number.isNaN(instant)) {
      targetLabel ??= stationBreakpointMessage(targetHour);
      if (message === targetLabel) return true;
      continue;
    }
    // Floored rather than trusted as exact: the server always stamps a
    // top-of-hour, so this is a no-op in practice, but comparing the raw
    // value would mean a hypothetical drift of even one second makes the
    // guard silently never match again. Never apply closestStationHour's OWN
    // rounding here: that rounds at :30, which would misfile a radio_hour
    // minutes off the boundary into the wrong hour instead of leaving it in
    // its own.
    if (startOfStationHour(instant) === targetInstant) return true;
  }
  return false;
}

/**
 * Copy for the one-per-hour guard's rejection, built from an hour label that
 * has already been resolved, e.g. "7:00 PM" -> "7:00 PM already has a
 * breakpoint". Naming the claimed hour rather than restating the rule is the
 * point: which hour the guard read is the one fact a DJ cannot recover from
 * the screen, and without it a refusal is indistinguishable from a failed
 * write.
 *
 * Takes a resolved label rather than a `Date`, the same split as
 * `breakpointMessageForHourLabel` above, so each caller passes the single
 * clock read its guard check also used instead of this function silently
 * taking a second one that could round to a different hour.
 *
 * Shared by both experiences so the two cannot drift on wording.
 */
export function breakpointGuardRejectionMessage(hourLabel: string): string {
  return `${hourLabel} already has a breakpoint`;
}

const partValue = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((p) => p.type === type)?.value ?? "";

/**
 * An instant as the station's wall clock, e.g. "9:03 PM" — no rounding, no
 * seconds, and no leading zero.
 *
 * Unlike `formatStationHourLabel` this reports the instant it is given rather
 * than the hour nearest to it, so it can label an arbitrary row. A missing or
 * unparseable timestamp yields an empty label: a blank cell is honest, where
 * "Invalid Date" is a rendering bug wearing a value's clothes.
 */
export function formatStationClockTime(
  isoString: string | null | undefined
): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

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
const stationLongDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatStationLongDate(isoString: string): string {
  return stationLongDateFormatter.format(new Date(isoString));
}

// The same long form for a `YYYY-MM-DD` column, which names a calendar day and
// carries no instant -- the rotation dates are stored that way. Read at midday
// UTC rather than at the midnight `new Date("2026-09-12")` produces, which is
// the previous evening in station time and so prints the previous day.
export function formatLongCalendarDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  return stationLongDateFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}

const stationTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

// A compact instant for reading a stored record's age, e.g.
// "Jun 15, 2024, 3:04 PM EDT". The zone abbreviation is part of the format,
// not decoration: rendered in station time, an unlabelled timestamp is
// indistinguishable from the reader's own clock, and only the station's is
// what an admin reconciles against station logs.
//
// Returns null rather than a placeholder string for an absent or unparseable
// value, so the caller decides how "we don't know" reads in its own UI --
// what must never reach a reader is "Invalid Date".
export function formatStationTimestampLabel(
  isoString: string | null | undefined
): string | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return null;

  return stationTimestampFormatter.format(date);
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
