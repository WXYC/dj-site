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

/** Minutes from `from` forward to `to` around the week, in [0, MINUTES_PER_WEEK). */
function minutesUntil(from: number, to: number): number {
  return (((to - from) % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK;
}

/**
 * The active catalog programs whose slot covers `startedAt`, in catalog order.
 * `cadence` is deliberately ignored: only the DJ knows whether a `some_weeks`
 * program airs, so the slot suggests and the DJ answers.
 *
 * The ten minutes before a slot belong to that slot. A slot that ends inside
 * the lead window of a slot that follows it does not match, so back-to-back
 * slots never put three programs in front of the DJ. A program matches at most
 * once, through its best slot.
 */
export function programsForStart(
  startedAt: string | Date,
  catalog: SpecialtyShow[]
): SlotMatch[] {
  const now = stationMinuteOfWeek(new Date(startedAt));
  if (now === null) {
    return [];
  }
  type Candidate = SlotMatch & { untilStart: number; untilEnd: number };
  const candidates: Candidate[] = [];
  for (const program of catalog) {
    if (!program.active) {
      continue;
    }
    for (const slot of program.slots) {
      const [hour, minute] = slot.start_time.split(":").map(Number);
      const slotStart = slot.day * 24 * 60 + hour * 60 + minute;
      const untilStart = minutesUntil(now, slotStart);
      const sinceStart = minutesUntil(slotStart, now);
      const covers = sinceStart < slot.duration_minutes;
      if (covers || (untilStart > 0 && untilStart <= SLOT_LEAD_MINUTES)) {
        candidates.push({
          program,
          slot,
          untilStart: covers ? 0 : untilStart,
          untilEnd: slot.duration_minutes - sinceStart,
        });
      }
    }
  }
  // A slot is ending into a follower when it ends within the lead window and a
  // slot in its lead window starts at or after that end.
  const endingIntoFollower = ({ untilStart, untilEnd }: Candidate) =>
    untilStart === 0 &&
    untilEnd <= SLOT_LEAD_MINUTES &&
    candidates.some((other) => other.untilStart > 0 && other.untilStart >= untilEnd);
  // One match per program: the best surviving slot, the one nearest its start.
  const best = new Map<SpecialtyShow, Candidate>();
  for (const candidate of candidates) {
    if (endingIntoFollower(candidate)) {
      continue;
    }
    const held = best.get(candidate.program);
    if (!held || candidate.untilStart < held.untilStart) {
      best.set(candidate.program, candidate);
    }
  }
  return catalog
    .filter((program) => best.has(program))
    .map((program) => ({ program, slot: best.get(program)!.slot }));
}
