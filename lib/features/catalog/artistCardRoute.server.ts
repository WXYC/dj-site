import { notFound } from "next/navigation";

import { parseArtistCardGenreId } from "./artistCardRoute";

/**
 * The `genre_id` guard every artist-card route shares: read the membership the
 * URL names, or refuse the request.
 *
 * A malformed `genre_id` is a broken link, the same class of wrong URL as a
 * non-numeric id segment, and gets the same answer. Falling back to the
 * unscoped read instead would quietly serve the collapsed card -- one shelf's
 * code over every shelf's releases -- which is the symptom the parameter
 * exists to prevent.
 *
 * It lives here rather than in each page because the `null`-means-404 half of
 * `parseArtistCardGenreId`'s three-way return is the easiest thing in this
 * contract to get wrong: a caller writing the natural `?? undefined` or a
 * truthiness check converts "malformed" into "unscoped" and serves exactly the
 * conflated card. Pages consume `number | undefined` and never see `null`.
 */
export function artistCardGenreIdOrNotFound(
  value: string | string[] | undefined,
): number | undefined {
  const genreId = parseArtistCardGenreId(value);
  if (genreId === null) {
    notFound();
  }
  return genreId;
}
