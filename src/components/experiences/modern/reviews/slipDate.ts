const STATION_TIME_ZONE = "America/New_York";

const STATION_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: STATION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The date a slip shows, as `YYYY-MM-DD`. A date passes through; a date-time is
 * read in station time, so the editor's preview and the printed slip of one
 * review always agree on the day.
 */
export function formatSlipDate(value: string): string {
  return value.length === 10 ? value : STATION_DATE.format(new Date(value));
}
