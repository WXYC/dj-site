import { useCallback, useState } from "react";
import { toast } from "sonner";

/**
 * Encapsulates the loading/error/toast boilerplate for async handlers.
 *
 * The provided async function should throw on failure; useAsyncAction
 * catches the error, extracts a message, sets error state, and shows
 * a toast. Returns `true` on success, `false` on failure.
 */
export function useAsyncAction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (
      fn: () => Promise<void>,
      fallbackMessage = "An unexpected error occurred",
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      try {
        await fn();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : fallbackMessage;
        const wrapped =
          err instanceof Error ? err : new Error(message);
        setError(wrapped);
        if (message.trim().length > 0) {
          toast.error(message);
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { execute, isLoading, error };
}
