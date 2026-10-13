import type { ReviewPatch } from "@wxyc/shared";
import { CONSENT_KEYS, FIELD_NAMES } from "./draftKeys";

const PREFIX = "review-draft:";
const keyOf = (userId: string, id: number) => `${PREFIX}${userId}:${id}`;

const isText = (v: unknown) => v === null || typeof v === "string";
const KINDS: Record<string, (v: unknown) => boolean> = Object.fromEntries([
  ...FIELD_NAMES.map((n) => [n, isText]),
  ...CONSENT_KEYS.map((k) => [k, k === "credit" ? isText : (v: unknown) => typeof v === "boolean"]),
]);

/** The patch's own keys from a stored value, or null when it is not an object of at least one such key with every one the right type. */
function shaped(parsed: unknown): ReviewPatch | null {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const known = Object.entries(parsed).filter(([k]) => Object.hasOwn(KINDS, k));
  return known.length > 0 && known.every(([k, v]) => KINDS[k](v)) ? (Object.fromEntries(known) as ReviewPatch) : null;
}

/**
 * Unsaved review text kept in the tab's `sessionStorage`, one entry per user and review, so text one DJ left on a shared computer is never offered to the next. An empty user id reads and writes nothing. Storage that throws (private mode, a full quota) is treated as absent so the editor behaves as it would without any.
 */
export function readReviewDraft(userId: string, id: number): ReviewPatch | null {
  if (!userId) return null;
  let kept: ReviewPatch | null = null;
  try {
    const raw = sessionStorage.getItem(keyOf(userId, id));
    if (raw === null) return null;
    kept = shaped(JSON.parse(raw));
  } catch {
    // Unreadable or unparseable: treated as absent.
  }
  if (!kept) clearReviewDraft(userId, id);
  return kept;
}

export function writeReviewDraft(userId: string, id: number, patch: ReviewPatch): void {
  if (!userId) return;
  try {
    sessionStorage.setItem(keyOf(userId, id), JSON.stringify(patch));
  } catch {
    // Not kept; the editor works without it.
  }
}

export function clearReviewDraft(userId: string, id: number): void {
  if (!userId) return;
  try {
    sessionStorage.removeItem(keyOf(userId, id));
  } catch {
    // Nothing to remove.
  }
}

/** Every review's stored text: a station computer is shared, so sign-out drops them all. */
export function clearReviewDrafts(): void {
  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Nothing to remove.
  }
}
