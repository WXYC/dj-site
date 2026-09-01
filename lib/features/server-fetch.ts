import "server-only";

// Request-time backend reads for Server Components run before the first byte of
// the document, so a hung backend must not stall the route: this bound is the
// worst-case TTFB penalty a degraded backend can add.
const SEED_FETCH_TIMEOUT_MS = 800;

/**
 * Shared GET-and-parse core for server-side Backend-Service reads. Applies the
 * request-time timeout and THROWS on any failure (missing backend URL, network
 * error/timeout, non-2xx, or an empty/non-JSON body). Callers decide how to
 * treat a throw: a seed swallows it and falls back to client state; a cached
 * accessor must let it propagate so an errored result is never persisted.
 *
 * `init` carries per-caller fetch semantics — seeds pass `cache: "no-store"`; a
 * `"use cache"` accessor omits it so the use-cache runtime owns caching. The
 * timeout signal is applied here and must not be overridden by `init`.
 */
export async function fetchBackendJson<T>(
  path: string,
  init?: Omit<RequestInit, "signal">,
): Promise<T> {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");

  const response = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    ...init,
    signal: AbortSignal.timeout(SEED_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`backend responded ${response.status}`);

  const body = await response.text();
  if (!body) throw new Error("empty response body");
  return JSON.parse(body) as T;
}

/**
 * Unauthenticated GET against Backend-Service for server-rendered initial data.
 * Returns `undefined` on any failure (network error, timeout, non-2xx, or an
 * empty/non-JSON body) so callers can fall back to their client-fetched state.
 */
export async function fetchBackendSeed<T>(
  path: string,
): Promise<T | undefined> {
  try {
    return await fetchBackendJson<T>(path, { cache: "no-store" });
  } catch {
    return undefined;
  }
}
