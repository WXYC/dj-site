import type { SpecialtyShowSlot } from "@wxyc/shared";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "Sunday at noon", "Friday at 9:00 PM": the slot in station (Eastern) time. */
export function describeSlot({ day, start_time }: SpecialtyShowSlot): string {
  const [hour, minute] = start_time.split(":").map(Number);
  if (hour === 12 && minute === 0) {
    return `${DAYS[day]} at noon`;
  }
  if (hour === 0 && minute === 0) {
    return `${DAYS[day]} at midnight`;
  }
  const clock = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  return `${DAYS[day]} at ${clock}`;
}
