import { useSearchCatalogQuery } from "@/lib/features/catalog/api";
import { useGetAlbumReviewsByArtistQuery } from "@/lib/features/reviews/albumReviewApi";
import { matchLibraryRelease } from "@/lib/features/reviews/probablyExists";

/**
 * Whether a review of this record probably exists already: a library release with its artist and title, and the form archive's reviews of its artist. A suggestion only; nothing here cites anything.
 * Two cached reads, skipped for a blank artist or album or when `enabled` is false. Only the current argument's rows count (never `data`, which carries the previous argument's over), and a failed read reads as nothing found.
 * Each new artist and album is a new read, so a caller fed by typing debounces its arguments or passes `enabled` only once they settle.
 * `library` is the matched release, whose `id` is always a library id a caller can cite.
 * `settled` is true once both reads for these arguments have ended, answered or failed, and false while either is pending or the lookup is skipped. The two reads answer on their own, so a caller that acts on `library` and `formCount` together waits for it; a caller that only draws what is found need not.
 */
export function useReviewProbablyExists(artist: string, album: string, enabled: boolean) {
  const [name, title] = [artist.trim(), album.trim()];
  const skip = !enabled || name === "" || title === "";
  const catalog = useSearchCatalogQuery({ artist_name: name, album_title: title, n: 20 }, { skip });
  const archive = useGetAlbumReviewsByArtistQuery(name, { skip });
  const library = catalog.currentData ? matchLibraryRelease(catalog.currentData, name, title) : undefined;
  const formCount = archive.currentData?.length ?? 0;
  const settled = !skip && !catalog.isFetching && !archive.isFetching;
  return { library, formCount, any: library !== undefined || formCount > 0, settled };
}
