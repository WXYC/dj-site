export interface AlbumMetadata {
  discogsReleaseId: number;
  discogsArtistId: number | null;
  discogsUrl: string;
  artworkUrl: string;
  releaseYear: number;
  spotifyUrl: string;
  appleMusicUrl: string;
  youtubeMusicUrl: string;
  bandcampUrl: string;
  soundcloudUrl: string;
  tracklist: { position: string; title: string; duration: string }[];
  genres: string[];
  styles: string[];
  label: string;
  fullReleaseDate: string;
  artistBio?: string;
  artistWikipediaUrl?: string;
}

export interface ArtistMetadata {
  discogsArtistId: number;
  bio: string | null;
  wikipediaUrl: string | null;
  imageUrl: string | null;
}

export interface AlbumMetadataQueryParams {
  artistName: string;
  releaseTitle: string;
  trackTitle?: string;
}
