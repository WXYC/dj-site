/**
 * Checks a better-auth client result for an error and throws with the error message.
 * Handles the common pattern of extracting error messages from better-auth responses.
 */
export function throwIfBetterAuthError(
  result: { error?: any },
  fallbackMessage: string,
): void {
  if (!result.error) return;

  const errorMessage = result.error.message || fallbackMessage;
  throw new Error(errorMessage);
}
