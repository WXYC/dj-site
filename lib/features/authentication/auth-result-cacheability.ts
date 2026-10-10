import type { AuthenticationData } from "./types";

// Kept apart from utilities.ts so a caller that caches resolutions can ask the
// question without importing the resolver (and so tests that replace the
// resolver still get the real answer).
const uncacheable = new WeakSet<object>();

/**
 * Mark a resolution as provisional: it fell back to no authority only because
 * the JWT could not be fetched, so a cache must not keep it.
 */
export function markAuthResultUncacheable(data: AuthenticationData): void {
  uncacheable.add(data);
}

/** Whether a resolution was marked provisional and should be resolved again. */
export function isAuthResultUncacheable(data: AuthenticationData): boolean {
  return uncacheable.has(data);
}
