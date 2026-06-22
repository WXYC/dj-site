/**
 * Username validation that mirrors better-auth's username plugin defaults
 * (see Backend-Service `shared/authentication/src/auth.username.ts`).
 *
 * The canonical check runs server-side in `provisionUser()`. This client-side
 * copy exists so the admin "Add DJ" form can fail fast with a friendly
 * message instead of round-tripping a 400.
 */

export const USERNAME_REGEX = /^[a-zA-Z0-9_.]+$/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;

export function getUsernameError(username: string): string | null {
  if (username.length < MIN_USERNAME_LENGTH) {
    return `Username must be at least ${MIN_USERNAME_LENGTH} characters.`;
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return `Username must be at most ${MAX_USERNAME_LENGTH} characters.`;
  }
  if (!USERNAME_REGEX.test(username)) {
    return 'Username may only contain letters, numbers, underscores, and dots (no spaces).';
  }
  return null;
}
