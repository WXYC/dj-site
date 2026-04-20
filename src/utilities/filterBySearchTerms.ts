import { AlbumEntry } from "@/lib/features/catalog/types";

interface SearchQuery {
  album: string;
  artist: string;
  label: string;
}

/**
 * Filters album entries by matching against search terms from a flowsheet query.
 * Terms shorter than 4 characters are ignored to avoid noise.
 */
export function filterBySearchTerms(items: AlbumEntry[], query: SearchQuery): AlbumEntry[] {
  const searchTerms = [query.album, query.artist, query.label]
    .map((term) => term.toLowerCase())
    .filter((term) => term.length > 3);

  if (searchTerms.length === 0) {
    return [];
  }

  return items.filter((item) => {
    const fields = [
      item.artist?.name.toLowerCase() ?? "",
      item.title?.toLowerCase() ?? "",
      item.label?.toLowerCase() ?? "",
    ];

    return searchTerms.some((searchTerm) =>
      fields.some((field) => field.includes(searchTerm))
    );
  });
}
