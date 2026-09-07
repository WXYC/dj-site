/**
 * Shared test data generators for E2E tests.
 *
 * Every generated username starts with `e2e_` so orphaned rows
 * can be cleaned up with `WHERE username LIKE 'e2e_%'`.
 */

import { randomInt } from "node:crypto";

/**
 * Generate a unique username for E2E tests.
 * @param prefix - Short label identifying the test context (e.g. "user", "delete", "role", "email")
 */
export function generateUsername(prefix = "e2e"): string {
  // Base-36 timestamp (~8 chars) keeps output shorter (~20 chars total) to
  // avoid onboarding redirect timeouts observed with longer username formats.
  // The random suffix uses crypto.randomInt, not Math.random: the generated
  // name flows into account creation, and CodeQL (rightly) rejects insecure
  // randomness on that path. 36**3 keeps it exactly three base-36 chars.
  const suffix = randomInt(36 ** 3).toString(36).padStart(3, "0");
  return `e2e_${prefix}_${Date.now().toString(36)}_${suffix}`;
}

/**
 * Generate a deterministic email from a username.
 */
export function generateEmail(username: string): string {
  return `${username}@test.wxyc.org`;
}
