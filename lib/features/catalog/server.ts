import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { fetchBackendJson } from "../server-fetch";
import type { LibraryGenreRow } from "./types";

/**
 * The near-static library genre list, cached under the "genres" tag with an
 * hours-scale lifetime, for seeding the catalog Filters autocomplete.
 *
 * MUST NOT THROW. Cache Components prerenders this route, so this function runs
 * during the production build with no backend reachable — and an error raised
 * inside a `"use cache"` scope escapes any `try/catch` around the call and
 * fails the build outright. Every failure therefore resolves to `undefined`.
 *
 * `undefined` means "no seed", which is the safe state: the page passes nothing,
 * the client query keeps its loading affordance, and it stays the sole authority
 * on the value. That is what makes caching a failure harmless — an empty array
 * would not be, because it would render as a settled, genuinely-empty dropdown
 * for the whole cacheLife window.
 *
 * Must stay argument-pure: a cached function cannot read cookies or headers, so
 * it reads only env and never request state — which is what lets it compose
 * inside this auth-gated route at all.
 */
export async function getCachedGenres(): Promise<LibraryGenreRow[] | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("genres");

  try {
    const data = await fetchBackendJson<unknown>("/library/genres");
    // A valid-JSON non-array 200 must not reach the consumer's `.map`.
    return Array.isArray(data) ? (data as LibraryGenreRow[]) : undefined;
  } catch {
    return undefined;
  }
}
