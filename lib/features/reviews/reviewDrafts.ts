import type { ReviewPatch } from "@wxyc/shared";

const PREFIX = "review-draft:";

/**
 * Unsaved review text kept in the tab's `sessionStorage`, one entry per review. Storage that throws (private mode, a full quota) is treated as absent so the editor behaves as it would without any.
 */
export function readReviewDraft(id: number): ReviewPatch | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(PREFIX + id) ?? "null");
    return parsed !== null && typeof parsed === "object" ? (parsed as ReviewPatch) : null;
  } catch {
    return null;
  }
}

export function writeReviewDraft(id: number, patch: ReviewPatch): void {
  try {
    sessionStorage.setItem(PREFIX + id, JSON.stringify(patch));
  } catch {
    // Not kept; the editor works without it.
  }
}

export function clearReviewDraft(id: number): void {
  try {
    sessionStorage.removeItem(PREFIX + id);
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
