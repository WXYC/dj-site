import { useGetAlbumMetadataQuery } from "./api";

const DEFAULT_ARTWORK_URL = "/img/cassette.png";

/**
 * Fetches album metadata from the Backend-Service metadata proxy and returns the artwork URL.
 * Skips the query when either `artistName` or `releaseTitle` is falsy.
 */
export function useAlbumArtwork(
  artistName: string | undefined,
  releaseTitle: string | undefined,
) {
  const shouldSkip = !artistName || !releaseTitle;

  const { data, isLoading } = useGetAlbumMetadataQuery(
    { artistName: artistName!, releaseTitle: releaseTitle! },
    { skip: shouldSkip },
  );

  return {
    artworkUrl: data?.artworkUrl ?? DEFAULT_ARTWORK_URL,
    isLoading: !shouldSkip && isLoading,
    metadata: data ?? null,
  };
}
