import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Encapsulates the loading/error/toast boilerplate for async handlers.
 *
 * The provided async function should throw on failure; useAsyncAction
 * catches the error, extracts a message, sets error state, and shows
 * a toast. Returns the function's resolved value on success, or
 * `undefined` on failure — letting callers plumb a value through
 * without closing over mutable state.
 */
export function useAsyncAction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async <T>(
      fn: () => Promise<T>,
      fallbackMessage = "An unexpected error occurred",
    ): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : fallbackMessage;
        const wrapped =
          err instanceof Error ? err : new Error(message);
        setError(wrapped);
        if (message.trim().length > 0) {
          toast.error(message);
        }
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { execute, isLoading, error };
}
