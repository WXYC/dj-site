/**
 * An unissued or failed `useGetGenresQuery` must never render as an empty
 * genre list — a librarian filing against a backend outage must never read
 * "there are no genres", the same misreading `searchArtistsInGenre` guards
 * against by opting out of the shared non-JSON soft-fail
 * (`extraOptions: { surfaceNonJsonAsError: true }` in
 * `lib/features/catalog/api.ts`).
 *
 * The predicate reads absence-of-list, never `isError`, because the two
 * diverge in both directions:
 *
 * - A refetch that fails with a structured JSON error leaves the last good
 *   `data` in place: `isError` goes true while a perfectly good cached list
 *   is still on screen — genres a form could file against right now — so
 *   reading the flag would put a "can't be filed right now" alert beside a
 *   form that still works.
 * - A refetch that fails with a non-JSON body (a gateway's HTML 502) never
 *   errors at all: the shared base query soft-fails it into a fulfilled
 *   `{ data: null }` that replaces the cached list (see
 *   `lib/features/backend.ts`). That is an outage with nothing left to file
 *   against, and it is why the check must be loose `== null` — the
 *   soft-fail's payload is `null`, deliberately distinct from RTK Query's
 *   in-flight `undefined`, and a strict `=== undefined` guard would miss it.
 *
 * `isUninitialized` separates "no data because nothing was asked" from
 * "asked and got nothing": a query held back by `skip` reports
 * `isLoading: false` with `data: undefined`, which would otherwise read as
 * an outage before any request existed. `isLoading` then covers the initial
 * in-flight render once the request is underway.
 */
export function isGenresUnavailable(query: {
  isUninitialized: boolean;
  isLoading: boolean;
  data?: readonly unknown[] | null;
}): boolean {
  return !query.isUninitialized && !query.isLoading && query.data == null;
}
