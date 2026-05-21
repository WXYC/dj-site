// Shortens day/time strings produced by `formatAddTime()` in
// `lib/features/flowsheet/conversions.ts` to the tubafrenzy display form:
//   day: "11/14/2023"   -> "11/14/23"
//   time: "5:13:00 PM"  -> "5:13 PM"
// Returns the input unchanged when it doesn't match the expected pattern,
// so unknown / placeholder values pass through.

const DAY_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{2})(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}:\d{2}):\d{2}\s+(AM|PM)$/i;

export function formatShortDate(day: string): string {
  const match = day.match(DAY_PATTERN);
  if (!match) return day;
  const [, month, date, , yy] = match;
  return `${month}/${date}/${yy}`;
}

export function formatShortTime(time: string): string {
  const match = time.match(TIME_PATTERN);
  if (!match) return time;
  const [, hm, ampm] = match;
  return `${hm} ${ampm.toUpperCase()}`;
}
