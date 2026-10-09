import { stationDateISO } from "@/src/utilities/stationTime";

/**
 * The date a slip shows, as `YYYY-MM-DD`. A date passes through; a date-time is
 * read in station time, so the editor's preview and the printed slip of one
 * review always agree on the day.
 */
export function formatSlipDate(value: string): string {
  return value.length === 10 ? value : stationDateISO(new Date(value));
}
