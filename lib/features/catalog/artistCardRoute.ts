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
 */
export function artistCardHref(artist: {
  id: number;
  code_letters: string;
}): string {
  return isVariousArtists(artist.code_letters)
    ? `/dashboard/library/various/${artist.id}`
    : `/dashboard/library/artist/${artist.id}`;
}
