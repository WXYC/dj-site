import type { SpecialtyShow, SpecialtyShowSlot } from "@wxyc/shared";

/** A crew that goes live this many minutes before its slot is still asked. */
export const SLOT_LEAD_MINUTES = 10;

const MINUTES_PER_WEEK = 7 * 24 * 60;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const stationClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** Minutes since Monday 00:00 on the station's (America/New_York) wall clock, or null for an unparseable instant. */
function stationMinuteOfWeek(instant: Date): number | null {
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  const parts = Object.fromEntries(
    stationClock.formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return (
    WEEKDAYS.indexOf(parts.weekday) * 24 * 60 +
    Number(parts.hour) * 60 +
    Number(parts.minute)
  );
}

export type SlotMatch = { program: SpecialtyShow; slot: SpecialtyShowSlot };

/**
 * The active catalog programs whose slot covers `startedAt`, in catalog order.
 * `cadence` is deliberately ignored: only the DJ knows whether a `some_weeks`
 * program airs, so the slot suggests and the DJ answers.
 */
export function programsForStart(
  startedAt: string | Date,
  catalog: SpecialtyShow[]
): SlotMatch[] {
  const now = stationMinuteOfWeek(new Date(startedAt));
  if (now === null) {
    return [];
  }
  const matches: SlotMatch[] = [];
  for (const program of catalog) {
    if (!program.active) {
      continue;
    }
    const slot = program.slots.find(({ day, start_time, duration_minutes }) => {
      const [hour, minute] = start_time.split(":").map(Number);
      const slotStart = day * 24 * 60 + hour * 60 + minute;
      const sinceLead =
        (((now - slotStart + SLOT_LEAD_MINUTES) % MINUTES_PER_WEEK) +
          MINUTES_PER_WEEK) %
        MINUTES_PER_WEEK;
      return sinceLead < SLOT_LEAD_MINUTES + duration_minutes;
    });
    if (slot) {
      matches.push({ program, slot });
    }
  }
  return matches;
}
