import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { LibraryGenreRow } from "./types";

/**
 * Server-side cached accessor for the near-static library genre list, for
 * seeding the catalog Filters on first paint. The result is memoized under the
 * "genres" cache tag with an hours-scale lifetime; `revalidateGenres()` in
 * `actions.ts` is the invalidation hook for the `addGenre` mutation path.
 *
 * CONSTRAINT: cross-request persistence and tag revalidation are INERT on the
 * current OpenNext/Cloudflare deployment. `open-next.config.ts` wires the
 * incremental cache and tag cache to the "dummy" (no-op) backends, so there is
 * no store behind `cacheLife`/`cacheTag` — each fresh request re-fetches and
 * `revalidateTag("genres")` does nothing. Only same-request/same-isolate
 * memoization is live today. Real cross-request caching requires the OpenNext
 * KV/R2 cache adapter work to replace those dummy backends.
 *
 * Must stay argument-pure: a `"use cache"` function cannot read cookies or
 * headers, so it reads only build/runtime env and never request state — which
 * is what lets it compose inside the auth-gated catalog route.
 */
export async function getCachedGenres(): Promise<LibraryGenreRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("genres");

  const base = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) return [];

  try {
    const response = await fetch(`${base}/library/genres`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];

    const body = await response.text();
    if (!body) return [];
    return JSON.parse(body) as LibraryGenreRow[];
  } catch {
    return [];
  }
}
