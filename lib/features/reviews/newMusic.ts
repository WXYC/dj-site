import type { IntakeItem } from "@wxyc/shared";
import type { ReviewStage } from "./holder";

/** The New music tab's stages, in the order a record moves through them. */
export const NEW_MUSIC_STAGES: readonly ReviewStage[] = ["review_shelf", "requested", "being_reviewed", "waiting", "reviewed", "filed"];

const FILED_RECENT_DAYS = 30;

/** The records in the order they were added, then by id, on a copy: the cache's own array is never sorted. */
export const oldestLoggedFirst = (items: IntakeItem[]): IntakeItem[] =>
  [...items].sort((a, b) => Date.parse(a.logged_at) - Date.parse(b.logged_at) || a.id - b.id);

/** Filed records, newest filed first, split at 30 days before `now`. A record with no `filed_at` counts as older and sorts last. */
export function filedByRecency(filed: IntakeItem[], now: number): { recent: IntakeItem[]; older: IntakeItem[] } {
  const at = (i: IntakeItem) => (i.filed_at ? Date.parse(i.filed_at) : 0);
  const cutoff = now - FILED_RECENT_DAYS * 24 * 60 * 60 * 1000;
  const sorted = [...filed].sort((a, b) => at(b) - at(a) || b.id - a.id);
  return { recent: sorted.filter((i) => at(i) >= cutoff), older: sorted.filter((i) => at(i) < cutoff) };
}
