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
 * `genreId` names WHICH of the artist's memberships the link means.
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
 * of the section rather than disambiguate anything.
 */
export function artistCardHref(
  artist: {
    id: number;
    code_letters: string;
  },
  genreId?: number | null,
): string {
  if (isVariousArtists(artist.code_letters)) {
    return `/dashboard/library/various/${artist.id}`;
  }
  const card = `/dashboard/library/artist/${artist.id}`;
  return genreId == null ? card : `${card}?genre_id=${genreId}`;
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
 * A repeated key arrives as `string[]`; the first value wins, matching
 * `firstSearchParam` and `useSearchParams().get()`.
 */
export function parseArtistCardGenreId(
  value: string | string[] | undefined,
): number | undefined | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return undefined;
  }
  // `Number("")` and `Number(" ")` are both 0, which would pass an
  // `Number.isInteger` check as a legitimate value; fold blank to NaN first so
  // one comparison covers it.
  const genreId = raw.trim() === "" ? NaN : Number(raw);
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
