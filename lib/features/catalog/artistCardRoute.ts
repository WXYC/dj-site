import { isVariousArtists } from "./libraryCode";

/**
 * Which card describes this artist row.
 *
 * `/wxycdb` serves both cards from one `artist` servlet and picks the view
 * from the row itself; the two are separate URLs here, so the same choice has
 * to be made wherever a link to an artist is built. Compilation buckets get a
 * different screen because they are a different filing model — a bucket is a
 * shelf section with per-track credits, not a performer — so landing one on
 * the ordinary card offers a name edit for a section heading and hides the
 * credits entirely.
 *
 * The decision is structural, on `code_letters`. Deciding it on the artist's
 * name would drop the entire `Soundtracks - <A–Z>` sub-shelf, which carries no
 * compilation keyword anywhere in its names.
 *
 * `link.genreId` names WHICH of the artist's memberships the link means.
 * `genre_artist_crossreference` is unique on `(artist_id, genre_id)`, so an id
 * alone does not identify a card: artist 431 ('Isis') is a hip-hop act filed
 * `IS 1` under Hiphop and a metal band filed `IS 13` under Rock, and an
 * unscoped link lands both on one page headed with the lower of the two codes.
 * Omitted, the URL is exactly what it was before this parameter existed, so a
 * caller that does not know the genre still produces a working link — it just
 * gets that collapse.
 *
 * A compilation bucket takes no genre even when one is supplied. A bucket is a
 * shelf SECTION, not a performer, and artist 1087 ('Various Artists') is filed
 * under 14 genres across 3,107 rows; scoping its card to one would hide most
 * of the section rather than disambiguate anything. It still takes
 * `link.params`: creating a compilation row lands on the bucket card and has
 * to carry its confirmation flag there.
 *
 * `link.params` exists because this builder can now emit a query string, and a
 * caller that appends its own would produce `?genre_id=11?created=1` — which
 * `parseArtistCardGenreId` reads as malformed, so the route answers
 * `notFound()` and a successful create lands on a 404. Values are encoded
 * here; pass them raw.
 */
export function artistCardHref(
  artist: {
    id: number;
    code_letters: string;
  },
  link: {
    genreId?: number | null;
    params?: Record<string, string | number>;
  } = {},
): string {
  const bucket = isVariousArtists(artist.code_letters);
  const query = new URLSearchParams();
  if (!bucket && link.genreId != null) {
    query.set("genre_id", String(link.genreId));
  }
  for (const [key, value] of Object.entries(link.params ?? {})) {
    query.set(key, String(value));
  }
  const path = bucket
    ? `/dashboard/library/various/${artist.id}`
    : `/dashboard/library/artist/${artist.id}`;
  const suffix = query.toString();
  return suffix.length === 0 ? path : `${path}?${suffix}`;
}

/**
 * Reads `artistCardHref`'s `genre_id` back off a card URL. Kept beside the
 * builder so the two halves of the contract cannot drift.
 *
 * Three outcomes, not two, because "no genre" and "a genre I cannot read" must
 * not take the same branch:
 *
 * - `undefined` — absent. The unscoped card, which is what every link built
 *   before this parameter existed asks for.
 * - a positive integer — that membership.
 * - `null` — present and malformed. The caller answers `notFound()`, the same
 *   answer the page already gives a non-numeric id segment. Treating it as
 *   absent instead would quietly serve the conflated card this parameter
 *   exists to split, which is the reported symptom reached silently.
 *
 * A repeated key arrives as `string[]`. Two values name two conflicting
 * memberships, so it is malformed rather than first-wins: taking the first
 * would serve the Hiphop card for a URL that also asked for Rock, which is the
 * silent wrong-card arrival this parse exists to prevent. `GET
 * /library/artists/:id` answers 400 for the same input, so the two halves of
 * the contract agree. A one-element array is just the string form.
 */
export function parseArtistCardGenreId(
  value: string | string[] | undefined,
): number | undefined | null {
  if (Array.isArray(value)) {
    return value.length === 1 ? parseArtistCardGenreId(value[0]) : null;
  }
  if (value === undefined) {
    return undefined;
  }
  // `Number("")` and `Number(" ")` are both 0, which would pass an
  // `Number.isInteger` check as a legitimate value; fold blank to NaN first so
  // one comparison covers it.
  const genreId = value.trim() === "" ? NaN : Number(value);
  return Number.isInteger(genreId) && genreId > 0 ? genreId : null;
}

/**
 * The artist card's delete screen, carrying the same membership the card is
 * showing. The confirmation names the genre-prefixed code (`Rock Cs 2`, never
 * the ambiguous `Cs 2`) and its Cancel returns to the card, so both would
 * otherwise read the lowest-genre collapse for an artist the librarian reached
 * on a different shelf — on the confirmation screen for an irreversible write.
 */
export function artistDeleteHref(
  artistId: number,
  genreId?: number | null,
): string {
  const screen = `/dashboard/library/artist/${artistId}/delete`;
  return genreId == null ? screen : `${screen}?genre_id=${genreId}`;
}
