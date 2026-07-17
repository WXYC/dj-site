import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { fetchBackendJson } from "../server-fetch";
import type { LibraryGenreRow } from "./types";

/**
 * Cached inner accessor for the near-static library genre list, tagged "genres"
 * with an hours-scale lifetime. THROWS on any failure (non-2xx, empty/non-JSON
 * body, or a non-array payload): Next's use-cache runtime does not persist an
 * errored stream, so throwing is what prevents a transient failure from being
 * cached as an empty list for the whole cacheLife window.
 *
 * Must stay argument-pure: a `"use cache"` function cannot read cookies or
 * headers, so it reads only build/runtime env and never request state — which
 * is what lets it compose inside the auth-gated catalog route.
 *
 * CONSTRAINTS on real effect today:
 *  - The backend genre endpoint requires an authenticated caller, and this
 *    accessor is header-less by construction (a cached function cannot read the
 *    session), so the request is rejected and the wrapper yields an empty seed
 *    on every request in every environment. A live seed needs Backend-Service
 *    to expose the genre list on a public tier first.
 *  - Cross-request persistence and tag revalidation are inert: the OpenNext
 *    deployment wires the incremental cache and tag cache to no-op ("dummy")
 *    backends, so there is no store behind `cacheLife`/`cacheTag` and
 *    `revalidateTag("genres")` clears nothing. Only same-request memoization is
 *    live. Real caching requires the OpenNext KV/R2 cache adapter work.
 */
async function fetchCachedGenres(): Promise<LibraryGenreRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("genres");

  const data = await fetchBackendJson<unknown>("/library/genres");
  if (!Array.isArray(data)) {
    throw new Error("expected an array of genres");
  }
  return data as LibraryGenreRow[];
}

/**
 * Uncached wrapper that fails open for the catalog Filters seed: returns
 * `undefined` on any failure so the page passes no seed and the client query's
 * loading affordance stays reachable (matches the established seed contract).
 */
export async function getCachedGenres(): Promise<LibraryGenreRow[] | undefined> {
  try {
    return await fetchCachedGenres();
  } catch {
    return undefined;
  }
}
