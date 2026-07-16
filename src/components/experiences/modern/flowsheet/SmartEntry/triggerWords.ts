import type { SmartField } from "./parser/types";

/** The three fields reachable via a trigger word (song is always leading). */
export type TriggerField = Exclude<SmartField, "song">;

/**
 * Canonical field order — drives both the inline chips (front-to-back) and
 * Tab-to-advance (the next unclaimed field in this order).
 */
export const TRIGGER_FIELDS: readonly TriggerField[] = [
  "artist",
  "album",
  "label",
];

/** The single canonical trigger word inserted for each field. */
export const TRIGGER_WORD: Record<TriggerField, string> = {
  artist: "by",
  album: "on",
  label: "via",
};

/**
 * The frontmost field (in {@link TRIGGER_FIELDS} order) that isn't yet claimed
 * — the one Tab advances into and the leftmost chip. `null` once every field is
 * specified.
 */
export function nextTriggerField(
  isClaimed: (field: SmartField) => boolean
): TriggerField | null {
  return TRIGGER_FIELDS.find((field) => !isClaimed(field)) ?? null;
}

/**
 * Cycle the trailing (value-less) trigger to the next field. When Tab is
 * pressed again immediately after adding a trigger, it swaps the word rather
 * than stacking another: `current` steps to the next field in
 * {@link TRIGGER_FIELDS} order, skipping any field that already holds a value,
 * and returns `null` once it steps past the last one — the caller then removes
 * the trigger (the "empty" rung), so repeated Tabs read as a wraparound cycle.
 */
export function cycleTriggerField(
  current: TriggerField,
  hasValue: (field: TriggerField) => boolean
): TriggerField | null {
  // The current field is value-less by definition (it's the pending trigger),
  // so it stays in the ring alongside the other still-open fields.
  const ring = TRIGGER_FIELDS.filter((f) => f === current || !hasValue(f));
  const next = ring[ring.indexOf(current) + 1];
  return next ?? null;
}
