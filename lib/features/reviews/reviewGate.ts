/**
 * Whether the review-gate cutover date has arrived, in station time.
 *
 * From that date Backend-Service refuses every library or rotation insert that
 * is not backed by a review, so the screens that create a release directly
 * give way to a pointer at the review shelf. The date is compared with today
 * at call time, not at build time, so a build deployed weeks ahead switches by
 * itself. `NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE` is `YYYY-MM-DD`; unset or
 * empty is off. A set value that is not a real date counts as on, as it does
 * in Backend-Service: a typo read as off would leave the add screens up while
 * every add is refused.
 */

const STATION_TIME_ZONE = "America/New_York";

const stationDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: STATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let reportedMalformed = false;

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function reviewGateCutoverReached(): boolean {
  const configured = process.env.NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE;
  if (configured === undefined || configured === "") return false;
  if (!isRealDate(configured)) {
    if (!reportedMalformed) {
      reportedMalformed = true;
      console.error(
        `NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE is not a YYYY-MM-DD date (${JSON.stringify(configured)}); treating the review gate as on.`,
      );
    }
    return true;
  }
  return stationDate.format(new Date()) >= configured;
}
