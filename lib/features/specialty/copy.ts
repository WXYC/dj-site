import type { SpecialtyShowSlot } from "@wxyc/shared";
import { CLOSED_SHOW_SENTENCE } from "../show-playlist/api";

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

export const REJECTED_PROGRAM_SENTENCE =
  "The DJ site couldn't tag this show with that program. It may have been retired. Try again, or carry on without a tag.";

/**
 * The one sentence a refused show-tag write is shown as, or null when the
 * refusal belongs to the site's general handling (a 401, or a 403 that is a
 * missing permission or a ban). A 403 is told apart by the `code` in its raw
 * body; a 400 by its status alone, never its message text.
 */
export function showTagRefusal(error: { status?: unknown; data?: unknown }): string | null {
  const code = (error.data as { code?: unknown } | null | undefined)?.code;
  if (error.status === 403 && code === "closed_show") {
    return CLOSED_SHOW_SENTENCE;
  }
  return error.status === 400 ? REJECTED_PROGRAM_SENTENCE : null;
}
