/**
 * An unissued or failed `useGetGenresQuery` must never render as an empty
 * genre list — a librarian filing against a backend outage must never read
 * "there are no genres", for the same reason `searchArtistsInGenre` opted
 * out of caching a false no-match during an outage (see
 * `lib/features/catalog/api.ts`, `surfaceNonJsonAsError` on that endpoint).
 *
 * RTK Query keeps the last good `data` on a rejected refetch, so `isError`
 * can be true while a perfectly good cached list is still on screen — a
 * genre a form could file against right now. This predicate therefore tests
 * absence-of-list (`data == null` once the initial load has settled), never
 * `isError`: a failed refetch over cached data is not an outage, and reading
 * the error flag would put a "can't be filed right now" alert beside a form
 * that still works.
 *
 * `genresLoading` alone covers the mount render — `useGetGenresQuery` passes
 * no `skip`, so RTK Query synthesizes `isLoading: true` for that first
 * render regardless of whether the request has resolved.
 */
export function isGenresUnavailable(
  genresLoading: boolean,
  genres: unknown[] | null | undefined,
): boolean {
  return !genresLoading && genres == null;
}
