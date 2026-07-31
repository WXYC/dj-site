import { useGetAlbumMetadataQuery, useGetArtistMetadataQuery } from "./api";

const DEFAULT_ARTWORK_URL = "/img/cassette.png";

/**
 * Fetches album metadata from the Backend-Service metadata proxy and returns the artwork URL.
 *
 * `skip` should be `true` for a `discogsUnavailable`-flagged album: it has no
 * Discogs match to look up by definition, so fetching would be a doomed
 * request. Callers that pass `skip` are an optimization, not the gate itself
 * — `AlbumCard` suppresses rendering of every metadata-derived block on the
 * flag regardless of whether this fetch ran.
 */
export function useAlbumArtwork(
  artistName: string | undefined,
  releaseTitle: string | undefined,
  skip?: boolean,
) {
  const shouldSkip = !artistName || !releaseTitle || skip === true;

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

/**
 * Fetches artist metadata (bio, Wikipedia link) from the Backend-Service metadata proxy.
 */
export function useArtistMetadata(discogsArtistId: number | null | undefined) {
  const shouldSkip = !discogsArtistId;

  const { data, isLoading } = useGetArtistMetadataQuery(
    { artistId: discogsArtistId! },
    { skip: shouldSkip },
  );

  return {
    artistMetadata: data ?? null,
    bioTokens: data?.bioTokens ?? null,
    isLoading: !shouldSkip && isLoading,
  };
}
