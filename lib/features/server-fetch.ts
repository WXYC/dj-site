import "server-only";

// Request-time seed fetches for public Server Components must fail open: a slow
// or unreachable backend renders the page's normal loading state, never an
// error page. The short timeout keeps a hung backend from stalling the route.
const SEED_FETCH_TIMEOUT_MS = 2000;

/**
 * Unauthenticated GET against Backend-Service for server-rendered initial data.
 * Returns `undefined` on any failure (network error, timeout, non-2xx, or an
 * empty/non-JSON body) so callers can fall back to their client-fetched state.
 */
export async function fetchBackendSeed<T>(
  path: string,
): Promise<T | undefined> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) return undefined;

  try {
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(SEED_FETCH_TIMEOUT_MS),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return undefined;

    const body = await response.text();
    if (!body) return undefined;
    return JSON.parse(body) as T;
  } catch {
    return undefined;
  }
}
