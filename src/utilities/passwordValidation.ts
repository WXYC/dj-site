/**
 * Validates that a password meets the minimum strength requirements:
 * at least 8 characters, one uppercase letter, and one digit.
 */
export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
}
