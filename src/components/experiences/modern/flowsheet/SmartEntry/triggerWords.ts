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
