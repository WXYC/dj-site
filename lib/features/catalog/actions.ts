"use server";

import { revalidateTag } from "next/cache";

/**
 * Invalidation hook for the cached genre list (`getCachedGenres`, tagged
 * "genres"). Wired into the `addGenre` mutation path so an admin adding a genre
 * expires the seed. INERT until the OpenNext KV/R2 tag-cache adapter replaces
 * the "dummy" tag cache in `open-next.config.ts`: with the no-op backend,
 * `revalidateTag` has no store to clear.
 */
export async function revalidateGenres(): Promise<void> {
  // The "max" profile expires the tag regardless of the accessor's cacheLife.
  revalidateTag("genres", "max");
}
