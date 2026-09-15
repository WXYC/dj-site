import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { STATION_TIME_ZONE } from "@/src/utilities/stationTime";

/**
 * The weekly rotation tally, rebuilt from the flowsheet.
 *
 * Reproduces `WeeklyPlayRepositoryImpl.CALCULATE_PLAYS_SQL` plus
 * `WeeklyPlaylistSummary.toEmailSummaryString` from tubafrenzy, which are what
 * the station's weekly airplay report has always been compiled from — the
 * counting rules, at least; `formatWeeklyReport` follows what the station
 * mails rather than what the Java emitted.
 *
 * Two deliberate divergences in the counting, both forced by what Backend
 * stores rather than chosen:
 *
 * 1. The legacy count is `COUNT(DISTINCT RADIO_HOUR)`, where every flowsheet
 *    row carried the show's *declared* working hour. Backend populates
 *    `radio_hour` on breakpoint rows only (it is null on tracks logged here,
 *    and on everything predating the producer rollout), so the bucket has to be
 *    derived — see `countDistinctDeclaredHours`.
 * 2. Names come from the flowsheet row rather than the rotation row the legacy
 *    summary joined. For a linked entry the two agree; where they diverge the
 *    flowsheet holds what actually aired, and unlike the rotation list it
 *    cannot lose a release that was killed after the week ended.
 */

/** A play, bucketed into the hour the show declared it in. */
export type RankedPlay = {
  rotationId: number;
  artist: string;
  title: string;
  label: string;
  /** Distinct declared hours this release aired in. */
  plays: number;
};

const MS_PER_HOUR = 3_600_000;

const hourParts = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  hour12: false,
  minute: "numeric",
  second: "numeric",
});

/**
 * The instant at the top of the station hour containing `ms`.
 *
 * Subtracts the station-local minutes and seconds rather than rounding the
 * epoch value down, because a zone whose offset is not a whole hour would put
 * `Math.floor(ms / MS_PER_HOUR)` in the middle of a local hour.
 *
 * The milliseconds have to go too, and they are the whole reason this is not a
 * one-line truncation: every zone offset is a whole number of seconds, so the
 * remainder carries straight through the subtraction above. Leaving it turns
 * two shows that began in the same hour into two buckets that differ only in
 * their millisecond tail, and each one counts as another play.
 */
function startOfStationHour(ms: number): number {
  let minute = 0;
  let second = 0;
  for (const part of hourParts.formatToParts(new Date(ms))) {
    if (part.type === "minute") minute = Number(part.value);
    if (part.type === "second") second = Number(part.value);
  }
  return ms - minute * 60_000 - second * 1_000 - modFloor(ms, 1_000);
}

// `%` keeps the sign of the dividend, which would push a pre-1970 instant
// forward into the next hour instead of back to the top of its own.
const modFloor = (value: number, by: number) => ((value % by) + by) % by;

/** The top of the station hour a row was logged in, when the wire carries one. */
function loggedHour(entry: FlowsheetRangeEntry): number | null {
  if (!entry.add_time) return null;
  const ms = Date.parse(entry.add_time);
  return Number.isNaN(ms) ? null : startOfStationHour(ms);
}

// play_order repeats within a show after a reorder, so id is a required
// tie-break rather than a defensive one: equal values would otherwise walk in
// an order that changes between passes, moving a play across an hour boundary.
const byPlayOrder = (a: FlowsheetRangeEntry, b: FlowsheetRangeEntry) =>
  (a.play_order ?? 0) - (b.play_order ?? 0) || a.id - b.id;

/**
 * Distinct declared hours per rotation release, keyed by `rotation_id`. This
 * is the legacy `NUMBER_PLAYS` figure.
 *
 * Walks each show in `play_order` carrying one hour bucket, exactly as the
 * legacy working hour behaved: it opens at the show's starting hour and moves
 * only when a breakpoint says so. Flooring each row's `add_time` to the wall
 * clock instead would split an unbroken run across two buckets and inflate
 * every count on the chart, because a DJ presses the breakpoint button when
 * they remember to, not on the hour.
 */
export function countDistinctDeclaredHours(
  shows: readonly FlowsheetRangeShow[],
  entries: readonly FlowsheetRangeEntry[],
): Map<number, number> {
  const showStart = new Map<number, number>();
  for (const s of shows) {
    if (s.start_time) showStart.set(s.id, startOfStationHour(Date.parse(s.start_time)));
  }

  const byShow = new Map<number, FlowsheetRangeEntry[]>();
  for (const e of entries) {
    // `/flowsheet/range` orders by add_time across the whole window, so a
    // multi-show week interleaves; play_order is only meaningful within a show.
    const key = e.show_id ?? 0;
    const bucket = byShow.get(key);
    if (bucket) bucket.push(e);
    else byShow.set(key, [e]);
  }

  const hours = new Map<number, Set<number>>();

  for (const [showId, showEntries] of byShow) {
    showEntries.sort(byPlayOrder);
    let current = showStart.get(showId) ?? null;

    for (const e of showEntries) {
      if (e.entry_type === "breakpoint") {
        // `radio_hour` is the hour the breakpoint authoritatively marks. Rows
        // that predate it fall back to their own logging instant, which is
        // within a minute or so of the hour they opened. A breakpoint carrying
        // neither leaves the bucket where it was: guessing an advance would
        // invent a play, and holding merely undercounts one.
        const marked = e.radio_hour ? Date.parse(e.radio_hour) : loggedHour(e);
        if (marked !== null) current = marked;
        continue;
      }

      const rotationId = e.rotation_id ?? 0;
      // `ROTATION_RELEASE_ID > 0` in the original: an unlinked play is not a
      // rotation play and never reached the tally.
      if (rotationId <= 0) continue;

      // `add_time` is optional on the wire, so a row before any breakpoint in
      // a show whose start_time is also missing cannot be placed in an hour at
      // all. Dropping it undercounts by one; bucketing it at the epoch would
      // merge every such row into one spurious shared hour.
      const bucket = current ?? loggedHour(e);
      if (bucket === null) continue;

      const seen = hours.get(rotationId);
      if (seen) seen.add(bucket);
      else hours.set(rotationId, new Set([bucket]));
    }
  }

  const counts = new Map<number, number>();
  for (const [rotationId, buckets] of hours) counts.set(rotationId, buckets.size);
  return counts;
}

// MySQL's default collation is case-insensitive, which is why `heavensouls`
// files between `Grupo Um` and `Horse Lords` on the printed chart rather than
// after every capitalised name. Comparing lowered code points reproduces that,
// and keeps digits ahead of letters as the original does.
const caseInsensitive = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * The ranked chart for a week.
 *
 * `ORDER BY NUMBER_OF_PLAYS DESC, ARTIST_ALPHABETICAL_NAME, TITLE ASC`, then
 * the minimum-plays cut the summary screen applies. Releases below the cut are
 * dropped rather than ranked, so the chart's length is a result and not a
 * parameter — which is why the legacy header reads "Top N" for a moving N.
 */
function tallyAll(
  shows: readonly FlowsheetRangeShow[],
  entries: readonly FlowsheetRangeEntry[],
): RankedPlay[] {
  const hours = countDistinctDeclaredHours(shows, entries);

  // First linked appearance names the release: later rows carry the same
  // rotation_id, and a re-typed free-text row should not rename the chart entry.
  const naming = new Map<number, FlowsheetRangeEntry>();
  for (const e of entries) {
    const id = e.rotation_id ?? 0;
    if (id > 0 && !naming.has(id)) naming.set(id, e);
  }

  const ranked: RankedPlay[] = [];
  for (const [rotationId, plays] of hours) {
    const source = naming.get(rotationId);
    ranked.push({
      rotationId,
      artist: source?.artist_name ?? "",
      title: source?.album_title ?? "",
      label: source?.record_label ?? "",
      plays,
    });
  }

  ranked.sort(
    (a, b) =>
      b.plays - a.plays ||
      caseInsensitive(a.artist, b.artist) ||
      caseInsensitive(a.title, b.title),
  );
  return ranked;
}

export function rankWeeklyPlays(
  shows: readonly FlowsheetRangeShow[],
  entries: readonly FlowsheetRangeEntry[],
  minimumPlays: number,
): RankedPlay[] {
  return tallyAll(shows, entries).filter((p) => p.plays >= minimumPlays);
}

const shortDate = new Intl.DateTimeFormat("en-US", {
  timeZone: STATION_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  year: "2-digit",
});

/** "Sunday 9/6/26 - Saturday 9/12/26", as `convertSundayLongToWeekRange` prints it. */
export function formatWeekRange(weekStart: Date): string {
  const saturday = new Date(weekStart.getTime() + 6 * 24 * MS_PER_HOUR + 12 * MS_PER_HOUR);
  return `Sunday ${shortDate.format(weekStart)} - Saturday ${shortDate.format(saturday)}`;
}

/**
 * The report as plain text, byte-for-byte in the shape the station mails out —
 * the librarian copies this block straight into an email, so the legend line
 * and the rule beneath it are load-bearing, not decoration.
 *
 * The header is the station's wording rather than the legacy Java's: every
 * report actually mailed prepends "Airplay Report on" and reads "Playbox
 * Records", an edit that was retyped by hand each week until this emitted it.
 * The legacy tail of unranked new adds, and the five genre charts beneath it,
 * have not been mailed since 2018 and are deliberately not emitted.
 */
export function formatWeeklyReport(ranked: readonly RankedPlay[], weekStart: Date): string {
  const lines = [
    `Airplay Report on WXYC's Top ${ranked.length} Playbox Records for the week of ${formatWeekRange(weekStart)}:`,
    "",
    "Rank (Plays) Artist - 'Title of CD/LP/EP/7-inch' (RECORD LABEL)",
    "---------------------------------------------------------------",
  ];
  ranked.forEach((row, i) => {
    lines.push(`${i + 1} (${row.plays}) ${row.artist} - ${row.title} (${row.label})`);
  });

  return lines.join("\n") + "\n";
}
