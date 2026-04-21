export interface AlbumMetadata {
  discogsReleaseId: number;
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
}

export interface AlbumMetadataQueryParams {
  artistName: string;
  releaseTitle: string;
  trackTitle?: string;
}
