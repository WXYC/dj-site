/**
 * True when a read failed and there is nothing to show in its place.
 *
 * Absence of data, not the error flag alone: RTK Query keeps the last good
 * `data` when a background refetch fails and sets `isError`, so a screen that
 * keys on `isError` would replace rows already on screen with a failure line.
 * A read that never went out reports neither, so it is not a failure either.
 */
export function hasNothingToShow(query: { isError: boolean; data?: unknown }): boolean {
  return query.isError && query.data == null;
}
