import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Creates a wrapper function that ensures authentication before executing hooks
 * @param hookFunction - The hook function to wrap with authentication checks
 * @returns A wrapped hook function that checks authentication state
 */
export function createAuthenticatedHooks<T extends (...args: any[]) => any>(
  hookFunction: T
): T {
  return ((...args: Parameters<T>) => {
    const router = useRouter();
    const user = useAppSelector((state) => state.authentication.session.user);
    const loading = useAppSelector((state) => state.authentication.session.loading);

    useEffect(() => {
      // If not loading and no user, redirect to login
      if (!loading && !user) {
        router.refresh();
      }
    }, [user, loading, router]);

    // If loading or no user, return early with safe defaults
    if (loading || !user) {
      // Return a safe default object that matches the expected hook return type
      return {} as ReturnType<T>;
    }

    // User is authenticated, execute the original hook
    return hookFunction(...args);
  }) as T;
}
