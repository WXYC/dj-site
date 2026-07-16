export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);
}
