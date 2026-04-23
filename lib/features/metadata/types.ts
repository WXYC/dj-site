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

export type ResolvedToken =
  | { type: "plainText"; text: string }
  | { type: "artistLink"; name: string; display_name: string; url: string }
  | { type: "labelName"; name: string }
  | { type: "releaseLink"; title: string; url: string }
  | { type: "masterLink"; title: string; url: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "underline"; content: string }
  | { type: "urlLink"; href: string | null; content: string };

export interface ArtistMetadata {
  discogsArtistId: number;
  bio: string | null;
  bioTokens: ResolvedToken[] | null;
  wikipediaUrl: string | null;
  imageUrl: string | null;
}

export interface AlbumMetadataQueryParams {
  artistName: string;
  releaseTitle: string;
  trackTitle?: string;
}
