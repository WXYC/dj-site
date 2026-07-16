export function throwIfBetterAuthError(
  result: { error?: any },
  fallbackMessage: string,
): void {
  if (!result.error) return;

  const errorMessage = result.error.message || fallbackMessage;
  throw new Error(errorMessage);
}
